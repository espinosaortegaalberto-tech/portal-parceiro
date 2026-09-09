-- ============================================================================
-- Migración 002: vistas agregadas para la pantalla de seguimiento de ventas.
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- security_invoker = true: la vista respeta el RLS de la tabla `ventas`
-- (se ejecuta con los permisos del usuario que consulta, no del propietario).
-- ============================================================================

create or replace view public.vista_ventas_periodo
with (security_invoker = true) as
select
  periodo,
  count(*) as n_ventas,
  coalesce(sum(importe_contrato), 0) as importe_total
from public.ventas
group by periodo
order by periodo;

create or replace view public.vista_ventas_partner_periodo
with (security_invoker = true) as
select
  id_partner,
  periodo,
  count(*) as n_ventas,
  coalesce(sum(importe_contrato), 0) as importe_total
from public.ventas
group by id_partner, periodo
order by periodo, id_partner;

grant select on public.vista_ventas_periodo to authenticated;
grant select on public.vista_ventas_partner_periodo to authenticated;
