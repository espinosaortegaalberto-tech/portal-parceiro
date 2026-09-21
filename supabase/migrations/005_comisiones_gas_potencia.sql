-- ============================================================================
-- Migración 005: comisiones de gas en paralelo a electricidad + override de
-- potencia contratada para electricidad.
-- Ejecutar manualmente en el SQL Editor de Supabase.
--
-- Modelo:
-- - Un contrato puede ser de electricidad, de gas, o de ambos (dual). Se marca
--   con dos columnas booleanas independientes en `ventas` (sustituyen al uso
--   de `producto` para el cálculo; `producto` se mantiene como campo libre).
-- - Para un contrato dual se calculan y pagan comisión de electricidad Y de
--   gas, cada una con exactamente la misma lógica (escalado + bonus DD/FE +
--   bonus SVA), usando los MISMOS parámetros de configuracion_comisiones.
-- - Electricidad: si potencia_kva > 20,7, la base de ESE contrato pasa a ser
--   60€ fijos, sin importar el escalón de volumen del partner ese mes.
-- ============================================================================

-- 1. Ventas: soporte de contrato dual + potencia contratada.
alter table public.ventas
  add column if not exists electricidad boolean not null default true,
  add column if not exists gas boolean not null default false,
  add column if not exists potencia_kva numeric(6, 2);

-- 2. Comisiones: separar el desglose existente en "_luz" y añadir "_gas" en paralelo.
--    n_contratos (nº de ventas físicas) y total_comision (gran total luz+gas)
--    mantienen su nombre y su rol de siempre.
alter table public.comisiones rename column escalon_aplicado to escalon_luz;
alter table public.comisiones rename column base_aplicada to base_luz;
alter table public.comisiones rename column n_dd to n_dd_luz;
alter table public.comisiones rename column n_fe to n_fe_luz;
alter table public.comisiones rename column n_sva to n_sva_luz;
alter table public.comisiones rename column pct_sva to pct_sva_luz;
alter table public.comisiones rename column tarifa_sva_aplicada to tarifa_sva_luz;
alter table public.comisiones rename column total_base to total_base_luz;
alter table public.comisiones rename column total_bonus_dd to total_bonus_dd_luz;
alter table public.comisiones rename column total_bonus_fe to total_bonus_fe_luz;
alter table public.comisiones rename column total_bonus_sva to total_bonus_sva_luz;

alter table public.comisiones
  add column if not exists n_contratos_luz integer not null default 0,
  add column if not exists total_comision_luz numeric(12, 2) not null default 0,
  add column if not exists n_alta_potencia integer not null default 0;

alter table public.comisiones
  add column if not exists n_contratos_gas integer not null default 0,
  add column if not exists escalon_gas integer,
  add column if not exists base_gas numeric(10, 2),
  add column if not exists n_dd_gas integer not null default 0,
  add column if not exists n_fe_gas integer not null default 0,
  add column if not exists n_sva_gas integer not null default 0,
  add column if not exists pct_sva_gas numeric(5, 2),
  add column if not exists tarifa_sva_gas numeric(10, 2),
  add column if not exists total_base_gas numeric(12, 2) not null default 0,
  add column if not exists total_bonus_dd_gas numeric(12, 2) not null default 0,
  add column if not exists total_bonus_fe_gas numeric(12, 2) not null default 0,
  add column if not exists total_bonus_sva_gas numeric(12, 2) not null default 0,
  add column if not exists total_comision_gas numeric(12, 2) not null default 0;
