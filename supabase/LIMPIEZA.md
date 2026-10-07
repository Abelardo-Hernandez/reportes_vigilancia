# Activar la limpieza de reportes y fotografías

La limpieza conserva los últimos 15 días y elimina lo anterior mediante la API
de Storage. Ya no modifica `storage.objects` con SQL. No requiere actualizar el APK.
Los archivos del repositorio no cambian por sí solos el proyecto remoto: hay que
desplegar la función y ejecutar los SQL siguientes.

## 1. Configurar el secreto privado

Genere un secreto aleatorio de al menos 32 caracteres. En PowerShell puede usar:

```powershell
$bytesLimpieza = New-Object byte[] 32
$generadorLimpieza = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$generadorLimpieza.GetBytes($bytesLimpieza)
$generadorLimpieza.Dispose()
[Convert]::ToBase64String($bytesLimpieza)
```

Guarde el mismo valor en ambos lugares del Dashboard:

- **Edge Functions > Secrets**: nombre `LIMPIEZA_SECRET`.
- **Vault > Secrets**: nombre `limpieza_secret`.

En Vault cree también `project_url`, con el valor
`https://avvoumjjrjxncnogsyfw.supabase.co` (o la URL de su proyecto si es distinto).
Si ya existen estos nombres, edite sus valores en vez de duplicarlos.
No incluya el secreto ni la clave de servicio en `docs`, en la app o en Git.
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son variables incorporadas de las
Edge Functions alojadas; el proceso utiliza la clave de servicio exclusivamente
en el servidor.

## 2. Desplegar la Edge Function

Con Supabase CLI instalado, desde la raíz del proyecto:

```powershell
supabase login
supabase functions deploy limpiar-reportes --project-ref avvoumjjrjxncnogsyfw --no-verify-jwt
```

El despliegue incluye `supabase/functions/limpiar-reportes/index.ts` y
`limpieza.mjs`. Si usa el editor de Edge Functions del Dashboard, cree una función
llamada `limpiar-reportes`, añada ambos archivos y desactive la verificación JWT
para esta función. El código verifica `x-limpieza-secret` antes de consultar o
borrar datos; las cuentas normales no pueden iniciar la limpieza.

## 3. Instalar la corrección y programar

En Supabase SQL Editor, con el rol `postgres`:

1. Ejecute **`limpieza_reportes.sql`**, después de `schema.sql` y `multiubicacion.sql`.
   Instala el registro de ejecuciones, activa `pg_net` y reemplaza la función antigua.
2. Con Cron activado en Integrations, ejecute **`cron.sql`** actualizado.
   El mismo nombre reemplaza el trabajo anterior: no crea una segunda limpieza.

La programación continúa siendo diaria a las **03:15 UTC**, equivalentes a las
**21:15 del día anterior en Ciudad de México**. Cada ejecución procesa hasta
1000 reportes en lotes de 100, con un límite de tiempo. Un resultado `partial`
indica que hay pendientes; puede volver a ejecutar el paso siguiente para
terminar una acumulación de reportes vencidos.

## 4. Ejecutar una limpieza y comprobar el resultado

Esta llamada elimina realmente los reportes con más de 15 días y sus evidencias:

```sql
select public.ejecutar_limpieza_reportes() as request_id;
```

La solicitud HTTP sale después de confirmar la transacción. Espere unos segundos
y ejecute **por separado**:

```sql
select iniciado_en, terminado_en, fecha_limite, estado,
       reportes_eliminados, fotos_eliminadas, error
from public.limpieza_ejecuciones
order by iniciado_en desc
limit 10;
```

- `succeeded`: limpieza completada para la fecha límite registrada.
- `partial`: quedan reportes vencidos; vuelva a invocar la función.
- `failed`: revise `error`. Los reportes del lote que falló se conservan para reintentar.
- `running`: ejecución iniciada; si no termina, revise los logs de Edge Functions.

Para verificar los pendientes:

```sql
select count(*) as reportes_vencidos
from public.reportes
where creado_en < now() - interval '15 days';
```

Si no aparece una ejecución, revise la respuesta HTTP utilizando el `request_id`
devuelto por la primera consulta:

```sql
select id, status_code, timed_out, error_msg, content
from net._http_response
where id = 123; -- Reemplace por su request_id.
```

Un `401` indica que los secretos no coinciden; `503`, variables faltantes;
`404`, una función sin desplegar o una URL equivocada; `500`, un fallo de limpieza.
Los resultados HTTP son temporales; `limpieza_ejecuciones` conserva el resultado
del proceso. `cron.job_run_details.status = 'succeeded'` solo confirma que Cron
encoló la solicitud: compruebe también la respuesta HTTP y el registro de limpieza.

Si Storage se borró correctamente pero el borrado de reportes falló, sus rutas
se conservan para el siguiente intento. No hay una transacción compartida entre
Storage y PostgreSQL: durante ese intervalo puede haber reportes vencidos cuyas
fotos ya no están disponibles.

Referencias oficiales: [eliminar objetos por la API de Storage](https://supabase.com/docs/guides/storage/management/delete-objects)
y [programar Edge Functions con Cron y Vault](https://supabase.com/docs/guides/functions/schedule-functions).
