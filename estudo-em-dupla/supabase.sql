-- ESTUDO POLICIAL: armazenamento persistente das salas.
-- Execute no SQL Editor do Supabase, uma única vez.
create table if not exists public.dupla_rooms (
    code text primary key,
    state jsonb not null,
    updated_at timestamptz not null default now(),
    constraint dupla_rooms_code_format check (code ~ '^[A-Z2-9]{6}$')
);

-- A tabela não fica disponível para visitantes anônimos.
-- Apenas o servidor do aplicativo, com chave secreta, acessa os dados.
alter table public.dupla_rooms enable row level security;
revoke all on table public.dupla_rooms from anon, authenticated;
grant select, insert, update, delete on table public.dupla_rooms to service_role;

create index if not exists dupla_rooms_updated_at_idx
on public.dupla_rooms(updated_at desc);
