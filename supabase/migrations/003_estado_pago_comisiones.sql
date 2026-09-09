-- ============================================================================
-- Migración 003: trazabilidad de pago de comisiones (pendiente/pagado).
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ============================================================================

alter table public.comisiones
  add column if not exists estado_pago text not null default 'pendiente'
    check (estado_pago in ('pendiente', 'pagado')),
  add column if not exists fecha_pago date;

create index if not exists idx_comisiones_estado_pago on public.comisiones (estado_pago);
