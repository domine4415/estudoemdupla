-- ESTUDO POLICIAL: perfis, presença, amizades, convites e troféus.
-- Execute no SQL Editor do Supabase. Não altera questões ou aulas.
create table if not exists public.policial_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(display_name) between 2 and 60),
 bio text not null default '' check(char_length(bio)<=2000),
 invisible boolean not null default false,
 last_active timestamptz,
 last_seen_public timestamptz,
 answered integer not null default 0,
 correct integer not null default 0,
 streak integer not null default 0,
 best_streak integer not null default 0
);
create table if not exists public.policial_friendships (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references public.policial_profiles(user_id) on delete cascade,
 recipient uuid not null references public.policial_profiles(user_id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),check(sender<>recipient)
);
create unique index if not exists policial_friend_pair on public.policial_friendships(least(sender,recipient),greatest(sender,recipient));
create table if not exists public.policial_invitations (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references public.policial_profiles(user_id) on delete cascade,
 recipient uuid not null references public.policial_profiles(user_id) on delete cascade,
 room_code text not null references public.dupla_rooms(code) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '30 minutes'),
 unique(sender,recipient,room_code),check(sender<>recipient)
);
create table if not exists public.policial_room_answers (
 user_id uuid not null references public.policial_profiles(user_id) on delete cascade,
 room_code text not null,
 question_key text not null,
 is_correct boolean not null,
 answered_at timestamptz not null default now(),
 primary key(user_id,room_code,question_key)
);
alter table public.policial_room_answers add column if not exists subject text not null default '';
alter table public.policial_room_answers add column if not exists topic text not null default '';
alter table public.policial_room_answers add column if not exists board text not null default '';
create table if not exists public.policial_trophies (
 user_id uuid not null references public.policial_profiles(user_id) on delete cascade,
 trophy_key text not null,
 earned_at timestamptz not null default now(),
 primary key(user_id,trophy_key)
);
drop function if exists public.policial_record_room_answer(uuid,text,text,boolean);
create or replace function public.policial_record_room_answer(p_user uuid,p_room text,p_question text,p_correct boolean,p_subject text default '',p_topic text default '',p_board text default '')
returns void language plpgsql security definer set search_path=public as $$
declare added integer; p policial_profiles%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 insert into policial_room_answers(user_id,room_code,question_key,is_correct,subject,topic,board) values(p_user,p_room,p_question,p_correct,p_subject,p_topic,p_board) on conflict do nothing;
 get diagnostics added=row_count;if added=0 then return;end if;
 update policial_profiles set answered=answered+1,correct=correct+case when p_correct then 1 else 0 end,
 streak=case when p_correct then streak+1 else 0 end,
 best_streak=greatest(best_streak,case when p_correct then streak+1 else 0 end)
 where user_id=p_user returning * into p;
 insert into policial_trophies(user_id,trophy_key)
 select p_user,key from (values ('primeira',p.answered>=1),('cem',p.answered>=100),('mil',p.answered>=1000),('sequencia10',p.best_streak>=10),('sequencia20',p.best_streak>=20)) as awards(key,earned)
 where earned on conflict do nothing;
end;$$;
revoke all on function public.policial_record_room_answer(uuid,text,text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.policial_record_room_answer(uuid,text,text,boolean,text,text,text) to service_role;
alter table public.policial_profiles enable row level security;
alter table public.policial_friendships enable row level security;
alter table public.policial_invitations enable row level security;
alter table public.policial_room_answers enable row level security;
alter table public.policial_trophies enable row level security;
revoke all on public.policial_profiles,public.policial_friendships,public.policial_invitations,public.policial_room_answers,public.policial_trophies from anon,authenticated;
grant select,insert,update,delete on public.policial_profiles,public.policial_friendships,public.policial_invitations,public.policial_room_answers,public.policial_trophies to service_role;
create index if not exists policial_profiles_presence on public.policial_profiles(last_active desc) where invisible=false;
alter table public.policial_profiles add column if not exists avatar_data text not null default '';
