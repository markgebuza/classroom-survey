-- RLS / permission checks for the Classroom Survey database.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL Editor and click Run,
-- after both migrations in supabase/migrations/ have been applied.
--
-- WHAT IT DOES:
--   1. Starts a transaction and creates throw-away test data as the owner role
--      (one draft survey, one active survey with a question and two choices).
--   2. Switches to the `anon` role (what a student's browser uses) with
--      `set local role anon;` and tries reads/writes that must succeed or fail.
--   3. Switches to `authenticated` (the instructor) and checks full access.
--   4. Deletes the test data, re-activates whichever survey was active before,
--      commits, and prints one row per check with PASS/FAIL. (The SQL Editor only
--      shows the output of the LAST statement, so the results table is a session
--      temp table that is selected after the commit.) If any statement errors,
--      the transaction is aborted and nothing is changed.
--
-- Expected result: every row shows result = PASS.

drop table if exists pg_temp.rls_results;
drop table if exists pg_temp.rls_previous_active;

begin;

-- Collect results in a temp table that every role in this session may write to.
create temp table rls_results (n serial, check_name text, result text, detail text);
grant all on rls_results to anon, authenticated;
grant usage on sequence rls_results_n_seq to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Test data (as the owner). A currently active survey is closed for the test
-- and re-activated at the end.
-- ---------------------------------------------------------------------------
create temp table rls_previous_active as
    select id from public.surveys where status = 'active';
update public.surveys set status = 'closed' where status = 'active';

insert into public.surveys (id, title, status, public_slug) values
    ('00000000-0000-0000-0000-00000000d001', 'RLS test draft', 'draft', null),
    ('00000000-0000-0000-0000-00000000a001', 'RLS test active', 'active', 'rlstest1');
insert into public.questions (id, survey_id, question_text, question_type, position) values
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000a001', 'Q1', 'true_false', 1),
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000d001', 'Draft Q', 'true_false', 1);
insert into public.choices (id, question_id, choice_text, position) values
    ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000a1', 'True', 1),
    ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-0000000000a1', 'False', 2),
    ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-0000000000d1', 'True', 1);
insert into public.responses (id, survey_id, anonymous_token)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000a001', 'existing-token');
insert into public.answers (response_id, question_id, choice_id)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000c02');

-- ---------------------------------------------------------------------------
-- Student (anon) checks
-- ---------------------------------------------------------------------------
set local role anon;

do $$
declare n integer;
begin
    -- 1. anon sees active surveys only
    select count(*) into n from public.surveys where status <> 'active';
    insert into rls_results (check_name, result, detail)
    values ('anon reads only active surveys', case when n = 0 then 'PASS' else 'FAIL' end, n || ' non-active rows visible');

    select count(*) into n from public.surveys where id = '00000000-0000-0000-0000-00000000a001';
    insert into rls_results (check_name, result, detail)
    values ('anon can read the active survey', case when n = 1 then 'PASS' else 'FAIL' end, n || ' rows');

    -- 2. questions/choices of a draft survey are hidden
    select count(*) into n from public.questions where survey_id = '00000000-0000-0000-0000-00000000d001';
    insert into rls_results (check_name, result, detail)
    values ('anon cannot read draft questions', case when n = 0 then 'PASS' else 'FAIL' end, n || ' rows');

    select count(*) into n from public.choices where question_id = '00000000-0000-0000-0000-0000000000a1';
    insert into rls_results (check_name, result, detail)
    values ('anon can read active choices', case when n = 2 then 'PASS' else 'FAIL' end, n || ' rows');
end $$;

-- 3. responses / answers are not readable
do $$
declare n integer;
begin
    begin
        select count(*) into n from public.responses;
        insert into rls_results (check_name, result, detail)
        values ('anon cannot read responses', case when n = 0 then 'PASS' else 'FAIL' end, n || ' rows visible');
    exception when insufficient_privilege then
        insert into rls_results (check_name, result, detail)
        values ('anon cannot read responses', 'PASS', 'permission denied');
    end;

    begin
        select count(*) into n from public.answers;
        insert into rls_results (check_name, result, detail)
        values ('anon cannot read answers', case when n = 0 then 'PASS' else 'FAIL' end, n || ' rows visible');
    exception when insufficient_privilege then
        insert into rls_results (check_name, result, detail)
        values ('anon cannot read answers', 'PASS', 'permission denied');
    end;
end $$;

-- 4. writes to survey tables are rejected
do $$
declare n integer;
begin
    begin
        insert into public.surveys (title) values ('hacked');
        insert into rls_results (check_name, result, detail) values ('anon cannot insert surveys', 'FAIL', 'insert succeeded');
    exception when insufficient_privilege then
        insert into rls_results (check_name, result, detail) values ('anon cannot insert surveys', 'PASS', sqlerrm);
    end;

    begin
        update public.surveys set title = 'hacked' where id = '00000000-0000-0000-0000-00000000a001';
        get diagnostics n = row_count;
        insert into rls_results (check_name, result, detail)
        values ('anon cannot update surveys', case when n = 0 then 'PASS' else 'FAIL' end, n || ' rows updated');
    exception when insufficient_privilege then
        insert into rls_results (check_name, result, detail) values ('anon cannot update surveys', 'PASS', sqlerrm);
    end;

    begin
        insert into public.responses (survey_id, anonymous_token)
        values ('00000000-0000-0000-0000-00000000a001', 'direct-insert');
        insert into rls_results (check_name, result, detail) values ('anon cannot insert responses directly', 'FAIL', 'insert succeeded');
    exception when insufficient_privilege then
        insert into rls_results (check_name, result, detail) values ('anon cannot insert responses directly', 'PASS', sqlerrm);
    end;

    begin
        perform public.get_survey_results('00000000-0000-0000-0000-00000000a001');
        insert into rls_results (check_name, result, detail) values ('anon cannot call get_survey_results', 'FAIL', 'call succeeded');
    exception when insufficient_privilege then
        insert into rls_results (check_name, result, detail) values ('anon cannot call get_survey_results', 'PASS', sqlerrm);
    end;

    begin
        perform public.activate_survey('00000000-0000-0000-0000-00000000d001');
        insert into rls_results (check_name, result, detail) values ('anon cannot call activate_survey', 'FAIL', 'call succeeded');
    exception when insufficient_privilege then
        insert into rls_results (check_name, result, detail) values ('anon cannot call activate_survey', 'PASS', sqlerrm);
    end;
end $$;

-- 5. anon CAN submit through the RPC, and validation errors use the fixed codes
do $$
declare r jsonb;
begin
    r := public.submit_survey_response(
        '00000000-0000-0000-0000-00000000a001', 'student-token-1',
        '[{"question_id":"00000000-0000-0000-0000-0000000000a1","choice_id":"00000000-0000-0000-0000-000000000c01"}]'::jsonb);
    insert into rls_results (check_name, result, detail)
    values ('anon can call submit_survey_response', case when (r ->> 'success')::boolean then 'PASS' else 'FAIL' end, r::text);

    begin
        perform public.submit_survey_response(
            '00000000-0000-0000-0000-00000000a001', 'student-token-1',
            '[{"question_id":"00000000-0000-0000-0000-0000000000a1","choice_id":"00000000-0000-0000-0000-000000000c01"}]'::jsonb);
        insert into rls_results (check_name, result, detail) values ('second submission is rejected', 'FAIL', 'accepted');
    exception when others then
        insert into rls_results (check_name, result, detail)
        values ('second submission is rejected', case when sqlerrm = 'DUPLICATE_RESPONSE' then 'PASS' else 'FAIL' end, sqlerrm);
    end;

    begin
        perform public.submit_survey_response('00000000-0000-0000-0000-00000000d001', 'student-token-2', '[]'::jsonb);
        insert into rls_results (check_name, result, detail) values ('submit to draft survey is rejected', 'FAIL', 'accepted');
    exception when others then
        insert into rls_results (check_name, result, detail)
        values ('submit to draft survey is rejected', case when sqlerrm = 'SURVEY_NOT_ACTIVE' then 'PASS' else 'FAIL' end, sqlerrm);
    end;

    begin
        perform public.submit_survey_response('00000000-0000-0000-0000-00000000a001', 'student-token-3', '[]'::jsonb);
        insert into rls_results (check_name, result, detail) values ('empty answers are rejected', 'FAIL', 'accepted');
    exception when others then
        insert into rls_results (check_name, result, detail)
        values ('empty answers are rejected', case when sqlerrm = 'MISSING_REQUIRED_ANSWER' then 'PASS' else 'FAIL' end, sqlerrm);
    end;

    begin
        perform public.submit_survey_response(
            '00000000-0000-0000-0000-00000000a001', 'student-token-4',
            '[{"question_id":"00000000-0000-0000-0000-0000000000d1","choice_id":"00000000-0000-0000-0000-000000000c03"}]'::jsonb);
        insert into rls_results (check_name, result, detail) values ('question from another survey is rejected', 'FAIL', 'accepted');
    exception when others then
        insert into rls_results (check_name, result, detail)
        values ('question from another survey is rejected', case when sqlerrm = 'INVALID_QUESTION' then 'PASS' else 'FAIL' end, sqlerrm);
    end;

    begin
        perform public.submit_survey_response(
            '00000000-0000-0000-0000-00000000a001', 'student-token-5',
            '[{"question_id":"00000000-0000-0000-0000-0000000000a1","choice_id":"00000000-0000-0000-0000-000000000c03"}]'::jsonb);
        insert into rls_results (check_name, result, detail) values ('choice from another question is rejected', 'FAIL', 'accepted');
    exception when others then
        insert into rls_results (check_name, result, detail)
        values ('choice from another question is rejected', case when sqlerrm = 'INVALID_CHOICE' then 'PASS' else 'FAIL' end, sqlerrm);
    end;

    insert into rls_results (check_name, result, detail)
    values ('get_survey_status_by_slug returns status only',
            case when public.get_survey_status_by_slug('rlstest1') = 'active' then 'PASS' else 'FAIL' end,
            coalesce(public.get_survey_status_by_slug('rlstest1'), 'null'));
end $$;

-- ---------------------------------------------------------------------------
-- Instructor (authenticated) checks
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;

do $$
declare n integer; r jsonb;
begin
    select count(*) into n from public.surveys where id in
        ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a001');
    insert into rls_results (check_name, result, detail)
    values ('authenticated reads all surveys', case when n = 2 then 'PASS' else 'FAIL' end, n || ' rows');

    select count(*) into n from public.responses where survey_id = '00000000-0000-0000-0000-00000000a001';
    insert into rls_results (check_name, result, detail)
    values ('authenticated reads responses', case when n = 2 then 'PASS' else 'FAIL' end, n || ' rows');

    r := public.get_survey_results('00000000-0000-0000-0000-00000000a001');
    insert into rls_results (check_name, result, detail)
    values ('authenticated gets results (2 responses, True = 50%)',
            case when (r ->> 'response_count')::int = 2
                  and (r -> 'questions' -> 0 -> 'choices' -> 0 ->> 'percentage')::numeric = 50.0
                 then 'PASS' else 'FAIL' end,
            r::text);

    r := public.activate_survey('00000000-0000-0000-0000-00000000d001');
    select count(*) into n from public.surveys where status = 'active';
    insert into rls_results (check_name, result, detail)
    values ('activate_survey leaves exactly one active survey with a slug',
            case when n = 1 and length(r ->> 'public_slug') = 8 then 'PASS' else 'FAIL' end, r::text);

    update public.surveys set title = 'RLS test draft (edited)' where id = '00000000-0000-0000-0000-00000000d001';
    get diagnostics n = row_count;
    insert into rls_results (check_name, result, detail)
    values ('authenticated can update surveys', case when n = 1 then 'PASS' else 'FAIL' end, n || ' rows');
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Clean up (cascades remove test questions, choices, responses, answers)
-- ---------------------------------------------------------------------------
delete from public.surveys where id in
    ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a001');
update public.surveys set status = 'active' where id in (select id from rls_previous_active);

commit;

select n, check_name, result, detail from rls_results order by n;
