-- Ejecutar después de multiubicacion.sql y antes de actualizar la app.
-- Los reportes anteriores se conservan; el administrador registra el personal real.
begin;
create table if not exists public.vigilantes (
  id uuid primary key default gen_random_uuid(),
  ubicacion_id uuid not null references public.ubicaciones(id) on delete restrict,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique(id, ubicacion_id)
);
create unique index if not exists vigilantes_nombre_unidad on public.vigilantes(ubicacion_id, lower(trim(nombre)));
alter table public.vigilantes enable row level security;
revoke all on public.vigilantes from anon, authenticated;
grant select, insert, update on public.vigilantes to authenticated;
drop policy if exists "vigilantes visibles" on public.vigilantes;
create policy "vigilantes visibles" on public.vigilantes for select to authenticated
using (public.es_administrador() or (activo and public.puede_acceder_ubicacion(ubicacion_id)));
drop policy if exists "admin registra vigilantes" on public.vigilantes;
create policy "admin registra vigilantes" on public.vigilantes for insert to authenticated
with check (public.es_administrador());
drop policy if exists "admin edita vigilantes" on public.vigilantes;
create policy "admin edita vigilantes" on public.vigilantes for update to authenticated
using (public.es_administrador()) with check (public.es_administrador());
alter table public.reportes add column if not exists vigilante_id uuid;
alter table public.reportes add column if not exists vigilante_nombre text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname = 'reporte_vigilante_unidad_fk' and conrelid = 'public.reportes'::regclass) then
    alter table public.reportes add constraint reporte_vigilante_unidad_fk
      foreign key(vigilante_id, ubicacion_id) references public.vigilantes(id, ubicacion_id);
  end if;
end $$;
create index if not exists reportes_vigilante_fecha_idx on public.reportes(vigilante_id, creado_en desc);
create or replace function public.fijar_vigilante_reporte()
returns trigger language plpgsql set search_path = '' as $$
declare nombre_actual text; campo jsonb;
begin
  select nombre into nombre_actual from public.vigilantes
    where id = new.vigilante_id and ubicacion_id = new.ubicacion_id and activo;
  if nombre_actual is null then raise exception 'Seleccione un vigilante activo de esta unidad'; end if;
  new.vigilante_nombre := nombre_actual;
  new.valores := coalesce(new.valores, '{}'::jsonb) || jsonb_build_object(
    'vigilante_id', new.vigilante_id, 'vigilante', nombre_actual,
    'guardia', nombre_actual, 'nombre_guardia', nombre_actual, 'nombre_vigilante', nombre_actual);
  -- Mantener también los campos personalizados de identidad del formulario.
  for campo in select value from jsonb_array_elements(coalesce(new.formulario_snapshot->'campos', '[]'::jsonb)) loop
    if campo->>'fuente_dato' = 'vigilante' or campo->>'catalogo_origen' = 'guardias' then
      new.valores := new.valores || jsonb_build_object(campo->>'nombre_campo', nombre_actual);
    end if;
  end loop;
  return new;
end;
$$;
-- El orden alfabético ejecuta este trigger después de fijar_formulario_reporte.
drop trigger if exists fijar_vigilante_reporte on public.reportes;
create trigger fijar_vigilante_reporte before insert on public.reportes
for each row execute function public.fijar_vigilante_reporte();
commit;
