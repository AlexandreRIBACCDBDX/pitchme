-- Migration 004 : messages anonymes + notifications email
-- Permet aux candidats (non authentifiés) d'envoyer/lire des messages
-- via des fonctions RPC security definer (contournement RLS)

-- 1. sender_id devient nullable (candidats anonymes n'ont pas d'auth.uid())
alter table public.messages alter column sender_id drop not null;

-- 2. Ajouter sender_role pour distinguer admin vs candidat
alter table public.messages
  add column if not exists sender_role text not null default 'admin';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_sender_role_check'
  ) then
    alter table public.messages
      add constraint messages_sender_role_check
      check (sender_role in ('admin', 'candidate'));
  end if;
end $$;

-- 3. Backfill : tous les messages existants sont de l'admin
update public.messages set sender_role = 'admin' where sender_role = 'admin';

-- 4. RPC : lire les messages d'une candidature via le code d'accès (candidat anonyme)
create or replace function get_messages_by_access_code(p_code text)
returns table(
  id          uuid,
  content     text,
  sender_role text,
  is_read     boolean,
  created_at  timestamptz
)
language sql
security definer
stable
as $$
  select m.id, m.content, m.sender_role, m.is_read, m.created_at
  from public.messages m
  join public.candidatures c on c.id = m.candidature_id
  where c.access_code = upper(trim(p_code))
  order by m.created_at asc;
$$;

grant execute on function get_messages_by_access_code(text) to anon, authenticated;

-- 5. RPC : envoyer un message en tant que candidat (via code d'accès)
create or replace function send_candidate_message(p_code text, p_content text)
returns void
language plpgsql
security definer
as $$
declare
  v_cand_id uuid;
begin
  select id into v_cand_id
  from public.candidatures
  where access_code = upper(trim(p_code));

  if v_cand_id is null then
    raise exception 'Code invalide';
  end if;

  if length(trim(p_content)) = 0 then
    raise exception 'Le message ne peut pas être vide';
  end if;

  insert into public.messages(candidature_id, sender_role, content)
  values (v_cand_id, 'candidate', trim(p_content));
end;
$$;

grant execute on function send_candidate_message(text, text) to anon, authenticated;
