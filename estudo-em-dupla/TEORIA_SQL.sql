-- ESTUDO POLICIAL: aulas de teoria. Execute no SQL Editor do Supabase.
-- Não altera questões, salas ou respostas existentes.
-- Vinculação das questões é adicionada abaixo, após a criação da tabela.
create table if not exists public.policial_lessons (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 subject text not null,
 topic text not null,
 content text not null default '',
 images jsonb not null default '{}',
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists policial_lessons_catalog on public.policial_lessons(published,subject,topic);
alter table public.policial_lessons add column if not exists question_ids uuid[] not null default '{}';
alter table public.policial_lessons enable row level security;
revoke all on public.policial_lessons from anon,authenticated;
grant select,insert,update,delete on public.policial_lessons to service_role;

-- Grifos pessoais por conta e aula. Pode executar novamente este arquivo.
create table if not exists public.policial_lesson_highlights (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null references public.policial_lessons(id) on delete cascade,
 marks jsonb not null default '[]',
 updated_at timestamptz not null default now(),
 primary key(user_id,lesson_id)
);
alter table public.policial_lesson_highlights enable row level security;
revoke all on public.policial_lesson_highlights from anon,authenticated;
grant select,insert,update,delete on public.policial_lesson_highlights to service_role;

-- Hierarquia opcional das aulas, preservando os registros existentes.
alter table public.policial_lessons add column if not exists subtopic text not null default '';

create table if not exists public.policial_contests (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 image_url text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.policial_contests enable row level security;
revoke all on public.policial_contests from anon,authenticated;
grant select,insert,update,delete on public.policial_contests to service_role;
alter table public.policial_lessons add column if not exists contest_id uuid references public.policial_contests(id) on delete set null;
create index if not exists policial_lessons_contest on public.policial_lessons(contest_id);

-- Uma única aula pode ser compartilhada entre vários concursos.
alter table public.policial_lessons add column if not exists contest_ids uuid[] not null default '{}';
update public.policial_lessons set contest_ids=array[contest_id]
where contest_id is not null and cardinality(contest_ids)=0;
create index if not exists policial_lessons_contest_ids on public.policial_lessons using gin(contest_ids);
