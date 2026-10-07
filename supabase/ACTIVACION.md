## Corrección de la limpieza automática

Si Cron falla con `Direct deletion from storage tables is not allowed`, siga
[LIMPIEZA.md](LIMPIEZA.md). Hay que desplegar `limpiar-reportes`, configurar sus
secretos, ejecutar `limpieza_reportes.sql` y después el `cron.sql` actualizado.
La limpieza elimina reportes y fotografías con más de 15 días mediante la API
de Storage. No requiere recompilar el APK.

## Actualización: vigilantes por unidad

1. Ejecutar `vigilantes_por_unidad.sql` después de `multiubicacion.sql`.
2. Con la app actualizada, enlazar el correo de la unidad en la pestaña Correos de acceso.
3. Seleccionar la unidad y registrar sus vigilantes. No se necesita correo para cada persona.
4. Seleccionar el nombre al crear reportes y en cada relevo. Los vigilantes desactivados
   dejan de estar disponibles; sus reportes y nombres históricos se conservan.
5. Distribuir una nueva compilación Android; el APK anterior no incluye este flujo.

# Activar administración por ubicación

## Cambios de la versión 2.2

Instalar `PT-Reportes-v2.2.0.apk`. No ejecutar otra migración: se mantienen
administradores globales y las mismas políticas de Supabase.

El panel permite elegir una unidad, editar sus formularios/catálogos y publicar.
En Unidades y vigilantes se separan las plantas del directorio y las asignaciones.
Se puede renombrar una unidad, activarla/desactivarla y retirar asignaciones sin
borrar reportes anteriores. Las cuentas aún se registran desde la pantalla de acceso;
esta versión no añade alta administrativa de cuentas ni edición/borrado de perfiles.

Configuración avanzada pide el código acordado. Habilita importación, exportación,
recuperación de la configuración anterior y recarga del borrador publicado durante
10 minutos. Se bloquea al cerrar sesión, cambiar cuenta o volver a abrir la app.
Es un bloqueo de interfaz adicional: el código incluido en una app distribuida no
equivale a un secreto de servidor ni crea un rol de superadministrador. Los permisos
reales siguen siendo los de la cuenta en Supabase.

Histórico consulta páginas de 50 registros con filtros por fecha local, unidad,
autor y texto en el nombre del tipo de reporte. Los filtros solo cambian al pulsar
Buscar reportes. Excel descarga todos los registros disponibles de la búsqueda
aplicada, incluso si hay más de 1000. Incluye Reportes, Respuestas, Mensajes y Consulta.
Los textos largos se separan en partes para no perder contenido. Las fotografías
se consultan dentro de la app; Excel incluye su referencia privada, no una URL pública.
En Android se abre el selector para guardar o compartir el archivo.

La retención sigue siendo 15 días si `cron.sql` está activado. La pantalla avanzada
informa de esa regla, pero no cambia su plazo ni programa borrados. No se añadió
almacenamiento local que aparente cambiar una regla ejecutada en el servidor.

## Cambios de la versión 2.1

Si ya se ejecutó `multiubicacion.sql`, esta actualización no requiere nuevo SQL.
Instalar el APK 2.1.0 para disponer de los complementos nativos de compartir fotos.

«Unidad» significa planta o sucursal; internamente se conserva la tabla `ubicaciones`.
El administrador habilita o retira unidades de cada vigilante en Unidades y vigilantes.
Si hay una sola asignada, queda seleccionada; si hay varias, el vigilante elige una.

La hora se captura del reloj del dispositivo al generar la vista previa. Editar
y volver a generar el mensaje actualiza esa hora. El servidor conserva además su
propia fecha de recepción (`creado_en`); no sustituye el reloj del teléfono.
Los campos tipo hora, los campos guardia/vigilante/nombre_guardia/nombre_vigilante
y el catálogo guardias se completan automáticamente. Unidad/ubicacion usan la
unidad autorizada seleccionada. Para nombres de campo distintos, el administrador
puede elegir «Completar con» en el editor de campos y publicar la configuración.
Se usa el nombre del perfil; si falta, se muestra el correo de la cuenta.

La foto se toma al final de la vista previa y se puede quitar antes de guardar.
Se comprime y se sube al mismo reporte. En Android se abre el selector nativo con
la imagen y el mensaje: el usuario elige WhatsApp, destinatario y confirma el envío.
Cancelar compartir conserva el reporte y permite reintentar sin duplicarlo.
La app no verifica la entrega del mensaje en WhatsApp. Se necesita probar el flujo
en el teléfono con la versión de WhatsApp instalada.

En navegador, el primer clic guarda y el segundo comparte, para cumplir el requisito
de activación del usuario. Las fotos requieren soporte de Web Share con archivos;
si no está disponible, la app indica que se utilice Android, sin omitir la foto en
silencio. El texto del reporte nunca se interpreta como HTML en la vista previa.

Referencias: [compartir en Capacitor](https://capacitorjs.com/docs/v7/apis/share)
y [archivos de caché](https://capacitorjs.com/docs/v7/apis/filesystem).

Esta versión necesita internet para iniciar sesión, consultar asignaciones, descargar
formularios y enviar reportes. No implementa una cola de reportes sin conexión.
Las asignaciones son por cuenta de vigilante; la misma cuenta puede iniciar sesión
en distintos dispositivos. No se vinculan a un número de serie del teléfono.

## 1. Preparar Supabase

En SQL Editor, ejecutar en este orden:

1. `schema.sql`, únicamente si todavía no se había instalado el esquema inicial.
2. `multiubicacion.sql`, tanto para instalaciones nuevas como para actualizar.

La migración conserva los reportes existentes (aparecen como «Sin ubicación»).
Puede ejecutarse nuevamente. No volver a ejecutar `schema.sql` después de la
migración, porque restablecería la política anterior de inserción de reportes.
Actualizar los teléfonos junto con esta migración: las versiones antiguas ya no
podrán enviar reportes sin ubicación y configuración publicada.

En Authentication habilitar Email/password. Anonymous Sign-Ins ya no es necesario:
las sesiones anónimas anteriores no dan acceso a la nueva app.
Si se usa confirmación por correo, configurar una URL de confirmación válida en
Authentication > URL Configuration; después de confirmar, el usuario vuelve a la
app e ingresa con correo y contraseña. No hace falta alojar un portal de administración.

La URL y la clave **publishable** del proyecto están en `docs/js/supabase.js`.
Nunca colocar una clave `service_role` en la app.

## 2. Crear el primer administrador

Crear la cuenta con correo y contraseña desde la app y confirmar el correo si se
solicita. Inicialmente todas las cuentas son vigilantes, sin ubicaciones asignadas.
En SQL Editor, ejecutar lo siguiente sustituyendo el correo:

```sql
update public.perfiles
set rol = 'admin'
where id = (
  select id from auth.users where lower(email) = lower('TU_CORREO@EMPRESA.COM')
)
returning id, correo, rol;
```

Debe devolver exactamente una fila. Ingresar nuevamente o pulsar Actualizar
ubicaciones para que la app reconozca el rol. Las contraseñas locales de la
versión anterior ya no sirven como acceso administrativo.

## 3. Configurar y asignar

1. Administrador → Ubicaciones y vigilantes → Crear ubicación.
2. Pulsar Configurar formularios y catálogos en la ubicación elegida.
3. Editar formularios y catálogos con los editores existentes. En Datos se puede
   importar un JSON o recuperar la configuración de la versión anterior del mismo
   dispositivo; la copia anterior se conserva.
4. Volver al panel y pulsar Publicar formularios y catálogos.
5. Cada vigilante crea y confirma su cuenta. El administrador la selecciona en
   Asignar vigilante y la asigna a una o más ubicaciones.
6. El vigilante ingresa, elige su ubicación y pulsa Nuevo reporte. En ese momento
   recibe la última configuración publicada. No se interrumpe un formulario que
   ya estaba llenando cuando se publica otra versión.

El administrador puede consultar los últimos 100 reportes, filtrar por ubicación
y ver evidencias. Desactivar una ubicación o retirar una asignación impide nuevos
envíos, incluso si el teléfono ya había descargado un formulario.

## Borradores, historial y actualización

Los borradores se guardan localmente, separados por cuenta y ubicación. Solo la
publicación los envía a Supabase. Para continuar desde otro equipo hay que publicar
o exportar/importar el borrador. La versión base evita sobrescribir por accidente
una publicación más reciente de otro administrador. Ante un conflicto, exportar
el borrador y usar Recargar versión publicada antes de integrar los cambios.

Cada reporte guarda la ubicación, el identificador de la publicación y una copia
del formulario tomada por PostgreSQL. Los clientes no pueden editar publicaciones.
Las cuentas no pueden concederse permisos mediante cambios en el almacenamiento
local ni mediante metadatos de registro.

La retención previa permanece igual: **si se activó `cron.sql`, se eliminan los
reportes de más de 15 días**. La consulta histórica no cambia ese plazo. No activar
ese cron si se requiere conservar los reportes por más tiempo sin antes ajustar
la política de retención.

## Pruebas y APK

```powershell
npm install
npm test
npm run android:sync
npm run android:apk
```

Las pruebas ejecutan las migraciones y reglas RLS en PostgreSQL local con PGlite,
y los flujos de la app en JSDOM con respuestas simuladas de Supabase. No modifican
el proyecto remoto. La prueba final en dispositivos requiere activar el SQL,
crear dos cuentas y comprobar publicación/asignación/envío entre ambos teléfonos.

Referencia: [autenticación por contraseña](https://supabase.com/docs/guides/auth/passwords)
y [permisos RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
