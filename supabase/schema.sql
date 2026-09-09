-- ============================================================================
-- Portal de gestión de cartera de partners — esquema inicial (Fase 1)
-- Ejecutar manualmente en el SQL Editor de Supabase (proyecto en región UE).
-- Este script es idempotente: puede volver a ejecutarse sin duplicar objetos.
-- ============================================================================

-- Extensiones necesarias
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tabla: partners
-- ----------------------------------------------------------------------------
create table if not exists public.partners (
  id text primary key,
  nombre_empresa text not null,
  direccion text,
  email text,
  telefono text,
  contacto text,
  sector text,
  url_web text,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  categoria text,
  fecha_alta date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partners_estado on public.partners (estado);
create index if not exists idx_partners_categoria on public.partners (categoria);
create index if not exists idx_partners_nombre_empresa on public.partners (nombre_empresa);

-- ----------------------------------------------------------------------------
-- Tabla: cargas (una fila por Excel cargado)
-- ----------------------------------------------------------------------------
create table if not exists public.cargas (
  id uuid primary key default gen_random_uuid(),
  periodo text not null, -- formato 'YYYY-MM'
  nombre_fichero text not null,
  fecha_carga timestamptz not null default now(),
  n_filas integer not null default 0,
  usuario text
);

create index if not exists idx_cargas_periodo on public.cargas (periodo);

-- ----------------------------------------------------------------------------
-- Tabla: ventas (una fila por contrato cerrado)
-- ----------------------------------------------------------------------------
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  id_partner text not null references public.partners (id),
  carga_id uuid not null references public.cargas (id) on delete cascade,
  periodo text not null, -- formato 'YYYY-MM'
  id_contrato text not null,
  fecha_cierre date,
  producto text,
  debito_directo boolean not null default false,
  factura_electronica boolean not null default false,
  sva boolean not null default false,
  importe_contrato numeric(12, 2),
  cliente text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ventas_id_partner on public.ventas (id_partner);
create index if not exists idx_ventas_periodo on public.ventas (periodo);
create index if not exists idx_ventas_carga_id on public.ventas (carga_id);

-- ----------------------------------------------------------------------------
-- Tabla: configuracion_comisiones (parámetros editables del modelo, con histórico)
-- ----------------------------------------------------------------------------
create table if not exists public.configuracion_comisiones (
  id uuid primary key default gen_random_uuid(),
  base_escalon_1 numeric(10, 2) not null default 26,
  base_escalon_2 numeric(10, 2) not null default 28,
  base_escalon_3 numeric(10, 2) not null default 30,
  umbral_escalon_1 integer not null default 5,
  umbral_escalon_2 integer not null default 12,
  bonus_dd numeric(10, 2) not null default 4,
  bonus_fe numeric(10, 2) not null default 1,
  sva_tarifa_baja numeric(10, 2) not null default 10,
  sva_tarifa_alta numeric(10, 2) not null default 14,
  sva_umbral_pct numeric(5, 2) not null default 10,
  vigente boolean not null default true,
  vigente_desde date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_config_comisiones_vigente on public.configuracion_comisiones (vigente);

-- Solo debe existir una configuración vigente a la vez.
create unique index if not exists uniq_config_comisiones_vigente
  on public.configuracion_comisiones (vigente)
  where vigente = true;

-- Configuración inicial por defecto (solo si la tabla está vacía)
insert into public.configuracion_comisiones (
  base_escalon_1, base_escalon_2, base_escalon_3,
  umbral_escalon_1, umbral_escalon_2,
  bonus_dd, bonus_fe,
  sva_tarifa_baja, sva_tarifa_alta, sva_umbral_pct,
  vigente, vigente_desde
)
select 26, 28, 30, 5, 12, 4, 1, 10, 14, 10, true, current_date
where not exists (select 1 from public.configuracion_comisiones);

-- ----------------------------------------------------------------------------
-- Tabla: comisiones (resultado calculado por partner y periodo, persistido)
-- ----------------------------------------------------------------------------
create table if not exists public.comisiones (
  id uuid primary key default gen_random_uuid(),
  id_partner text not null references public.partners (id),
  periodo text not null, -- formato 'YYYY-MM'
  n_contratos integer not null default 0,
  escalon_aplicado integer,
  base_aplicada numeric(10, 2),
  n_dd integer not null default 0,
  n_fe integer not null default 0,
  n_sva integer not null default 0,
  pct_sva numeric(5, 2),
  tarifa_sva_aplicada numeric(10, 2),
  total_base numeric(12, 2) not null default 0,
  total_bonus_dd numeric(12, 2) not null default 0,
  total_bonus_fe numeric(12, 2) not null default 0,
  total_bonus_sva numeric(12, 2) not null default 0,
  total_comision numeric(12, 2) not null default 0,
  config_snapshot jsonb not null,
  fecha_calculo timestamptz not null default now(),
  unique (id_partner, periodo)
);

create index if not exists idx_comisiones_periodo on public.comisiones (periodo);
create index if not exists idx_comisiones_id_partner on public.comisiones (id_partner);

-- ----------------------------------------------------------------------------
-- Tabla: checks (matriz partner x tipo de check)
-- ----------------------------------------------------------------------------
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  id_partner text not null references public.partners (id) on delete cascade,
  tipo_check text not null check (
    tipo_check in (
      'formacion',
      'materiales_formacion',
      'credenciales_broker',
      'materiales_trade_marketing',
      'tarjeta_carburante'
    )
  ),
  estado text not null default 'KO' check (estado in ('KO', 'OK')),
  fecha_ok date,
  unique (id_partner, tipo_check)
);

create index if not exists idx_checks_id_partner on public.checks (id_partner);
create index if not exists idx_checks_estado on public.checks (estado);

-- ----------------------------------------------------------------------------
-- Trigger: crear las 5 filas de checks en KO al dar de alta un partner
-- ----------------------------------------------------------------------------
create or replace function public.crear_checks_iniciales()
returns trigger
language plpgsql
as $$
begin
  insert into public.checks (id_partner, tipo_check, estado)
  values
    (new.id, 'formacion', 'KO'),
    (new.id, 'materiales_formacion', 'KO'),
    (new.id, 'credenciales_broker', 'KO'),
    (new.id, 'materiales_trade_marketing', 'KO'),
    (new.id, 'tarjeta_carburante', 'KO')
  on conflict (id_partner, tipo_check) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_checks_iniciales on public.partners;
create trigger trg_crear_checks_iniciales
  after insert on public.partners
  for each row
  execute function public.crear_checks_iniciales();

-- ----------------------------------------------------------------------------
-- Trigger: mantener updated_at en partners
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_partners_updated_at on public.partners;
create trigger trg_partners_updated_at
  before update on public.partners
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security: solo usuarios autenticados (equipo interno vía SSO)
-- ============================================================================

alter table public.partners enable row level security;
alter table public.cargas enable row level security;
alter table public.ventas enable row level security;
alter table public.configuracion_comisiones enable row level security;
alter table public.comisiones enable row level security;
alter table public.checks enable row level security;

-- Política genérica: cualquier usuario autenticado puede leer y escribir.
-- (No hay roles diferenciados en el equipo interno; el acceso a la app ya
-- está restringido por el SSO de Entra ID a nivel de tenant.)

drop policy if exists "authenticated_all_partners" on public.partners;
create policy "authenticated_all_partners" on public.partners
  for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated_all_cargas" on public.cargas;
create policy "authenticated_all_cargas" on public.cargas
  for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated_all_ventas" on public.ventas;
create policy "authenticated_all_ventas" on public.ventas
  for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated_all_configuracion_comisiones" on public.configuracion_comisiones;
create policy "authenticated_all_configuracion_comisiones" on public.configuracion_comisiones
  for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated_all_comisiones" on public.comisiones;
create policy "authenticated_all_comisiones" on public.comisiones
  for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated_all_checks" on public.checks;
create policy "authenticated_all_checks" on public.checks
  for all to authenticated
  using (true) with check (true);
