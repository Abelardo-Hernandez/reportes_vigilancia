const CACHE_NAME = "reportes-vigilancia-v50";
const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./configuracion-reportes-vigilancia.json",
    "./css/styles.css",
    "./css/admin.css",
    "./js/app.js",
    "./js/cloud.js",
    "./js/report-context.js",
    "./js/admin-ui.js",
    "./js/vendor/exceljs.min.js",
    "./js/supabase.js",
    "./js/background.js",
    "./img/logo.png",
    "./icons/icon-180.png",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon.svg"
];

function fetchConTimeout(request, timeout = 5000) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeout);

    return fetch(request, { signal: controlador.signal }).finally(() => {
        clearTimeout(temporizador);
    });
}

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);
    // Solo recursos de la app: nunca cachear respuestas autenticadas de Supabase.
    if (url.origin !== self.location.origin) return;
    const esConfiguracion = url.pathname.endsWith("/configuracion-reportes-vigilancia.json");

    if (esConfiguracion) {
        event.respondWith(
            fetchConTimeout(event.request, 4000).then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            }).catch(() => caches.match(event.request, { ignoreSearch: true }))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            }).catch(() => caches.match("./index.html"));
        })
    );
});
