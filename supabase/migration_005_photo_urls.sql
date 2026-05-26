-- Migration 005 : stocker les URLs de photos directement dans candidatures
-- Plus besoin de passer par la table documents pour les photos de produits

alter table public.candidatures
  add column if not exists photo_urls text[] default '{}';
