-- Migration 003 : code d'accès unique + acceptation caution
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Nouvelles colonnes
alter table public.candidatures
  add column if not exists access_code     text unique,
  add column if not exists caution_accepted boolean default false;

-- 2. Générer des codes pour les candidatures déjà existantes
update public.candidatures
set access_code = upper(
  substr(md5(id::text || random()::text), 1, 4) || '-' ||
  substr(md5(random()::text || id::text), 1, 4)
)
where access_code is null;

-- 3. Fonction RPC : lire une candidature par son code (sans auth requise)
--    security definer = s'exécute avec les droits du propriétaire, contourne RLS
create or replace function public.get_candidature_by_access_code(p_code text)
returns table(
  id               uuid,
  business_name    text,
  status           text,
  contact_first_name text,
  contact_last_name  text,
  contact_email      text,
  product_category   text,
  candidature_type   text,
  created_at         timestamptz,
  rejection_reason   text,
  access_code        text,
  caution_accepted   boolean
)
security definer
language sql as $$
  select
    id, business_name, status,
    contact_first_name, contact_last_name, contact_email,
    product_category, candidature_type, created_at, rejection_reason,
    access_code, caution_accepted
  from public.candidatures
  where upper(trim(access_code)) = upper(trim(p_code))
  limit 1;
$$;

-- Accès public à la fonction
grant execute on function public.get_candidature_by_access_code(text) to anon, authenticated;
