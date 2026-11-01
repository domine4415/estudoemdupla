-- ESTUDO POLICIAL — BANCO DE QUESTÕES INDIVIDUAL
-- Cole todo este arquivo no Supabase > SQL Editor > New query > Run.
-- Não apaga suas salas nem o histórico delas.

create table if not exists public.dupla_bank_questions (
    id uuid primary key default gen_random_uuid(),
    fingerprint text not null unique,
    subject text not null default 'Não classificada',
    topic text not null default 'Geral',
    board text not null default '',
    exam_year smallint,
    statement text not null,
    data jsonb not null,
    has_key boolean not null default false,
    has_commentary boolean not null default false,
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.dupla_bank_attempts (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    question_id uuid not null references public.dupla_bank_questions(id) on delete cascade,
    choice text not null,
    is_correct boolean,
    answered_at timestamptz not null default now()
);

create index if not exists dupla_bank_questions_filters_idx
 on public.dupla_bank_questions(published,subject,topic,board,exam_year);
create index if not exists dupla_bank_attempts_user_idx
 on public.dupla_bank_attempts(user_id,question_id,answered_at desc,id desc);

alter table public.dupla_bank_questions enable row level security;
alter table public.dupla_bank_attempts enable row level security;
revoke all on public.dupla_bank_questions from anon, authenticated;
revoke all on public.dupla_bank_attempts from anon, authenticated;
grant select,insert,update,delete on public.dupla_bank_questions to service_role;
grant select,insert,update,delete on public.dupla_bank_attempts to service_role;
grant usage,select on sequence public.dupla_bank_attempts_id_seq to service_role;

create or replace function public.dupla_bank_facets()
returns jsonb language sql stable security invoker set search_path = public as $$
select jsonb_build_object(
  'subjects', coalesce((select jsonb_agg(s.subject order by s.subject) from
   (select distinct subject from dupla_bank_questions where published=true) s),'[]'::jsonb),
  'pairs', coalesce((select jsonb_agg(jsonb_build_object('subject',p.subject,'topic',p.topic) order by p.subject,p.topic) from
   (select distinct subject,topic from dupla_bank_questions where published=true) p),'[]'::jsonb),
  'boards', coalesce((select jsonb_agg(b.board order by b.board) from
   (select distinct board from dupla_bank_questions where published=true and board <> '') b),'[]'::jsonb),
  'years', coalesce((select jsonb_agg(y.exam_year order by y.exam_year desc) from
   (select distinct exam_year from dupla_bank_questions where published=true and exam_year is not null) y),'[]'::jsonb)
);
$$;

create or replace function public.dupla_bank_progress(target_user uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
with last_answer as (
 select distinct on (question_id) question_id, is_correct
 from dupla_bank_attempts where user_id=target_user
 order by question_id, answered_at desc, id desc
)
select jsonb_build_object(
 'total',(select count(*) from dupla_bank_questions where published=true),
 'answered',count(*),
 'correct',count(*) filter (where is_correct=true),
 'wrong',count(*) filter (where is_correct=false)
) from last_answer;
$$;

revoke all on function public.dupla_bank_facets() from public,anon,authenticated;
revoke all on function public.dupla_bank_progress(uuid) from public,anon,authenticated;
grant execute on function public.dupla_bank_facets() to service_role;
grant execute on function public.dupla_bank_progress(uuid) to service_role;
