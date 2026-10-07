-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run.
-- Antes de usar la app active Authentication > Providers > Anonymous Sign-Ins.

create table if not exists public.perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    rol text not null default 'guardia' check (rol in ('guardia', 'admin')),
    creado_en timestamptz not null default now()
);

create table if not exists public.reportes (
    id uuid primary key,
    creado_en timestamptz not null default now(),
    creado_por uuid not null references auth.users(id) on delete restrict,
    tipo_clave text not null,
    tipo_nombre text not null,
    mensaje_whatsapp text not null,
    valores jsonb not null default '{}'::jsonb,
    evidencia_ruta text,
    evidencia_nombre text,
    constraint evidencia_completa check (
        (evidencia_ruta is null and evidencia_nombre is null)
        or (evidencia_ruta is not null and evidencia_nombre is not null)
    )
);

create index if not exists reportes_creado_en_idx on public.reportes (creado_en desc);

alter table public.perfiles enable row level security;
alter table public.reportes enable row level security;

create or replace function public.es_administrador()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.perfiles
        where id = auth.uid() and rol = 'admin'
    );
$$;

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.perfiles (id) values (new.id)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists al_crear_usuario_crear_perfil on auth.users;
create trigger al_crear_usuario_crear_perfil
    after insert on auth.users
    for each row execute procedure public.crear_perfil_nuevo_usuario();

drop policy if exists "perfil propio visible" on public.perfiles;
create policy "perfil propio visible" on public.perfiles
    for select to authenticated using (id = auth.uid());

drop policy if exists "administradores ven perfiles" on public.perfiles;
create policy "administradores ven perfiles" on public.perfiles
    for select to authenticated using (public.es_administrador());

drop policy if exists "usuarios crean sus reportes" on public.reportes;
create policy "usuarios crean sus reportes" on public.reportes
    for insert to authenticated with check (creado_por = auth.uid());

drop policy if exists "administradores consultan reportes" on public.reportes;
create policy "administradores consultan reportes" on public.reportes
    for select to authenticated using (public.es_administrador());

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do update set public = false;

drop policy if exists "usuarios suben su evidencia" on storage.objects;
create policy "usuarios suben su evidencia" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "usuarios eliminan su evidencia pendiente" on storage.objects;
create policy "usuarios eliminan su evidencia pendiente" on storage.objects
    for delete to authenticated
    using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "administradores ven evidencias" on storage.objects;
create policy "administradores ven evidencias" on storage.objects
    for select to authenticated
    using (bucket_id = 'evidencias' and public.es_administrador());

create or replace function public.eliminar_reportes_vencidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Storage exige su API: la limpieza completa se realiza en la Edge Function.
    raise exception 'Active limpieza_reportes.sql y la Edge Function limpiar-reportes; consulte LIMPIEZA.md';
end;
$$;
revoke all on function public.eliminar_reportes_vencidos() from public, anon, authenticated;
