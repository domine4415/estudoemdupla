-- ESTUDO POLICIAL: aulas de teoria. Execute no SQL Editor do Supabase.
-- Não altera questões, salas ou respostas existentes.
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
alter table public.policial_lessons enable row level security;
revoke all on public.policial_lessons from anon,authenticated;
grant select,insert,update,delete on public.policial_lessons to service_role;
