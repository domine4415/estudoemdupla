-- Execute no SQL Editor do Supabase. Preserva os dados existentes.
create table if not exists public.policial_notices (
 id uuid primary key default gen_random_uuid(),
 title text not null, description text not null default '',
 sections jsonb not null default '[]', published boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.policial_notice_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 notice_id uuid not null references public.policial_notices(id) on delete cascade,
 favorite boolean not null default false,completed text[] not null default '{}',
 updated_at timestamptz not null default now(),primary key(user_id,notice_id)
);
alter table public.policial_notices enable row level security;
alter table public.policial_notice_progress enable row level security;
revoke all on public.policial_notices,public.policial_notice_progress from anon,authenticated;
grant select,insert,update,delete on public.policial_notices,public.policial_notice_progress to service_role;
create or replace function public.policial_update_notice_progress(p_user uuid,p_notice uuid,p_topic text default null,p_done boolean default false,p_favorite boolean default null)
returns void language sql security definer set search_path=public as $$
 insert into public.policial_notice_progress(user_id,notice_id,favorite,completed)
 values(p_user,p_notice,coalesce(p_favorite,false),case when p_topic is not null and p_done then array[p_topic] else '{}'::text[] end)
 on conflict(user_id,notice_id) do update set
 favorite=coalesce(p_favorite,policial_notice_progress.favorite),
 completed=case when p_topic is null then policial_notice_progress.completed
 when p_done then array(select distinct unnest(array_append(policial_notice_progress.completed,p_topic)))
 else array_remove(policial_notice_progress.completed,p_topic) end,updated_at=now();
$$;
revoke all on function public.policial_update_notice_progress(uuid,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.policial_update_notice_progress(uuid,uuid,text,boolean,boolean) to service_role;
