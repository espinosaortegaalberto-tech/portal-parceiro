-- ============================================================================
-- Datos de ejemplo (DEMO) para revisar el portal con contenido realista.
-- NO ejecutar en producción. Pensado para desarrollo/pruebas.
-- Crea 6 partners, varía sus checks de onboarding, carga ventas de dos
-- periodos (2026-01 y 2026-02) y calcula sus comisiones con la configuración
-- vigente en el momento de ejecutar el script.
-- ============================================================================

-- 1. Partners de ejemplo
insert into public.partners (id, nombre_empresa, direccion, email, telefono, contacto, sector, url_web, estado, categoria, fecha_alta)
values
  ('P-0001', 'Comercial Luz Norte SL', 'Calle Mayor 12, Bilbao', 'contacto@luznorte.example', '944123456', 'Ainhoa Etxeberria', 'Luz y Gas', 'https://luznorte.example', 'activo', 'Oro', '2025-03-10'),
  ('P-0002', 'Energía del Sur SA', 'Av. de la Constitución 45, Sevilla', 'info@energiasur.example', '954234567', 'Manuel Reyes', 'Luz y Gas', 'https://energiasur.example', 'activo', 'Plata', '2025-05-22'),
  ('P-0003', 'GasPro Ibérica SL', 'Ronda de Toledo 8, Madrid', 'hola@gaspro.example', '915345678', 'Lucía Fernández', 'Gas', 'https://gaspro.example', 'activo', 'Bronce', '2026-01-15'),
  ('P-0004', 'Soluciones Energéticas Levante SL', 'Av. del Puerto 100, Valencia', 'contacto@levanteenergia.example', '963456789', 'Jordi Vidal', 'Luz y Gas', 'https://levanteenergia.example', 'activo', 'Oro', '2024-11-05'),
  ('P-0005', 'PowerPoint Renovables SL', 'Calle Triana 3, Las Palmas', 'info@ppr.example', '928567890', 'Carmen Suárez', 'Renovables', 'https://ppr.example', 'inactivo', 'Plata', '2024-06-18'),
  ('P-0006', 'Cliente Directo Canarias SL', 'Av. Marítima 22, Santa Cruz de Tenerife', 'contacto@directocanarias.example', '922678901', 'Pedro Hernández', 'Luz y Gas', 'https://directocanarias.example', 'activo', 'Bronce', '2025-09-01')
on conflict (id) do nothing;

-- 2. Checks: variar el estado de onboarding (el alta ya crea las 5 filas en KO)
update public.checks set estado = 'OK', fecha_ok = '2025-04-01'
  where id_partner = 'P-0001' and tipo_check in ('formacion', 'materiales_formacion', 'credenciales_broker');

update public.checks set estado = 'OK', fecha_ok = '2025-06-10'
  where id_partner = 'P-0002' and tipo_check = 'formacion';

update public.checks set estado = 'OK', fecha_ok = '2024-12-01'
  where id_partner = 'P-0004' and tipo_check in ('formacion', 'materiales_formacion', 'credenciales_broker', 'materiales_trade_marketing', 'tarjeta_carburante');

update public.checks set estado = 'OK', fecha_ok = '2025-09-15'
  where id_partner = 'P-0006' and tipo_check in ('formacion', 'materiales_formacion');

-- 3. Ventas de ejemplo — periodo 2026-01
with nueva_carga as (
  insert into public.cargas (periodo, nombre_fichero, n_filas, usuario)
  values ('2026-01', 'ventas_demo_2026-01.xlsx', 52, 'demo@portal-parceiro.local')
  returning id
)
insert into public.ventas (id_partner, carga_id, periodo, id_contrato, fecha_cierre, producto, debito_directo, factura_electronica, sva, importe_contrato, cliente)
select
  v.id_partner,
  (select id from nueva_carga),
  '2026-01',
  'C-2026-01-' || v.id_partner || '-' || lpad(v.n::text, 3, '0'),
  ('2026-01-' || lpad((1 + (v.n % 28))::text, 2, '0'))::date,
  case when v.n % 2 = 0 then 'Luz' else 'Gas' end,
  (v.n % 3 != 0),
  (v.n % 2 = 0),
  (v.n % 5 = 0),
  200 + (v.n % 10) * 30,
  'Cliente demo ' || v.n
from (
  select 'P-0001' as id_partner, generate_series(1, 15) as n
  union all select 'P-0002', generate_series(1, 8)
  union all select 'P-0003', generate_series(1, 3)
  union all select 'P-0004', generate_series(1, 20)
  union all select 'P-0006', generate_series(1, 6)
) v;

-- 4. Ventas de ejemplo — periodo 2026-02
with nueva_carga as (
  insert into public.cargas (periodo, nombre_fichero, n_filas, usuario)
  values ('2026-02', 'ventas_demo_2026-02.xlsx', 40, 'demo@portal-parceiro.local')
  returning id
)
insert into public.ventas (id_partner, carga_id, periodo, id_contrato, fecha_cierre, producto, debito_directo, factura_electronica, sva, importe_contrato, cliente)
select
  v.id_partner,
  (select id from nueva_carga),
  '2026-02',
  'C-2026-02-' || v.id_partner || '-' || lpad(v.n::text, 3, '0'),
  ('2026-02-' || lpad((1 + (v.n % 28))::text, 2, '0'))::date,
  case when v.n % 2 = 0 then 'Luz' else 'Gas' end,
  (v.n % 3 != 0),
  (v.n % 2 = 0),
  (v.n % 5 = 0),
  200 + (v.n % 10) * 30,
  'Cliente demo ' || v.n
from (
  select 'P-0001' as id_partner, generate_series(1, 10) as n
  union all select 'P-0002', generate_series(1, 12)
  union all select 'P-0004', generate_series(1, 18)
) v;

-- 5. Comisiones calculadas para ambos periodos (mismo modelo que src/lib/calculoComisiones.js,
--    aplicado a los datos generados arriba con la configuración vigente actual).
insert into public.comisiones (
  id_partner, periodo, n_contratos, escalon_aplicado, base_aplicada,
  n_dd, n_fe, n_sva, pct_sva, tarifa_sva_aplicada,
  total_base, total_bonus_dd, total_bonus_fe, total_bonus_sva, total_comision,
  config_snapshot
)
select v.id_partner, v.periodo, v.n_contratos, v.escalon_aplicado, v.base_aplicada,
  v.n_dd, v.n_fe, v.n_sva, v.pct_sva, v.tarifa_sva_aplicada,
  v.total_base, v.total_bonus_dd, v.total_bonus_fe, v.total_bonus_sva, v.total_comision,
  (select to_jsonb(c) from public.configuracion_comisiones c where c.vigente = true)
from (values
  ('P-0001', '2026-01', 15, 3, 30, 10, 7, 3, 20.00, 14, 450, 40, 7, 210, 707),
  ('P-0002', '2026-01', 8, 2, 28, 6, 4, 1, 12.50, 14, 224, 24, 4, 112, 364),
  ('P-0003', '2026-01', 3, 1, 26, 2, 1, 0, 0.00, 10, 78, 8, 1, 30, 117),
  ('P-0004', '2026-01', 20, 3, 30, 14, 10, 4, 20.00, 14, 600, 56, 10, 280, 946),
  ('P-0006', '2026-01', 6, 2, 28, 4, 3, 1, 16.67, 14, 168, 16, 3, 84, 271),
  ('P-0001', '2026-02', 10, 2, 28, 7, 5, 2, 20.00, 14, 280, 28, 5, 140, 453),
  ('P-0002', '2026-02', 12, 2, 28, 8, 6, 2, 16.67, 14, 336, 32, 6, 168, 542),
  ('P-0004', '2026-02', 18, 3, 30, 12, 9, 3, 16.67, 14, 540, 48, 9, 252, 849)
) as v(id_partner, periodo, n_contratos, escalon_aplicado, base_aplicada,
       n_dd, n_fe, n_sva, pct_sva, tarifa_sva_aplicada,
       total_base, total_bonus_dd, total_bonus_fe, total_bonus_sva, total_comision)
on conflict (id_partner, periodo) do update set
  n_contratos = excluded.n_contratos,
  escalon_aplicado = excluded.escalon_aplicado,
  base_aplicada = excluded.base_aplicada,
  n_dd = excluded.n_dd,
  n_fe = excluded.n_fe,
  n_sva = excluded.n_sva,
  pct_sva = excluded.pct_sva,
  tarifa_sva_aplicada = excluded.tarifa_sva_aplicada,
  total_base = excluded.total_base,
  total_bonus_dd = excluded.total_bonus_dd,
  total_bonus_fe = excluded.total_bonus_fe,
  total_bonus_sva = excluded.total_bonus_sva,
  total_comision = excluded.total_comision,
  config_snapshot = excluded.config_snapshot;
