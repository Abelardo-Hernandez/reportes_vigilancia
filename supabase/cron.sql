-- Ejecutar DESPUÉS de completar LIMPIEZA.md: Edge Function, Vault y limpieza_reportes.sql.
-- Limpieza diaria a las 03:15 UTC. El nombre repetido actualiza el trabajo existente.
select cron.schedule(
    'eliminar-reportes-vencidos',
    '15 3 * * *',
    $$select public.ejecutar_limpieza_reportes();$$
);
