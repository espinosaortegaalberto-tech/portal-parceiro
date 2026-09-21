-- ============================================================================
-- Migración 006: hace configurables el umbral de potencia contratada y la
-- base de comisión de alta potencia para electricidad (antes fijos en código).
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ============================================================================

alter table public.configuracion_comisiones
  add column if not exists potencia_umbral_kva numeric(6, 2) not null default 20.7,
  add column if not exists base_alta_potencia numeric(10, 2) not null default 60;

-- Actualiza la función de versionado para incluir los dos nuevos parámetros.
-- Se elimina primero la versión anterior (10 argumentos): al cambiar la firma,
-- "create or replace" crearía una sobrecarga nueva en vez de sustituirla.
drop function if exists public.versionar_configuracion_comisiones(
  numeric, numeric, numeric, integer, integer, numeric, numeric, numeric, numeric, numeric
);

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
  p_sva_umbral_pct numeric,
  p_potencia_umbral_kva numeric,
  p_base_alta_potencia numeric
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
    potencia_umbral_kva, base_alta_potencia,
    vigente, vigente_desde
  ) values (
    p_base_escalon_1, p_base_escalon_2, p_base_escalon_3,
    p_umbral_escalon_1, p_umbral_escalon_2,
    p_bonus_dd, p_bonus_fe,
    p_sva_tarifa_baja, p_sva_tarifa_alta, p_sva_umbral_pct,
    p_potencia_umbral_kva, p_base_alta_potencia,
    true, current_date
  )
  returning * into nueva;

  return nueva;
end;
$$;

grant execute on function public.versionar_configuracion_comisiones to authenticated;
