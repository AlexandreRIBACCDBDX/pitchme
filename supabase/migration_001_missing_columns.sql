-- Migration 001 : colonnes manquantes pour candidatures + table app_settings + fix trigger
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Colonnes manquantes sur la table candidatures
alter table public.candidatures
  add column if not exists instagram_url text,
  add column if not exists candidature_type text not null default 'market',
  add column if not exists foodtruck_data jsonb;

-- 2. Table app_settings (module food truck activé/désactivé par l'admin)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

-- Valeur par défaut : food truck désactivé
insert into public.app_settings (key, value)
values ('foodtruck_module', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

-- RLS sur app_settings : tout le monde peut lire, seuls les admins écrivent
alter table public.app_settings enable row level security;

create policy "Everyone can read app_settings" on public.app_settings
  for select using (true);

create policy "Admins can update app_settings" on public.app_settings
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 3. Fix trigger : sauvegarder first_name, last_name, phone à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'candidate')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Remplir les noms manquants pour les comptes déjà créés
-- (les données viennent de auth.users.raw_user_meta_data)
update public.profiles p
set
  first_name = coalesce(p.first_name, u.raw_user_meta_data->>'first_name'),
  last_name  = coalesce(p.last_name,  u.raw_user_meta_data->>'last_name'),
  phone      = coalesce(p.phone,      u.raw_user_meta_data->>'phone')
from auth.users u
where p.id = u.id
  and (p.first_name is null or p.last_name is null);
