-- Migration 002 : candidatures anonymes — suppression auth candidats
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. user_id nullable (soumission sans compte)
alter table public.candidatures alter column user_id drop not null;

-- 2. Champs de contact directement sur la candidature
alter table public.candidatures
  add column if not exists contact_first_name text,
  add column if not exists contact_last_name  text,
  add column if not exists contact_email      text,
  add column if not exists contact_phone      text;

-- 3. documents.uploaded_by nullable (upload sans compte)
alter table public.documents alter column uploaded_by drop not null;

-- 4. RLS candidatures : insertion publique sans auth
drop policy if exists "Candidates can create candidatures" on public.candidatures;
create policy "Anyone can submit a candidature" on public.candidatures
  for insert with check (true);

-- 5. RLS documents : insertion publique sans auth
drop policy if exists "Users can upload documents" on public.documents;
create policy "Anyone can upload documents" on public.documents
  for insert with check (true);

-- 6. RLS candidatures : lecture publique par email de contact (optionnel)
-- Les candidats n'ont plus de compte donc pas de lecture nécessaire côté candidat.
-- L'admin voit tout via la policy existante "Admins can view all candidatures".
