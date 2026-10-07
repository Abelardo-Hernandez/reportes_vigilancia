-- Ejecutar una vez configurados los secretos y desplegada la Edge Function (LIMPIEZA.md).
begin;
create extension if not exists pg_net with schema extensions;

create table if not exists public.limpieza_ejecuciones (
    id uuid primary key default gen_random_uuid(),
    iniciado_en timestamptz not null default now(),
    terminado_en timestamptz,
    fecha_limite timestamptz not null,
    estado text not null check (estado in ('running', 'succeeded', 'partial', 'failed')),
    reportes_eliminados integer not null default 0,
    fotos_eliminadas integer not null default 0,
    error text
);
alter table public.limpieza_ejecuciones enable row level security;
revoke all on public.limpieza_ejecuciones from public, anon, authenticated;
grant select on public.limpieza_ejecuciones to authenticated;
grant select, insert, update on public.limpieza_ejecuciones to service_role;
grant select, delete on public.reportes to service_role;
drop policy if exists "admin consulta limpieza" on public.limpieza_ejecuciones;
create policy "admin consulta limpieza" on public.limpieza_ejecuciones
for select to authenticated using (public.es_administrador());

-- Retirar el borrado SQL incompatible también de instalaciones existentes.
create or replace function public.eliminar_reportes_vencidos()
returns void language plpgsql security definer set search_path = '' as $$
begin
    raise exception 'Use ejecutar_limpieza_reportes(): las evidencias se eliminan mediante la API de Storage';
end;
$$;
revoke all on function public.eliminar_reportes_vencidos() from public, anon, authenticated;

create or replace function public.ejecutar_limpieza_reportes()
returns bigint language plpgsql security definer set search_path = '' as $$
declare proyecto text; secreto text;
begin
    select decrypted_secret into proyecto from vault.decrypted_secrets where name = 'project_url';
    select decrypted_secret into secreto from vault.decrypted_secrets where name = 'limpieza_secret';
    if proyecto is null or proyecto !~ '^https://[^/]+[.]supabase[.]co/?$'
       or secreto is null or length(secreto) < 32 then
        raise exception 'Configure project_url y limpieza_secret (mínimo 32 caracteres) en Vault; consulte LIMPIEZA.md';
    end if;
    return net.http_post(
        url := rtrim(proyecto, '/') || '/functions/v1/limpiar-reportes',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-limpieza-secret', secreto),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
end;
$$;
-- Solo SQL Editor / pg_cron pueden iniciar un proceso con credenciales de servicio.
revoke all on function public.ejecutar_limpieza_reportes() from public, anon, authenticated;
commit;
