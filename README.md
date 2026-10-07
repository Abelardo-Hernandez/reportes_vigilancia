# Reportes de Vigilancia

App de vigilancia con administración central en Supabase y reportes para WhatsApp.
Administrador y vigilante utilizan la misma app con permisos diferentes.

## Vigilantes por unidad

Antes de actualizar la app, ejecutar [vigilantes_por_unidad.sql](supabase/vigilantes_por_unidad.sql)
después de `multiubicacion.sql`. El administrador enlaza el correo de acceso a
la unidad y registra sus vigilantes. Cada persona selecciona su nombre al entrar
a reportar y en cada relevo. El nombre queda guardado en el reporte y en la columna
Vigilante de Excel, que permite filtrar. Los reportes anteriores se conservan.
Una cuenta compartida identifica al autor por selección, sin autenticarlo individualmente.
El APK anterior requiere una nueva compilación para incluir estos cambios.

## Activación de la nueva versión

Para activar o corregir la retención de 15 días, seguir
[supabase/LIMPIEZA.md](supabase/LIMPIEZA.md). La limpieza utiliza una Edge Function
y la API de Storage; el Cron actualizado requiere desplegar esa función primero.

Seguir [supabase/ACTIVACION.md](supabase/ACTIVACION.md) para instalar la migración,
crear el primer administrador y asignar vigilantes a sus ubicaciones.
La actualización necesita activar el SQL antes de utilizarse en los teléfonos.

## Version

Actual: `2.3.0`

- Estilo unificado en acceso, selección de unidad y formularios.
- Selector de unidades con acciones para la unidad elegida.
- Botón destacado para tomar o cambiar la foto del reporte.
- Excel por tipo de reporte, con campos del formulario, vigilante y fecha en horario CDMX.
- APK firmado: `PT-Reportes-v2.3.0.apk`.

- Panel global organizado por tareas y unidad seleccionada.
- Herramientas avanzadas con código adicional, válidas durante 10 minutos por sesión.
- Histórico paginado con filtros por fecha, unidad, vigilante y tipo; exportación Excel completa.
- Directorio de vigilantes, asignaciones por unidad y edición de nombres de unidades.
- No requiere cambios en SQL respecto de 2.1; la retención existente permanece en 15 días si se programó su limpieza.

- Cuentas de administrador y vigilante con autenticación de Supabase.
- Ubicaciones y asignaciones de vigilantes desde la app.
- Formularios y catálogos publicados por ubicación, con versiones inmutables.
- Historial central filtrado por ubicación, con acceso a evidencias.
- Requiere internet para autenticación, configuración remota y envío.
- Hora del reloj del dispositivo y nombre del vigilante automáticos.
- Unidades autorizadas por vigilante (planta o sucursal).
- Vista previa desplazable con acciones visibles y foto opcional al final.
- Foto y texto compartidos mediante el selector nativo de Android; elegir WhatsApp.
- Opción `Otro` en campos de catálogo.
- Logo e icono de Punto Textil.

## GitHub Pages

Configurar Pages con:

- Branch: `main`
- Folder: `/docs`

## APK Android

El proyecto Android se genera con Capacitor y usa los archivos estaticos de `/docs`.

Comandos:

```bash
npm install
npm run android:sync
npm run android:apk
```

El APK debug queda en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Requisitos para compilar:

- JDK configurado en `JAVA_HOME`.
- Android SDK, normalmente instalado con Android Studio.

## Verificación local

`npm test` verifica permisos RLS y migraciones con PostgreSQL (PGlite), además de
los flujos de la app con JSDOM. No requiere credenciales ni modifica Supabase.
