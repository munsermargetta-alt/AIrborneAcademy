/*
 * sw.js — "Service worker": guarda la app en el teléfono para que funcione sin internet.
 * Cómo funciona:
 *  - Al instalarse, descarga la lista ARCHIVOS y la guarda en una caché con nombre VERSION.
 *  - Cada vez que la app pide un archivo, primero intenta internet (para tener lo más nuevo);
 *    si no hay señal, usa la copia guardada.
 *  - El formato AFAC (1.4 MB) y pdf-lib (0.5 MB) NO se descargan al instalar, para no gastar datos:
 *    se guardan la primera vez que alguien descarga un plan de vuelo, y desde ahí funcionan sin internet.
 *  - Las consultas de METAR/TAF en vivo (?ids=) nunca se guardan: siempre van a internet.
 *  - Para publicar una versión nueva, cambia VERSION y los teléfonos se actualizan solos.
 */
const VERSION = 'airborne-herramientas-v9';
const ARCHIVOS = [
  './', './index.html', './app.css', './app.js', './calc.js', './fpl.js', './guias.js', './afac_pdf.js', './rutas_seneam.js', './pesobalance.js', './bitacora.js', './ingles.js', './meteo.js', './esperas.html', './manifest.webmanifest',
  './icono-180.png', './icono-192.png', './icono-512.png', './icono-maskable-512.png',
  '../img/logo.png', '../img/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // borra cachés de versiones anteriores
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Los METAR/TAF en vivo NO se guardan: un reporte viejo servido sin internet sería engañoso
  if (new URL(e.request.url).searchParams.has('ids')) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        // guarda una copia de lo que llegó bien (incluye las fuentes de Google)
        if (r && (r.ok || r.type === 'opaque')) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
