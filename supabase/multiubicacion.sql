-- Ejecutar DESPUÉS de schema.sql. Migración aditiva: conserva reportes anteriores.
begin;

alter table public.perfiles add column if not exists nombre text not null default '';
alter table public.perfiles add column if not exists correo text;
insert into public.perfiles(id, nombre, correo)
select id, coalesce(raw_user_meta_data->>'nombre', ''), email from auth.users
on conflict (id) do update set correo = excluded.correo;

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles(id, nombre, correo)
  values(new.id, left(coalesce(new.raw_user_meta_data->>'nombre', ''), 120), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create table if not exists public.ubicaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index if not exists ubicaciones_nombre_unico on public.ubicaciones(lower(trim(nombre)));

create table if not exists public.asignaciones (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  ubicacion_id uuid not null references public.ubicaciones(id) on delete cascade,
  primary key(usuario_id, ubicacion_id)
);
create index if not exists asignaciones_ubicacion_idx on public.asignaciones(ubicacion_id);

create table if not exists public.configuraciones_ubicacion (
  id uuid primary key default gen_random_uuid(),
  ubicacion_id uuid not null references public.ubicaciones(id),
  version integer not null check (version > 0),
  contenido jsonb not null check (jsonb_typeof(contenido->'tiposReportes') = 'array'),
  publicado_por uuid not null references auth.users(id),
  publicado_en timestamptz not null default now(),
  unique(ubicacion_id, version),
  unique(id, ubicacion_id)
);

alter table public.reportes add column if not exists ubicacion_id uuid references public.ubicaciones(id);
alter table public.reportes add column if not exists configuracion_id uuid;
alter table public.reportes add column if not exists formulario_snapshot jsonb;
do $$ begin
  if not exists(select 1 from pg_constraint where conname = 'reporte_configuracion_ubicacion_fk') then
    alter table public.reportes add constraint reporte_configuracion_ubicacion_fk
      foreign key(configuracion_id, ubicacion_id) references public.configuraciones_ubicacion(id, ubicacion_id);
  end if;
end $$;
create index if not exists reportes_ubicacion_fecha_idx on public.reportes(ubicacion_id, creado_en desc);

create or replace function public.puede_acceder_ubicacion(destino uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ubicaciones u where u.id = destino and u.activa
    and (public.es_administrador() or exists(select 1 from public.asignaciones a
      where a.ubicacion_id = u.id and a.usuario_id = auth.uid())));
$$;
revoke all on function public.puede_acceder_ubicacion(uuid) from public, anon;
grant execute on function public.puede_acceder_ubicacion(uuid) to authenticated;

alter table public.ubicaciones enable row level security;
alter table public.asignaciones enable row level security;
alter table public.configuraciones_ubicacion enable row level security;
revoke all on public.ubicaciones, public.asignaciones, public.configuraciones_ubicacion from anon, authenticated;
grant select, insert, update on public.ubicaciones to authenticated;
grant select, insert, delete on public.asignaciones to authenticated;
grant select on public.configuraciones_ubicacion to authenticated;
-- Los roles no se pueden cambiar desde el cliente.
revoke insert, update, delete on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
grant select, insert on public.reportes to authenticated;

drop policy if exists "ubicaciones visibles" on public.ubicaciones;
create policy "ubicaciones visibles" on public.ubicaciones for select to authenticated
using (public.es_administrador() or public.puede_acceder_ubicacion(id));
drop policy if exists "admin crea ubicaciones" on public.ubicaciones;
create policy "admin crea ubicaciones" on public.ubicaciones for insert to authenticated
with check (public.es_administrador());
drop policy if exists "admin edita ubicaciones" on public.ubicaciones;
create policy "admin edita ubicaciones" on public.ubicaciones for update to authenticated
using (public.es_administrador()) with check (public.es_administrador());
drop policy if exists "asignaciones visibles" on public.asignaciones;
create policy "asignaciones visibles" on public.asignaciones for select to authenticated
using (usuario_id = auth.uid() or public.es_administrador());
drop policy if exists "admin asigna" on public.asignaciones;
create policy "admin asigna" on public.asignaciones for insert to authenticated
with check (public.es_administrador());
drop policy if exists "admin retira asignacion" on public.asignaciones;
create policy "admin retira asignacion" on public.asignaciones for delete to authenticated
using (public.es_administrador());
drop policy if exists "configuraciones visibles" on public.configuraciones_ubicacion;
create policy "configuraciones visibles" on public.configuraciones_ubicacion for select to authenticated
using (public.es_administrador() or public.puede_acceder_ubicacion(ubicacion_id));

-- Publicación atómica con control de concurrencia; las versiones son inmutables.
create or replace function public.publicar_configuracion(destino uuid, contenido_nuevo jsonb, version_base integer)
returns public.configuraciones_ubicacion language plpgsql security definer set search_path = '' as $$
declare actual integer; resultado public.configuraciones_ubicacion;
begin
  if not public.es_administrador() then raise exception 'Solo un administrador puede publicar'; end if;
  perform 1 from public.ubicaciones where id = destino and activa for update;
  if not found then raise exception 'Ubicación inexistente o inactiva'; end if;
  if jsonb_typeof(contenido_nuevo->'tiposReportes') is distinct from 'array'
    or jsonb_typeof(contenido_nuevo->'catalogos') is distinct from 'array' then
    raise exception 'Configuración inválida';
  end if;
  select coalesce(max(version), 0) into actual from public.configuraciones_ubicacion where ubicacion_id = destino;
  if version_base is distinct from actual then
    raise exception 'Otra persona publicó cambios. Recargue la versión publicada antes de continuar.';
  end if;
  insert into public.configuraciones_ubicacion(ubicacion_id, version, contenido, publicado_por)
    values(destino, actual + 1, contenido_nuevo, auth.uid()) returning * into resultado;
  return resultado;
end;
$$;
revoke all on function public.publicar_configuracion(uuid,jsonb,integer) from public, anon;
grant execute on function public.publicar_configuracion(uuid,jsonb,integer) to authenticated;

drop policy if exists "usuarios crean sus reportes" on public.reportes;
create policy "usuarios crean sus reportes" on public.reportes for insert to authenticated
with check (creado_por = auth.uid() and ubicacion_id is not null and configuracion_id is not null
  and public.puede_acceder_ubicacion(ubicacion_id)
  and (evidencia_ruta is null or split_part(evidencia_ruta, '/', 1) = auth.uid()::text));
drop policy if exists "usuarios consultan sus reportes" on public.reportes;
create policy "usuarios consultan sus reportes" on public.reportes for select to authenticated
using (creado_por = auth.uid() and public.puede_acceder_ubicacion(ubicacion_id));

create or replace function public.fijar_formulario_reporte()
returns trigger language plpgsql set search_path = '' as $$
begin
  select tipo into new.formulario_snapshot from public.configuraciones_ubicacion c,
    lateral jsonb_array_elements(c.contenido->'tiposReportes') tipo
    where c.id = new.configuracion_id and c.ubicacion_id = new.ubicacion_id
      and tipo->>'clave' = new.tipo_clave and tipo->>'activo' = 'true' limit 1;
  if new.formulario_snapshot is null then raise exception 'Formulario no publicado para esta ubicación'; end if;
  new.tipo_nombre := new.formulario_snapshot->>'nombre';
  new.creado_en := now();
  return new;
end;
$$;
drop trigger if exists fijar_formulario_reporte on public.reportes;
create trigger fijar_formulario_reporte before insert on public.reportes
for each row execute function public.fijar_formulario_reporte();

-- Una función de mantenimiento nunca debe estar disponible para usuarios de la app.
revoke all on function public.eliminar_reportes_vencidos() from public, anon, authenticated;
commit;
