-- ============================================================================
-- Migración 001: función para versionar configuracion_comisiones de forma atómica.
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.versionar_configuracion_comisiones(
  p_base_escalon_1 numeric,
  p_base_escalon_2 numeric,
  p_base_escalon_3 numeric,
  p_umbral_escalon_1 integer,
  p_umbral_escalon_2 integer,
  p_bonus_dd numeric,
  p_bonus_fe numeric,
  p_sva_tarifa_baja numeric,
  p_sva_tarifa_alta numeric,
  p_sva_umbral_pct numeric
)
returns public.configuracion_comisiones
language plpgsql
security invoker
as $$
declare
  nueva public.configuracion_comisiones;
begin
  update public.configuracion_comisiones
  set vigente = false
  where vigente = true;

  insert into public.configuracion_comisiones (
    base_escalon_1, base_escalon_2, base_escalon_3,
    umbral_escalon_1, umbral_escalon_2,
    bonus_dd, bonus_fe,
    sva_tarifa_baja, sva_tarifa_alta, sva_umbral_pct,
    vigente, vigente_desde
  ) values (
    p_base_escalon_1, p_base_escalon_2, p_base_escalon_3,
    p_umbral_escalon_1, p_umbral_escalon_2,
    p_bonus_dd, p_bonus_fe,
    p_sva_tarifa_baja, p_sva_tarifa_alta, p_sva_umbral_pct,
    true, current_date
  )
  returning * into nueva;

  return nueva;
end;
$$;

grant execute on function public.versionar_configuracion_comisiones to authenticated;
