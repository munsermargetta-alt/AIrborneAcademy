// prueba.mjs — prueba la función sin internet (simula la NOAA). Correr: node prueba.mjs
import fn from './netlify/functions/meteo.mjs';
globalThis.fetch = async (url) => url.includes('/metar?')
  ? new Response(JSON.stringify([{ icaoId: 'MMTO', name: 'Toluca', obsTime: 1, rawOb: 'METAR viejo' }, { icaoId: 'MMTO', name: 'Toluca', obsTime: 2, rawOb: 'METAR MMTO 181542Z 36008KT 9SM SKC 17/02 A3031' }]))
  : new Response(null, { status: 204 });
let ok = 0, mal = 0; const p = (n, a, b) => { const v = JSON.stringify(a) === JSON.stringify(b); console.log(`${v ? '✔' : '✘'} ${n}: ${JSON.stringify(a)}`); v ? ok++ : mal++; };
const q = (s, m = 'GET', o = 'https://airborneacademy.app') => fn(new Request('https://x.netlify.app/meteo' + s, { method: m, headers: { origin: o } }));
let r = await q('?ids=mmto'); const j = await r.json();
p('200', r.status, 200); p('METAR más reciente', j.estaciones[0].metar, 'METAR MMTO 181542Z 36008KT 9SM SKC 17/02 A3031'); p('sin TAF', j.estaciones[0].taf, null);
p('CORS', r.headers.get('access-control-allow-origin'), 'https://airborneacademy.app'); p('caché CDN', /max-age=300/.test(r.headers.get('netlify-cdn-cache-control')), true);
p('otro sitio', (await q('?ids=MMTO', 'GET', 'https://otro.com')).headers.get('access-control-allow-origin'), 'https://airborneacademy.app');
p('inválido 400', (await q('?ids=MM;TO')).status, 400); p('más de 4', (await q('?ids=A111,B222,C333,D444,E555')).status, 400);
p('POST 405', (await q('?ids=MMTO', 'POST')).status, 405); p('OPTIONS 204', (await q('?ids=MMTO', 'OPTIONS')).status, 204);
console.log(`\n${ok} correctas, ${mal} con error`);
