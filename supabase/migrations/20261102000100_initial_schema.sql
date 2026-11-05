-- Classroom Survey: initial schema (DATABASE.md §3–§10)
-- Run in the Supabase SQL Editor (or `supabase db push`) BEFORE 20261102000200_rpc_functions.sql.
-- Safe to re-run: objects are created with IF NOT EXISTS / dropped and recreated.

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.surveys (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed', 'archived')),
    public_slug text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.questions (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references public.surveys(id) on delete cascade,
    question_text text not null,
    question_type text not null
        check (question_type in ('multiple_choice', 'true_false')),
    position integer not null,
    created_at timestamptz not null default now(),
    -- Safe with the editor's delete-and-reinsert save strategy (DECISIONS.md D8, D12).
    constraint questions_survey_position_key unique (survey_id, position)
);

create table if not exists public.choices (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references public.questions(id) on delete cascade,
    choice_text text not null,
    position integer not null,
    created_at timestamptz not null default now(),
    constraint choices_question_position_key unique (question_id, position)
);

create table if not exists public.responses (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references public.surveys(id) on delete cascade,
    anonymous_token text,
    submitted_at timestamptz not null default now()
);

create table if not exists public.answers (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references public.responses(id) on delete cascade,
    question_id uuid not null references public.questions(id) on delete cascade,
    choice_id uuid references public.choices(id) on delete set null,
    text_answer text,
    created_at timestamptz not null default now(),
    unique (response_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists surveys_status_idx on public.surveys(status);
create index if not exists questions_survey_id_idx on public.questions(survey_id);
create index if not exists choices_question_id_idx on public.choices(question_id);
create index if not exists responses_survey_id_idx on public.responses(survey_id);
create index if not exists responses_submitted_at_idx on public.responses(submitted_at);
create index if not exists answers_response_id_idx on public.answers(response_id);
create index if not exists answers_question_id_idx on public.answers(question_id);
create index if not exists answers_choice_id_idx on public.answers(choice_id);

-- One response per browser token per survey (TODO Phase 8).
create unique index if not exists responses_unique_student_per_survey
    on public.responses(survey_id, anonymous_token)
    where anonymous_token is not null;

-- At most one active survey (DATABASE.md §5).
create unique index if not exists only_one_active_survey
    on public.surveys ((status))
    where status = 'active';

-- ---------------------------------------------------------------------------
-- updated_at trigger (DATABASE.md §4)
-- ---------------------------------------------------------------------------

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists surveys_updated_at on public.surveys;
create trigger surveys_updated_at
before update on public.surveys
for each row
execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table privileges
-- Supabase grants ALL on new public tables to anon by default. Remove everything
-- anon does not need so that RLS is a second line of defence, not the only one.
-- ---------------------------------------------------------------------------

revoke all on public.surveys, public.questions, public.choices,
              public.responses, public.answers from anon;
grant select on public.surveys, public.questions, public.choices to anon;

grant select, insert, update, delete on public.surveys, public.questions, public.choices,
      public.responses, public.answers to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (DATABASE.md §7)
-- ---------------------------------------------------------------------------

alter table public.surveys enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.responses enable row level security;
alter table public.answers enable row level security;

-- Students (anon): read ACTIVE surveys and their questions/choices only (§8).
-- No anon policies exist on responses/answers, so anon can neither read nor write them;
-- students submit only through submit_survey_response().

drop policy if exists "students read active surveys" on public.surveys;
create policy "students read active surveys"
on public.surveys
for select
to anon
using (status = 'active');

drop policy if exists "students read active survey questions" on public.questions;
create policy "students read active survey questions"
on public.questions
for select
to anon
using (
    exists (
        select 1
        from public.surveys
        where surveys.id = questions.survey_id
          and surveys.status = 'active'
    )
);

drop policy if exists "students read active survey choices" on public.choices;
create policy "students read active survey choices"
on public.choices
for select
to anon
using (
    exists (
        select 1
        from public.questions
        join public.surveys on surveys.id = questions.survey_id
        where questions.id = choices.question_id
          and surveys.status = 'active'
    )
);

-- Instructor (authenticated): full access (§10). Public sign-ups MUST be disabled
-- in Supabase Auth so that every authenticated user is an instructor (DECISIONS.md D4).

drop policy if exists "authenticated users manage surveys" on public.surveys;
create policy "authenticated users manage surveys"
on public.surveys for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users manage questions" on public.questions;
create policy "authenticated users manage questions"
on public.questions for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users manage choices" on public.choices;
create policy "authenticated users manage choices"
on public.choices for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users manage responses" on public.responses;
create policy "authenticated users manage responses"
on public.responses for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users manage answers" on public.answers;
create policy "authenticated users manage answers"
on public.answers for all to authenticated using (true) with check (true);

commit;
