# Reportes de Vigilancia

PWA offline para generar reportes de vigilancia y formatearlos para WhatsApp.

## Version

Actual: `1.2.9`

- Panel de administrador con catálogos configurables.
- Formularios con hora manual en formato 12 horas.
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
