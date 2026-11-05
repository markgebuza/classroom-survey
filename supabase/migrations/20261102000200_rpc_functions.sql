-- Classroom Survey: RPC functions (API.md §7, §8, §10, §11; DATABASE.md §5, §9, §11)
-- Run AFTER 20261102000100_initial_schema.sql. Safe to re-run (CREATE OR REPLACE).
--
-- Supabase grants EXECUTE on new functions to anon and authenticated by default,
-- so every function below first revokes from public, anon and authenticated and
-- then grants exactly the roles that need it.

begin;

-- ---------------------------------------------------------------------------
-- activate_survey: close the current active survey, ensure a slug, activate.
-- Runs with the caller's rights (authenticated instructor), so RLS still applies.
-- ---------------------------------------------------------------------------
create or replace function public.activate_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
    v_status text;
    v_slug text;
    v_bytes bytea;
    v_byte_index integer;
begin
    -- Serialise concurrent activations so the one-active-survey index is never hit.
    perform pg_advisory_xact_lock(hashtext('public.activate_survey'));

    select s.status, s.public_slug
      into v_status, v_slug
      from surveys s
     where s.id = p_survey_id
       for update;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;
    if v_status = 'archived' then
        raise exception 'SURVEY_ARCHIVED';
    end if;
    if not exists (select 1 from questions q where q.survey_id = p_survey_id) then
        raise exception 'SURVEY_HAS_NO_QUESTIONS';
    end if;

    update surveys
       set status = 'closed'
     where status = 'active'
       and id <> p_survey_id;

    -- 8 random characters from the random bytes of a v4 UUID (DECISIONS.md D9).
    -- Bytes 6 and 8 hold the UUID version/variant bits, so only bytes 0-5 and 10-11 are used.
    while v_slug is null loop
        v_bytes := uuid_send(gen_random_uuid());
        v_slug := '';
        foreach v_byte_index in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
            v_slug := v_slug || substr(
                v_alphabet,
                get_byte(v_bytes, v_byte_index) % length(v_alphabet) + 1,
                1
            );
        end loop;
        if exists (select 1 from surveys s where s.public_slug = v_slug) then
            v_slug := null;
        end if;
    end loop;

    update surveys
       set status = 'active',
           public_slug = v_slug
     where id = p_survey_id;

    return jsonb_build_object('id', p_survey_id, 'status', 'active', 'public_slug', v_slug);
end;
$$;

revoke all on function public.activate_survey(uuid) from public, anon, authenticated;
grant execute on function public.activate_survey(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- close_survey: active -> closed. Idempotent for already-closed surveys.
-- ---------------------------------------------------------------------------
create or replace function public.close_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_status text;
begin
    select s.status into v_status from surveys s where s.id = p_survey_id for update;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;
    if v_status = 'active' then
        update surveys set status = 'closed' where id = p_survey_id;
    elsif v_status <> 'closed' then
        raise exception 'SURVEY_NOT_ACTIVE';
    end if;

    return jsonb_build_object('id', p_survey_id, 'status', 'closed');
end;
$$;

revoke all on function public.close_survey(uuid) from public, anon, authenticated;
grant execute on function public.close_survey(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_survey_response: the ONLY way students write data.
-- SECURITY DEFINER (runs as the table owner, bypassing RLS) so anon needs no
-- table privileges on responses/answers. All validation happens here, in one
-- transaction, and errors are raised with fixed codes the frontend maps to
-- friendly messages.
-- ---------------------------------------------------------------------------
create or replace function public.submit_survey_response(
    p_survey_id uuid,
    p_anonymous_token text,
    p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_token text := nullif(btrim(p_anonymous_token), '');
    v_answers jsonb := case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end;
    v_item jsonb;
    v_question_id uuid;
    v_choice_id uuid;
    v_seen uuid[] := '{}';
    v_response_id uuid;
begin
    -- FOR SHARE: a concurrent close_survey waits until this submission finishes.
    select s.status into v_status from surveys s where s.id = p_survey_id for share;
    if not found or v_status <> 'active' then
        raise exception 'SURVEY_NOT_ACTIVE';
    end if;

    if v_token is null or length(v_token) > 200 then
        raise exception 'INVALID_TOKEN';
    end if;

    if exists (
        select 1 from responses r
         where r.survey_id = p_survey_id and r.anonymous_token = v_token
    ) then
        raise exception 'DUPLICATE_RESPONSE';
    end if;

    for v_item in select value from jsonb_array_elements(v_answers) loop
        if jsonb_typeof(v_item) <> 'object' then
            raise exception 'INVALID_QUESTION';
        end if;

        begin
            v_question_id := (v_item ->> 'question_id')::uuid;
        exception when invalid_text_representation then
            raise exception 'INVALID_QUESTION';
        end;
        if v_question_id is null
           or v_question_id = any (v_seen)
           or not exists (
               select 1 from questions q
                where q.id = v_question_id and q.survey_id = p_survey_id
           ) then
            raise exception 'INVALID_QUESTION';
        end if;
        v_seen := v_seen || v_question_id;

        begin
            v_choice_id := (v_item ->> 'choice_id')::uuid;
        exception when invalid_text_representation then
            raise exception 'INVALID_CHOICE';
        end;
        if v_choice_id is null
           or not exists (
               select 1 from choices c
                where c.id = v_choice_id and c.question_id = v_question_id
           ) then
            raise exception 'INVALID_CHOICE';
        end if;
    end loop;

    -- Every question is required (DECISIONS.md D5).
    if exists (
        select 1 from questions q
         where q.survey_id = p_survey_id and not (q.id = any (v_seen))
    ) then
        raise exception 'MISSING_REQUIRED_ANSWER';
    end if;

    begin
        insert into responses (survey_id, anonymous_token)
        values (p_survey_id, v_token)
        returning id into v_response_id;
    exception when unique_violation then
        -- Two simultaneous submissions from the same browser.
        raise exception 'DUPLICATE_RESPONSE';
    end;

    insert into answers (response_id, question_id, choice_id)
    select v_response_id, (e ->> 'question_id')::uuid, (e ->> 'choice_id')::uuid
      from jsonb_array_elements(v_answers) e;

    return jsonb_build_object('success', true, 'response_id', v_response_id);
end;
$$;

revoke all on function public.submit_survey_response(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_survey_response(uuid, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_survey_results: counts and percentages per choice (API.md §11 shape).
-- percentage = count / answers to that question * 100, 1 decimal, 0 if none.
-- ---------------------------------------------------------------------------
create or replace function public.get_survey_results(p_survey_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
    v_result jsonb;
begin
    select jsonb_build_object(
        'survey_id', s.id,
        'response_count', (select count(*) from responses r where r.survey_id = s.id),
        'questions', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'question_id', q.id,
                    'question_text', q.question_text,
                    'response_count', qa.total,
                    'choices', coalesce((
                        select jsonb_agg(
                            jsonb_build_object(
                                'choice_id', c.id,
                                'choice_text', c.choice_text,
                                'count', cc.total,
                                'percentage', case
                                    when qa.total = 0 then 0
                                    else round(cc.total * 100.0 / qa.total, 1)
                                end
                            )
                            order by c.position
                        )
                        from choices c
                        cross join lateral (
                            select count(*) as total from answers a where a.choice_id = c.id
                        ) cc
                        where c.question_id = q.id
                    ), '[]'::jsonb)
                )
                order by q.position
            )
            from questions q
            cross join lateral (
                select count(*) as total from answers a where a.question_id = q.id
            ) qa
            where q.survey_id = s.id
        ), '[]'::jsonb)
    )
    into v_result
    from surveys s
    where s.id = p_survey_id;

    if v_result is null then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    return v_result;
end;
$$;

revoke all on function public.get_survey_results(uuid) from public, anon, authenticated;
grant execute on function public.get_survey_results(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- duplicate_survey: draft copy "Copy of <title>" with questions and choices,
-- no responses, no slug. Returns the new survey id.
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_survey(p_survey_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_new_survey_id uuid;
    v_question record;
    v_new_question_id uuid;
begin
    insert into surveys (title, description, status, public_slug)
    select 'Copy of ' || s.title, s.description, 'draft', null
      from surveys s
     where s.id = p_survey_id
    returning id into v_new_survey_id;

    if v_new_survey_id is null then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    for v_question in
        select q.id, q.question_text, q.question_type, q.position
          from questions q
         where q.survey_id = p_survey_id
         order by q.position
    loop
        insert into questions (survey_id, question_text, question_type, position)
        values (v_new_survey_id, v_question.question_text, v_question.question_type, v_question.position)
        returning id into v_new_question_id;

        insert into choices (question_id, choice_text, position)
        select v_new_question_id, c.choice_text, c.position
          from choices c
         where c.question_id = v_question.id;
    end loop;

    return v_new_survey_id;
end;
$$;

revoke all on function public.duplicate_survey(uuid) from public, anon, authenticated;
grant execute on function public.duplicate_survey(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_survey_status_by_slug: lets the student page tell "closed" apart from
-- "not found" (DECISIONS.md D10). Returns ONLY the status text, or null.
-- ---------------------------------------------------------------------------
create or replace function public.get_survey_status_by_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select s.status from surveys s where s.public_slug = p_slug;
$$;

revoke all on function public.get_survey_status_by_slug(text) from public, anon, authenticated;
grant execute on function public.get_survey_status_by_slug(text) to anon, authenticated;

commit;
