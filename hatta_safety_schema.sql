-- ============================================================
-- HATTA SAFETY — Esquema de Base de Datos (MVP)
-- Supabase / PostgreSQL — Multi-tenant con RLS
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. TIPOS ENUMERADOS
-- ============================================================

create type rol_usuario as enum ('admin', 'supervisor', 'inspector', 'empleado', 'consulta');

create type tipo_observacion as enum ('acto_inseguro', 'condicion_insegura');

create type nivel_riesgo as enum ('bajo', 'medio', 'alto', 'critico');

create type estado_observacion as enum ('nueva', 'en_proceso', 'cerrada');

create type tipo_incidente as enum ('accidente', 'casi_accidente', 'dano_material', 'derrame', 'incendio');

create type estado_incidente as enum ('reportado', 'en_investigacion', 'cerrado');

create type prioridad_accion as enum ('baja', 'media', 'alta', 'critica');

create type estado_accion as enum ('pendiente', 'en_proceso', 'completada', 'vencida', 'cancelada');

create type resultado_item as enum ('cumple', 'no_cumple', 'no_aplica');

create type estado_inspeccion as enum ('borrador', 'en_progreso', 'completada');

-- ============================================================
-- 2. NÚCLEO MULTI-TENANT
-- ============================================================

-- Empresas (tenants)
create table empresas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  rnc         text,                          -- RNC / RFC / NIT según país
  logo_url    text,
  plan        text not null default 'trial', -- trial | basico | pro
  activa      boolean not null default true,
  creada_en   timestamptz not null default now()
);

-- Sedes / centros de trabajo
create table sedes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,
  direccion   text,
  activa      boolean not null default true,
  creada_en   timestamptz not null default now()
);

-- Áreas dentro de una sede (ej: Almacén, Rampas, Oficinas)
create table areas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  sede_id     uuid not null references sedes(id) on delete cascade,
  nombre      text not null,
  activa      boolean not null default true
);

-- Departamentos (ej: Operaciones, Mantenimiento, RRHH)
create table departamentos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,
  activo      boolean not null default true
);

-- Perfiles: extiende auth.users de Supabase
-- Cada usuario pertenece a UNA empresa (multi-tenant simple para MVP)
create table perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nombre          text not null,
  rol             rol_usuario not null default 'empleado',
  departamento_id uuid references departamentos(id),
  sede_id         uuid references sedes(id),
  puesto          text,
  telefono        text,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);

-- ============================================================
-- 3. FUNCIÓN AUXILIAR PARA RLS
-- (obtiene la empresa del usuario autenticado — se usa en todas
--  las políticas; STABLE para que Postgres la cachee por consulta)
-- ============================================================

create or replace function auth_empresa_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select empresa_id from perfiles where id = auth.uid()
$$;

create or replace function auth_rol()
returns rol_usuario
language sql stable security definer
set search_path = public
as $$
  select rol from perfiles where id = auth.uid()
$$;

-- ============================================================
-- 4. OBSERVACIONES DE SEGURIDAD (acto / condición insegura)
-- ============================================================

create table observaciones (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  folio         serial,                               -- número corto visible (OBS-0001)
  tipo          tipo_observacion not null,            -- acto_inseguro | condicion_insegura
  categoria     text,                                 -- ej: EPP, Montacargas, Orden y limpieza
  riesgo        nivel_riesgo not null default 'medio',
  estado        estado_observacion not null default 'nueva',
  descripcion   text not null,
  sede_id       uuid references sedes(id),
  area_id       uuid references areas(id),
  lugar         text,                                 -- detalle libre: "Pasillo B, rampa 4"
  reportado_por uuid not null references perfiles(id),
  responsable   uuid references perfiles(id),         -- quien debe atenderla
  ocurrio_en    timestamptz not null default now(),
  cerrada_en    timestamptz,
  creada_en     timestamptz not null default now()
);

-- ============================================================
-- 5. INCIDENTES
-- ============================================================

create table incidentes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  folio          serial,
  tipo           tipo_incidente not null,
  estado         estado_incidente not null default 'reportado',
  descripcion    text not null,
  sede_id        uuid references sedes(id),
  area_id        uuid references areas(id),
  lugar          text,
  ocurrio_en     timestamptz not null,
  persona_afectada text,                    -- nombre (puede no ser usuario del sistema)
  testigos       text,
  causa_inmediata text,
  causa_raiz     text,
  consecuencia   text,
  dias_perdidos  integer default 0,         -- para calcular LTIR después
  reportado_por  uuid not null references perfiles(id),
  investigador   uuid references perfiles(id),
  cerrado_en     timestamptz,
  creado_en      timestamptz not null default now()
);

-- ============================================================
-- 6. ACCIONES CORRECTIVAS
-- (pueden nacer de una observación, un incidente o una inspección)
-- ============================================================

create table acciones_correctivas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  folio            serial,
  descripcion      text not null,
  prioridad        prioridad_accion not null default 'media',
  estado           estado_accion not null default 'pendiente',
  responsable      uuid not null references perfiles(id),
  fecha_compromiso date not null,
  completada_en    timestamptz,
  comentarios      text,
  -- origen (solo uno lleno, los demás null)
  observacion_id   uuid references observaciones(id) on delete set null,
  incidente_id     uuid references incidentes(id) on delete set null,
  inspeccion_id    uuid,                    -- FK se agrega después de crear inspecciones
  creada_por       uuid not null references perfiles(id),
  creada_en        timestamptz not null default now()
);

-- ============================================================
-- 7. INSPECCIONES Y CHECKLISTS
-- ============================================================

-- Plantillas de checklist configurables por empresa
create table checklists (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,               -- ej: "Inspección EPP", "Extintores mensual"
  descripcion text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table checklist_items (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  empresa_id   uuid not null references empresas(id) on delete cascade,
  orden        integer not null default 0,
  pregunta     text not null,              -- ej: "¿Extintor con presión adecuada?"
  requiere_foto_si_no_cumple boolean not null default false
);

-- Ejecución de una inspección
create table inspecciones (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  folio         serial,
  checklist_id  uuid not null references checklists(id),
  estado        estado_inspeccion not null default 'en_progreso',
  sede_id       uuid references sedes(id),
  area_id       uuid references areas(id),
  inspector     uuid not null references perfiles(id),
  realizada_en  timestamptz not null default now(),
  completada_en timestamptz,
  puntuacion    numeric(5,2)               -- % de cumplimiento calculado
);

create table respuestas (
  id             uuid primary key default gen_random_uuid(),
  inspeccion_id  uuid not null references inspecciones(id) on delete cascade,
  empresa_id     uuid not null references empresas(id) on delete cascade,
  item_id        uuid not null references checklist_items(id),
  resultado      resultado_item not null,
  comentario     text
);

-- Ahora sí, la FK pendiente de acciones_correctivas
alter table acciones_correctivas
  add constraint fk_accion_inspeccion
  foreign key (inspeccion_id) references inspecciones(id) on delete set null;

-- ============================================================
-- 8. EVIDENCIAS (polimórfica: sirve para todos los módulos)
-- Los archivos van en Supabase Storage; aquí solo la referencia
-- ============================================================

create table evidencias (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  entidad_tipo  text not null check (entidad_tipo in
                  ('observacion','incidente','accion_correctiva','inspeccion','respuesta')),
  entidad_id    uuid not null,
  storage_path  text not null,             -- ruta en bucket: empresa_id/entidad/uuid.jpg
  tipo_archivo  text not null,             -- image/jpeg, video/mp4, application/pdf
  subido_por    uuid not null references perfiles(id),
  subido_en     timestamptz not null default now()
);

-- ============================================================
-- 9. NOTIFICACIONES Y BITÁCORA
-- ============================================================

create table notificaciones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  usuario_id  uuid not null references perfiles(id) on delete cascade,
  titulo      text not null,
  mensaje     text not null,
  enlace      text,                        -- ruta interna: /acciones/uuid
  leida       boolean not null default false,
  creada_en   timestamptz not null default now()
);

create table bitacora (
  id          bigint generated always as identity primary key,
  empresa_id  uuid not null,
  usuario_id  uuid,                        -- null si fue el sistema
  accion      text not null,               -- crear | actualizar | eliminar | cerrar
  tabla       text not null,
  registro_id uuid,
  detalle     jsonb,                       -- snapshot de los cambios
  creada_en   timestamptz not null default now()
);

-- ============================================================
-- 10. ÍNDICES (los que el dashboard y las listas van a golpear)
-- ============================================================

create index idx_perfiles_empresa      on perfiles(empresa_id);
create index idx_obs_empresa_estado    on observaciones(empresa_id, estado);
create index idx_obs_empresa_tipo      on observaciones(empresa_id, tipo);
create index idx_obs_fecha             on observaciones(empresa_id, ocurrio_en desc);
create index idx_inc_empresa_estado    on incidentes(empresa_id, estado);
create index idx_inc_fecha             on incidentes(empresa_id, ocurrio_en desc);
create index idx_acc_responsable       on acciones_correctivas(responsable, estado);
create index idx_acc_empresa_estado    on acciones_correctivas(empresa_id, estado);
create index idx_acc_vencimiento       on acciones_correctivas(fecha_compromiso) where estado in ('pendiente','en_proceso');
create index idx_insp_empresa          on inspecciones(empresa_id, realizada_en desc);
create index idx_evid_entidad          on evidencias(entidad_tipo, entidad_id);
create index idx_notif_usuario         on notificaciones(usuario_id, leida);
create index idx_bitacora_empresa      on bitacora(empresa_id, creada_en desc);

-- ============================================================
-- 11. ROW LEVEL SECURITY (multi-tenant)
-- Regla de oro: nadie ve datos fuera de su empresa. Punto.
-- ============================================================

alter table empresas             enable row level security;
alter table sedes                enable row level security;
alter table areas                enable row level security;
alter table departamentos       enable row level security;
alter table perfiles             enable row level security;
alter table observaciones        enable row level security;
alter table incidentes           enable row level security;
alter table acciones_correctivas enable row level security;
alter table checklists           enable row level security;
alter table checklist_items      enable row level security;
alter table inspecciones         enable row level security;
alter table respuestas           enable row level security;
alter table evidencias           enable row level security;
alter table notificaciones       enable row level security;
alter table bitacora             enable row level security;

-- Empresas: solo puedes ver la tuya; solo admin la edita
create policy emp_select on empresas for select
  using (id = auth_empresa_id());
create policy emp_update on empresas for update
  using (id = auth_empresa_id() and auth_rol() = 'admin');

-- Perfiles: ves a los de tu empresa; admin gestiona
create policy perf_select on perfiles for select
  using (empresa_id = auth_empresa_id());
create policy perf_insert on perfiles for insert
  with check (empresa_id = auth_empresa_id() and auth_rol() = 'admin');
create policy perf_update on perfiles for update
  using (empresa_id = auth_empresa_id()
         and (auth_rol() = 'admin' or id = auth.uid()));

-- Estructura (sedes, áreas, departamentos): todos leen, admin/supervisor editan
create policy sedes_select on sedes for select
  using (empresa_id = auth_empresa_id());
create policy sedes_write on sedes for all
  using (empresa_id = auth_empresa_id() and auth_rol() in ('admin','supervisor'))
  with check (empresa_id = auth_empresa_id());

create policy areas_select on areas for select
  using (empresa_id = auth_empresa_id());
create policy areas_write on areas for all
  using (empresa_id = auth_empresa_id() and auth_rol() in ('admin','supervisor'))
  with check (empresa_id = auth_empresa_id());

create policy dept_select on departamentos for select
  using (empresa_id = auth_empresa_id());
create policy dept_write on departamentos for all
  using (empresa_id = auth_empresa_id() and auth_rol() in ('admin','supervisor'))
  with check (empresa_id = auth_empresa_id());

-- Observaciones: TODOS pueden reportar (clave del producto),
-- solo admin/supervisor/inspector actualizan y cierran
create policy obs_select on observaciones for select
  using (empresa_id = auth_empresa_id());
create policy obs_insert on observaciones for insert
  with check (empresa_id = auth_empresa_id() and reportado_por = auth.uid());
create policy obs_update on observaciones for update
  using (empresa_id = auth_empresa_id()
         and auth_rol() in ('admin','supervisor','inspector'));

-- Incidentes: todos reportan, admin/supervisor gestionan
create policy inc_select on incidentes for select
  using (empresa_id = auth_empresa_id());
create policy inc_insert on incidentes for insert
  with check (empresa_id = auth_empresa_id() and reportado_por = auth.uid());
create policy inc_update on incidentes for update
  using (empresa_id = auth_empresa_id()
         and auth_rol() in ('admin','supervisor'));

-- Acciones correctivas: admin/supervisor crean;
-- el responsable puede actualizar la suya (marcar avance)
create policy acc_select on acciones_correctivas for select
  using (empresa_id = auth_empresa_id());
create policy acc_insert on acciones_correctivas for insert
  with check (empresa_id = auth_empresa_id()
              and auth_rol() in ('admin','supervisor','inspector'));
create policy acc_update on acciones_correctivas for update
  using (empresa_id = auth_empresa_id()
         and (auth_rol() in ('admin','supervisor') or responsable = auth.uid()));

-- Checklists e inspecciones
create policy chk_select on checklists for select
  using (empresa_id = auth_empresa_id());
create policy chk_write on checklists for all
  using (empresa_id = auth_empresa_id() and auth_rol() in ('admin','supervisor'))
  with check (empresa_id = auth_empresa_id());

create policy chki_select on checklist_items for select
  using (empresa_id = auth_empresa_id());
create policy chki_write on checklist_items for all
  using (empresa_id = auth_empresa_id() and auth_rol() in ('admin','supervisor'))
  with check (empresa_id = auth_empresa_id());

create policy insp_select on inspecciones for select
  using (empresa_id = auth_empresa_id());
create policy insp_insert on inspecciones for insert
  with check (empresa_id = auth_empresa_id()
              and auth_rol() in ('admin','supervisor','inspector'));
create policy insp_update on inspecciones for update
  using (empresa_id = auth_empresa_id()
         and (auth_rol() in ('admin','supervisor') or inspector = auth.uid()));

create policy resp_select on respuestas for select
  using (empresa_id = auth_empresa_id());
create policy resp_write on respuestas for all
  using (empresa_id = auth_empresa_id()
         and auth_rol() in ('admin','supervisor','inspector'))
  with check (empresa_id = auth_empresa_id());

-- Evidencias: todos suben (fotos de reportes), todos ven las de su empresa
create policy evid_select on evidencias for select
  using (empresa_id = auth_empresa_id());
create policy evid_insert on evidencias for insert
  with check (empresa_id = auth_empresa_id() and subido_por = auth.uid());

-- Notificaciones: cada quien ve solo las suyas
create policy notif_select on notificaciones for select
  using (usuario_id = auth.uid());
create policy notif_update on notificaciones for update
  using (usuario_id = auth.uid());

-- Bitácora: solo lectura para admin; se escribe vía trigger (security definer)
create policy bit_select on bitacora for select
  using (empresa_id = auth_empresa_id() and auth_rol() = 'admin');

-- ============================================================
-- 12. TRIGGER DE BITÁCORA AUTOMÁTICA
-- Se aplica a las tablas críticas: todo cambio queda registrado
-- ============================================================

create or replace function fn_bitacora()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_registro uuid;
begin
  if tg_op = 'DELETE' then
    v_empresa  := old.empresa_id;
    v_registro := old.id;
  else
    v_empresa  := new.empresa_id;
    v_registro := new.id;
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, tabla, registro_id, detalle)
  values (
    v_empresa,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_registro,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger trg_bit_obs  after insert or update or delete on observaciones
  for each row execute function fn_bitacora();
create trigger trg_bit_inc  after insert or update or delete on incidentes
  for each row execute function fn_bitacora();
create trigger trg_bit_acc  after insert or update or delete on acciones_correctivas
  for each row execute function fn_bitacora();
create trigger trg_bit_insp after insert or update or delete on inspecciones
  for each row execute function fn_bitacora();

-- ============================================================
-- 13. VISTA PARA EL DASHBOARD (KPIs del mes en una consulta)
-- ============================================================

create or replace view v_dashboard_kpis
with (security_invoker = true)   -- respeta RLS del usuario
as
select
  e.id as empresa_id,
  (select count(*) from incidentes i
     where i.empresa_id = e.id
       and i.ocurrio_en >= date_trunc('month', now())) as incidentes_mes,
  (select count(*) from incidentes i
     where i.empresa_id = e.id and i.tipo = 'casi_accidente'
       and i.ocurrio_en >= date_trunc('month', now())) as casi_accidentes_mes,
  (select count(*) from observaciones o
     where o.empresa_id = e.id
       and o.ocurrio_en >= date_trunc('month', now())) as observaciones_mes,
  (select count(*) from observaciones o
     where o.empresa_id = e.id and o.tipo = 'acto_inseguro'
       and o.ocurrio_en >= date_trunc('month', now())) as actos_inseguros_mes,
  (select count(*) from observaciones o
     where o.empresa_id = e.id and o.tipo = 'condicion_insegura'
       and o.ocurrio_en >= date_trunc('month', now())) as condiciones_inseguras_mes,
  (select count(*) from acciones_correctivas a
     where a.empresa_id = e.id
       and a.estado in ('pendiente','en_proceso')) as acciones_abiertas,
  (select count(*) from acciones_correctivas a
     where a.empresa_id = e.id and a.estado in ('pendiente','en_proceso')
       and a.fecha_compromiso < current_date) as acciones_vencidas,
  (select coalesce(round(avg(puntuacion),1), 0) from inspecciones ip
     where ip.empresa_id = e.id and ip.estado = 'completada'
       and ip.realizada_en >= date_trunc('month', now())) as cumplimiento_inspecciones
from empresas e;

-- ============================================================
-- FIN — Siguiente paso: crear bucket 'evidencias' en Storage
-- con política por carpeta empresa_id/, y el seed de datos demo.
-- ============================================================

-- ============================================================
-- 14. MEJORAS v1.1 — GPS, gravedad, updated_at automático
-- ============================================================

-- GPS para reporte móvil (se captura del navegador/PWA)
alter table observaciones add column latitud  numeric(9,6);
alter table observaciones add column longitud numeric(9,6);
alter table incidentes    add column latitud  numeric(9,6);
alter table incidentes    add column longitud numeric(9,6);

-- Gravedad y costo en incidentes (para KPIs de severidad)
create type gravedad_incidente as enum ('leve', 'moderado', 'grave', 'fatal');
alter table incidentes add column gravedad gravedad_incidente;
alter table incidentes add column costo_estimado numeric(12,2);

-- Exigir evidencia para cerrar una acción correctiva
alter table acciones_correctivas add column evidencia_requerida boolean not null default false;

-- updated_at automático en tablas principales
alter table observaciones        add column updated_at timestamptz not null default now();
alter table incidentes           add column updated_at timestamptz not null default now();
alter table acciones_correctivas add column updated_at timestamptz not null default now();
alter table inspecciones         add column updated_at timestamptz not null default now();
alter table perfiles             add column updated_at timestamptz not null default now();
alter table checklists           add column updated_at timestamptz not null default now();

create or replace function fn_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_upd_obs  before update on observaciones        for each row execute function fn_updated_at();
create trigger trg_upd_inc  before update on incidentes           for each row execute function fn_updated_at();
create trigger trg_upd_acc  before update on acciones_correctivas for each row execute function fn_updated_at();
create trigger trg_upd_insp before update on inspecciones         for each row execute function fn_updated_at();
create trigger trg_upd_perf before update on perfiles             for each row execute function fn_updated_at();
create trigger trg_upd_chk  before update on checklists           for each row execute function fn_updated_at();
