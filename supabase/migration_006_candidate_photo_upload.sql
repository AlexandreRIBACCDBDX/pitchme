-- Migration 006 : permettre au candidat d'ajouter des photos depuis son espace
-- et mettre à jour get_candidature_by_access_code pour retourner photo_urls

-- 1. Mise à jour de la RPC get_candidature_by_access_code
--    pour inclure photo_urls dans les champs retournés
create or replace function public.get_candidature_by_access_code(p_code text)
returns table(
  id                 uuid,
  business_name      text,
  status             text,
  contact_first_name text,
  contact_last_name  text,
  contact_email      text,
  product_category   text,
  candidature_type   text,
  created_at         timestamptz,
  rejection_reason   text,
  access_code        text,
  caution_accepted   boolean,
  photo_urls         text[]
)
security definer
language sql as $$
  select
    id, business_name, status,
    contact_first_name, contact_last_name, contact_email,
    product_category, candidature_type, created_at, rejection_reason,
    access_code, caution_accepted,
    coalesce(photo_urls, '{}')
  from public.candidatures
  where upper(trim(access_code)) = upper(trim(p_code))
  limit 1;
$$;

grant execute on function public.get_candidature_by_access_code(text) to anon, authenticated;

-- 2. RPC pour ajouter des URLs de photos à une candidature (depuis l'espace candidat)
create or replace function add_photos_to_candidature(p_code text, p_urls text[])
returns void
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.candidatures
  where access_code = upper(trim(p_code));

  if v_id is null then
    raise exception 'Code invalide';
  end if;

  if array_length(p_urls, 1) is null or array_length(p_urls, 1) = 0 then
    raise exception 'Aucune URL fournie';
  end if;

  update public.candidatures
  set photo_urls = array_cat(coalesce(photo_urls, '{}'), p_urls)
  where id = v_id;
end;
$$;

grant execute on function add_photos_to_candidature(text, text[]) to anon, authenticated;
