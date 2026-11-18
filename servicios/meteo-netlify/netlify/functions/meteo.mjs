/*
 * meteo.mjs — Intermediario de METAR y TAF para la app de AIrborne Academy (Netlify Functions).
 * --------------------------------------------------------------------------------------------
 * ¿Por qué existe?
 *   aviationweather.gov (NOAA) da los METAR y TAF gratis, pero NO deja que una página web los lea
 *   directamente desde el navegador (no envía el permiso CORS). Esta función corre en Netlify:
 *   la app le pregunta, ella le pregunta a la NOAA y le devuelve la respuesta a la app con permiso.
 *   Los METAR de México que publica la NOAA son los mismos que emite SENEAM (llegan por la red de la OMM).
 *
 * Dirección: https://<proyecto>.netlify.app/meteo?ids=MMTO   (hasta 4 códigos separados por coma)
 *
 * Qué hace, paso a paso:
 *   1. Solo acepta GET (y OPTIONS, la pregunta previa del navegador).
 *   2. Revisa que cada código tenga 4 letras/números (para no reenviar basura a la NOAA).
 *   3. Pide METAR y TAF a la NOAA al mismo tiempo y los resume en un formato propio:
 *      { fuente, obtenido, estaciones: [{ id, nombre, metar, taf }] }
 *   4. Le pide a la red de Netlify (CDN) que guarde la respuesta 5 minutos por cada consulta distinta:
 *      si 100 alumnos piden MMTO en esos 5 minutos, la NOAA recibe UNA sola consulta
 *      (su límite es 100 por minuto) y la función casi no se ejecuta (cuida el plan gratuito).
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
const CACHE_SEGUNDOS = 300; // 5 minutos
// La NOAA pide identificarse con un "user agent" propio para no confundirnos con un robot abusivo
const IDENTIDAD = 'AIrborneAcademy/1.0 (+https://airborneacademy.app; contacto@airborneacademy.app)';

export default async (req) => {
  const origen = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': PERMITIDOS.includes(origen) ? origen : PERMITIDOS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  // 1. El navegador a veces pregunta primero "¿puedo?" con OPTIONS
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return json({ error: 'Solo se permite GET.' }, 405, cors);

  // 2. Leer y validar los códigos
  const url = new URL(req.url);
  const ids = [...new Set((url.searchParams.get('ids') || '').toUpperCase().split(/[\s,]+/).filter(Boolean))].sort();
  if (!ids.length) return json({ error: 'Falta ?ids=MMTO (código OACI del aeropuerto).' }, 400, cors);
  if (ids.length > 4) return json({ error: 'Máximo 4 aeropuertos por consulta.' }, 400, cors);
  if (!ids.every((i) => /^[A-Z][A-Z0-9]{3}$/.test(i))) return json({ error: 'Código OACI inválido: deben ser 4 letras o números.' }, 400, cors);

  // 3. Pedir METAR y TAF a la NOAA al mismo tiempo
  let metars, tafs;
  try {
    [metars, tafs] = await Promise.all([pedir('metar', ids), pedir('taf', ids)]);
  } catch (e) {
    // Si la NOAA falla, avisamos y NO se guarda en caché (los errores no llevan encabezado de caché)
    return json({ error: 'aviationweather.gov no respondió. Intenta en un momento.', detalle: String(e.message || e) }, 502, cors);
  }
  const estaciones = ids.map((id) => {
    // La NOAA puede devolver varios reportes por estación: nos quedamos con el más reciente
    const m = masReciente(metars.filter((x) => x.icaoId === id), (x) => aNumero(x.obsTime));
    const t = masReciente(tafs.filter((x) => x.icaoId === id), (x) => aNumero(x.issueTime));
    return {
      id,
      nombre: (m && m.name) || (t && t.name) || null,
      metar: m ? m.rawOb || null : null,
      taf: t ? t.rawTAF || null : null,
    };
  });

  // 4–5. Respuesta con caché de 5 minutos en la red de Netlify y permiso CORS
  return json({ fuente: 'NOAA / NWS Aviation Weather Center (aviationweather.gov)', obtenido: new Date().toISOString(), estaciones }, 200, {
    ...cors,
    // Caché compartida de Netlify: 5 min, y hasta 1 min más sirviendo la anterior mientras se renueva
    'Netlify-CDN-Cache-Control': `public, durable, max-age=${CACHE_SEGUNDOS}, stale-while-revalidate=60`,
    // Una copia distinta por cada lista de códigos y por cada sitio que pregunta (por el permiso CORS)
    'Netlify-Vary': 'query=ids,header=Origin',
    // El navegador del alumno no guarda copia: siempre pregunta (y la red responde rápido desde la caché)
    'Cache-Control': 'no-store',
  });
};

// Pide un producto (metar o taf) a la NOAA en formato JSON
async function pedir(producto, ids) {
  const r = await fetch(`${NOAA}/${producto}?ids=${ids.join(',')}&format=json`, {
    headers: { 'User-Agent': IDENTIDAD, Accept: 'application/json' },
  });
  if (r.status === 204) return []; // la NOAA responde 204 cuando no hay datos
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

function json(obj, estado, encabezados) {
  return new Response(JSON.stringify(obj), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...encabezados } });
}

// Dirección pública de la función
export const config = { path: '/meteo' };
