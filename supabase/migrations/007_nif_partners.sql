-- ============================================================================
-- Migración 007: añade el campo "NIF" a los partners.
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ============================================================================

alter table public.partners
  add column if not exists nif text;
