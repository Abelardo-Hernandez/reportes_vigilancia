# Reportes de Vigilancia

App de vigilancia con administración central en Supabase y reportes para WhatsApp.
Administrador y vigilante utilizan la misma app con permisos diferentes.

## Activación de la nueva versión

Seguir [supabase/ACTIVACION.md](supabase/ACTIVACION.md) para instalar la migración,
crear el primer administrador y asignar vigilantes a sus ubicaciones.
La actualización necesita activar el SQL antes de utilizarse en los teléfonos.

## Version

Actual: `2.2.0`

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
