-- ============================================================================
-- Migración 004: añade el campo "región" a los partners.
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ============================================================================

alter table public.partners
  add column if not exists region text;

create index if not exists idx_partners_region on public.partners (region);
