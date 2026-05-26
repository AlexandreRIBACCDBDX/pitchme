-- Migration 001 : colonnes manquantes pour candidatures + table app_settings
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
