/*
 * worker.js — Intermediario de METAR y TAF para la app de AIrborne Academy.
 * ------------------------------------------------------------------------
 * ¿Por qué existe?
 *   aviationweather.gov (NOAA) da los METAR y TAF gratis, pero NO deja que una página web
 *   los lea directamente desde el navegador (no envía el permiso CORS). Este pequeño programa
 *   corre en Cloudflare Workers (gratis hasta 100,000 consultas al día): la app le pregunta,
 *   él le pregunta a la NOAA y le devuelve la respuesta a la app con el permiso.
 *
 * Qué hace, paso a paso:
 *   1. Solo acepta GET /?ids=MMTO  (hasta 4 aeropuertos separados por coma).
 *   2. Revisa que cada código tenga 4 letras/números (para no reenviar basura a la NOAA).
 *   3. Busca la respuesta en su caché: si alguien pidió lo mismo hace menos de 5 minutos,
 *      la devuelve sin molestar a la NOAA (su límite es 100 consultas por minuto).
 *   4. Si no, pide el METAR y el TAF a la NOAA al mismo tiempo, los resume en un formato
 *      simple y propio ({ id, nombre, metar, taf }) y los guarda 5 minutos.
 *   5. Agrega el permiso CORS solo para nuestro sitio (y localhost para pruebas).
 *
 * No guarda datos de los usuarios ni usa cookies. No necesita llaves ni contraseñas.
 */

// Sitios que pueden usar este intermediario desde el navegador
const PERMITIDOS = [
  'https://airborneacademy.app',
  'https://www.airborneacademy.app',
  'https://munsermargetta-alt.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
const NOAA = 'https://aviationweather.gov/api/data';
const CACHE_SEGUNDOS = 300;                       // 5 minutos
// La NOAA pide identificarse con un "user agent" propio para no confundirnos con un robot abusivo
const IDENTIDAD = 'AIrborneAcademy/1.0 (+https://airborneacademy.app; contacto@airborneacademy.app)';

export default {
  async fetch(request, env, ctx) {
    const origen = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': PERMITIDOS.includes(origen) ? origen : PERMITIDOS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
    };
    // El navegador a veces pregunta primero "¿puedo?" con OPTIONS
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'Solo se permite GET.' }, 405, cors);

    // 1–2. Leer y validar los códigos
    const url = new URL(request.url);
    const ids = [...new Set((url.searchParams.get('ids') || '').toUpperCase().split(/[\s,]+/).filter(Boolean))].sort();
    if (!ids.length) return json({ error: 'Falta ?ids=MMTO (código OACI del aeropuerto).' }, 400, cors);
    if (ids.length > 4) return json({ error: 'Máximo 4 aeropuertos por consulta.' }, 400, cors);
    if (!ids.every((i) => /^[A-Z][A-Z0-9]{3}$/.test(i))) return json({ error: 'Código OACI inválido: deben ser 4 letras o números.' }, 400, cors);

    // 3. ¿Lo tenemos en caché? (la clave es la lista de códigos ordenada)
    const cache = caches.default;
    const clave = new Request('https://cache.airborneacademy.app/meteo?ids=' + ids.join(','));
    let respuesta = await cache.match(clave);

    if (!respuesta) {
      // 4. Pedir METAR y TAF a la NOAA al mismo tiempo
      let metars, tafs;
      try {
        [metars, tafs] = await Promise.all([pedir('metar', ids), pedir('taf', ids)]);
      } catch (e) {
        // Si la NOAA falla, avisamos y NO guardamos en caché (para reintentar pronto)
        return json({ error: 'aviationweather.gov no respondió. Intenta en un momento.', detalle: String(e.message || e) }, 502, cors);
      }
      const estaciones = ids.map((id) => {
        // La NOAA puede devolver varios reportes por estación: nos quedamos con el más reciente
        const m = masReciente(metars.filter((x) => x.icaoId === id), (x) => aNumero(x.obsTime));
        const t = masReciente(tafs.filter((x) => x.icaoId === id), (x) => aNumero(x.issueTime));
        return {
          id,
          nombre: (m && m.name) || (t && t.name) || null,
          metar: m ? (m.rawOb || null) : null,
          taf: t ? (t.rawTAF || null) : null,
        };
      });
      respuesta = new Response(JSON.stringify({
        fuente: 'NOAA / NWS Aviation Weather Center (aviationweather.gov)',
        obtenido: new Date().toISOString(),
        estaciones,
      }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${CACHE_SEGUNDOS}` } });
      // Guardar en caché sin hacer esperar al usuario
      ctx.waitUntil(cache.put(clave, respuesta.clone()));
    }

    // 5. Devolver con el permiso CORS
    const final = new Response(respuesta.body, respuesta);
    for (const [k, v] of Object.entries(cors)) final.headers.set(k, v);
    return final;
  },
};

// Pide un producto (metar o taf) a la NOAA en formato JSON
async function pedir(producto, ids) {
  const r = await fetch(`${NOAA}/${producto}?ids=${ids.join(',')}&format=json`, {
    headers: { 'User-Agent': IDENTIDAD, 'Accept': 'application/json' },
  });
  if (r.status === 204) return [];                 // la NOAA responde 204 cuando no hay datos
  if (!r.ok) throw new Error(`${producto}: HTTP ${r.status}`);
  const texto = await r.text();
  if (!texto.trim()) return [];
  const datos = JSON.parse(texto);
  return Array.isArray(datos) ? datos : [];
}

// Las fechas pueden venir como número (segundos) o como texto ISO: las dejamos en milisegundos
function aNumero(f) {
  if (typeof f === 'number') return f < 1e12 ? f * 1000 : f;
  const n = Date.parse(f || '');
  return Number.isNaN(n) ? 0 : n;
}

function masReciente(lista, fecha) {
  return lista.reduce((mejor, x) => (!mejor || fecha(x) > fecha(mejor) ? x : mejor), null);
}

function json(obj, estado, cors) {
  return new Response(JSON.stringify(obj), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
}
