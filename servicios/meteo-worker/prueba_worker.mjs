/*
 * prueba_worker.mjs — Prueba el intermediario SIN internet: simula la NOAA y la caché de Cloudflare.
 * Correr con: node prueba_worker.mjs
 */
import worker from './worker.js';

let llamadasNOAA = 0;
// Simulación de la NOAA: responde con datos con la misma forma que su API
globalThis.fetch = async (url, op) => {
  llamadasNOAA++;
  if (!/AIrborneAcademy/.test(op.headers['User-Agent'])) throw new Error('falta user agent');
  if (url.includes('/metar?')) return new Response(JSON.stringify([
    { icaoId: 'MMTO', name: 'Toluca/Lic Adolfo Lopez Mateos Intl, MX', obsTime: 100, rawOb: 'METAR MMTO 181442Z 00000KT 9SM SKC 10/M01 A3030' },
    { icaoId: 'MMTO', name: 'Toluca/Lic Adolfo Lopez Mateos Intl, MX', obsTime: 200, rawOb: 'METAR MMTO 181542Z 36008KT 9SM SCT020 17/02 A3031' },
  ]));
  if (url.includes('/taf?')) return new Response(null, { status: 204 });
  return new Response('x', { status: 500 });
};
// Simulación de la caché de Cloudflare
const almacen = new Map();
globalThis.caches = { default: { match: async (r) => almacen.get(r.url)?.clone(), put: async (r, resp) => { almacen.set(r.url, resp); } } };
const ctx = { waitUntil: (p) => p };

let ok = 0, mal = 0;
const p = (n, a, b) => { const bien = JSON.stringify(a) === JSON.stringify(b); console.log(`${bien ? '✔' : '✘'} ${n}: ${JSON.stringify(a)}`); bien ? ok++ : mal++; };
const pedir = (q, origen = 'https://airborneacademy.app', metodo = 'GET') => worker.fetch(new Request('https://x.workers.dev/' + q, { method: metodo, headers: { Origin: origen } }), {}, ctx);

let r = await pedir('?ids=mmto');
let j = await r.json();
p('responde 200', r.status, 200);
p('toma el METAR más reciente', j.estaciones[0].metar, 'METAR MMTO 181542Z 36008KT 9SM SCT020 17/02 A3031');
p('sin TAF (204) → null', j.estaciones[0].taf, null);
p('nombre', j.estaciones[0].nombre, 'Toluca/Lic Adolfo Lopez Mateos Intl, MX');
p('CORS para nuestro sitio', r.headers.get('Access-Control-Allow-Origin'), 'https://airborneacademy.app');
p('2 llamadas a la NOAA (METAR y TAF)', llamadasNOAA, 2);
await pedir('?ids=MMTO');
p('segunda consulta sale de la caché', llamadasNOAA, 2);
r = await pedir('?ids=MMTO', 'https://otro-sitio.com');
p('otro sitio no recibe su propio permiso', r.headers.get('Access-Control-Allow-Origin'), 'https://airborneacademy.app');
p('código inválido → 400', (await pedir('?ids=MM%3BTO')).status, 400);
p('más de 4 → 400', (await pedir('?ids=MMTO,MMMX,MMGL,MMMY,MMUN')).status, 400);
p('POST → 405', (await pedir('?ids=MMTO', undefined, 'POST')).status, 405);
p('OPTIONS → 204', (await pedir('?ids=MMTO', undefined, 'OPTIONS')).status, 204);

console.log(`\n${ok} correctas, ${mal} con error`);
process.exit(mal ? 1 : 0);
