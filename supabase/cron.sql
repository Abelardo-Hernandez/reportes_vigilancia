-- Ejecutar después de activar pg_cron en Integrations > Cron Postgres Module.
-- Limpieza diaria a las 03:15 UTC. El nombre repetido actualiza el trabajo existente.
select cron.schedule(
    'eliminar-reportes-vencidos',
    '15 3 * * *',
    $$select public.eliminar_reportes_vencidos();$$
);
