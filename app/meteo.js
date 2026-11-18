/*
 * meteo.js — METAR y TAF: decodificador bilingüe y datos reales (#/meteo). HERRAMIENTA GRATIS.
 *
 * Partes:
 *   1. LÓGICA (sin pantalla, con pruebas en pruebas_meteo.js):
 *      - decodificar(texto): reconoce si es METAR/SPECI o TAF y explica cada grupo
 *        en español y en inglés (como lo leería un ATIS).
 *      - categoria(): VFR / MVFR / IFR / LIFR (definición de la FAA/AWC).
 *      - vmcAerodromo(): mínimos OACI para despegar/aterrizar VFR en zona de control (Anexo 2, 4.2).
 *      - edadMin(): cuántos minutos tiene el reporte.
 *   2. DATOS REALES: aviationweather.gov (NOAA) NO deja que una página web lea sus datos
 *      directamente (no permite CORS). Por eso la app los pide a un intermediario nuestro
 *      (servicios/meteo-netlify, una función en Netlify), que los trae, los guarda 5 minutos y nos los devuelve.
 *      Mientras ese intermediario no esté activo, la app abre el dato oficial en otra pestaña
 *      para copiarlo y pegarlo.
 *   3. PANTALLA.
 *
 * Fuentes del formato: OACI Anexo 3 (Apéndice 3, METAR/SPECI; Apéndice 5, TAF) y
 * FAA AC 00-45H / AIM 7-1 (variantes de EUA: millas terrestres, A2992, RMK).
 */
(function (raiz) {
  'use strict';

  /* ======================= 1. LÓGICA ======================= */

  // Fenómenos: [español, inglés]
  const FENOMENOS = {
    DZ: ['llovizna', 'drizzle'], RA: ['lluvia', 'rain'], SN: ['nieve', 'snow'], SG: ['cinarra (granos de nieve)', 'snow grains'],
    IC: ['cristales de hielo', 'ice crystals'], PL: ['hielo granulado', 'ice pellets'], GR: ['granizo', 'hail'],
    GS: ['granizo pequeño o nieve granulada', 'small hail or snow pellets'], UP: ['precipitación de tipo desconocido', 'unknown precipitation'],
    BR: ['neblina (visibilidad de 1 a 5 km)', 'mist'], FG: ['niebla (visibilidad menor a 1 km)', 'fog'], FU: ['humo', 'smoke'],
    VA: ['ceniza volcánica', 'volcanic ash'], DU: ['polvo extendido', 'widespread dust'], SA: ['arena', 'sand'], HZ: ['bruma', 'haze'],
    PY: ['rocío de agua (spray)', 'spray'], PO: ['remolinos de polvo o arena', 'dust or sand whirls'], SQ: ['turbonada', 'squalls'],
    FC: ['nube embudo (tornado o tromba)', 'funnel cloud'], SS: ['tempestad de arena', 'sandstorm'], DS: ['tempestad de polvo', 'duststorm'],
  };
  // Descriptores: cómo se combinan con el fenómeno en cada idioma
  const DESCRIPTORES = {
    MI: [(f) => `${f} baja (a ras de suelo)`, (f) => `shallow ${f}`, 'bajo', 'shallow'],
    BC: [(f) => `${f} en bancos`, (f) => `patches of ${f}`, 'en bancos', 'patches'],
    PR: [(f) => `${f} parcial`, (f) => `partial ${f}`, 'parcial', 'partial'],
    DR: [(f) => `${f} levantada por el viento a baja altura`, (f) => `low drifting ${f}`, 'levantado a baja altura', 'low drifting'],
    BL: [(f) => `${f} levantada por el viento`, (f) => `blowing ${f}`, 'levantado por el viento', 'blowing'],
    SH: [(f) => (f ? `chubascos de ${f}` : 'chubascos'), (f) => (f ? `${f} showers` : 'showers'), 'chubascos', 'showers'],
    TS: [(f) => (f ? `tormenta eléctrica con ${f}` : 'tormenta eléctrica'), (f) => (f ? `thunderstorm with ${f}` : 'thunderstorm'), 'tormenta eléctrica', 'thunderstorm'],
    FZ: [(f) => `${f} engelante (se congela al tocar)`, (f) => `freezing ${f}`, 'engelante', 'freezing'],
  };
  const INTENSIDAD = { '-': ['intensidad ligera', 'light'], '+': ['intensidad fuerte', 'heavy'], VC: ['en las cercanías (8 a 16 km)', 'in the vicinity'] };
  const NUBES = {
    FEW: ['Pocas nubes (1 a 2 octavos)', 'few'], SCT: ['Nubes dispersas (3 a 4 octavos)', 'scattered'],
    BKN: ['Nubes fragmentadas (5 a 7 octavos)', 'broken'], OVC: ['Cielo cubierto (8 octavos)', 'overcast'],
  };
  const SIN_NUBES = {
    NSC: ['Sin nubes significativas (ninguna debajo de 5,000 ft ni CB/TCU)', 'No significant cloud'],
    NCD: ['Sin nubes detectadas (estación automática)', 'No cloud detected'],
    SKC: ['Cielo despejado', 'Sky clear'], CLR: ['Sin nubes debajo de 12,000 ft (estación automática de EUA)', 'Clear below one two thousand'],
  };
  const PUNTOS = { N: ['norte', 'north'], NE: ['noreste', 'northeast'], E: ['este', 'east'], SE: ['sureste', 'southeast'], S: ['sur', 'south'], SW: ['suroeste', 'southwest'], W: ['oeste', 'west'], NW: ['noroeste', 'northwest'] };
  // Grupo 8/ (tipos de nube, código OMM 0513/0515/0509). Lo usan los METAR de México en RMK.
  const NUBE_BAJA = ['ninguna', 'cúmulos de buen tiempo', 'cúmulos de desarrollo moderado o grande', 'cumulonimbos sin yunque', 'estratocúmulos formados de cúmulos', 'estratocúmulos', 'estratos', 'fractos de mal tiempo', 'cúmulos y estratocúmulos a distinta altura', 'cumulonimbos con yunque'];
  const NUBE_MEDIA = ['ninguna', 'altoestratos delgados', 'altoestratos densos o nimboestratos', 'altocúmulos delgados', 'altocúmulos lenticulares', 'altocúmulos en bandas que avanzan', 'altocúmulos formados de cúmulos', 'altocúmulos en doble capa o densos', 'altocúmulos castellanus (inestabilidad)', 'altocúmulos de cielo caótico'];
  const NUBE_ALTA = ['ninguna', 'cirros en filamentos', 'cirros densos', 'cirros de yunque de cumulonimbo', 'cirros en gancho que avanzan', 'cirros/cirroestratos que avanzan, bajos', 'cirros/cirroestratos que avanzan, altos', 'cirroestratos que cubren todo el cielo', 'cirroestratos que no cubren el cielo', 'cirrocúmulos'];

  const p3 = (n) => String(n).padStart(3, '0');
  const p2 = (n) => String(n).padStart(2, '0');
  const MES = 1609.344;                                            // metros por milla terrestre
  const it = (cod, es, en, clase = '') => ({ cod, es, en, clase });

  // Limpia el texto: mayúsculas, sin "=" final, espacios simples
  function limpiar(t) { return String(t || '').toUpperCase().replace(/=/g, ' ').replace(/\s+/g, ' ').trim(); }

  /* ----- Grupos que se repiten en METAR y TAF ----- */
  function viento(tok) {
    const m = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/.exec(tok);
    if (!m) return null;
    const f = m[4] === 'MPS' ? 1.943844 : m[4] === 'KMH' ? 0.539957 : 1;   // todo a nudos
    const vel = Math.round(+m[2] * f), raf = m[3] ? Math.round(+m[3] * f) : null;
    const dir = m[1] === 'VRB' ? null : +m[1];
    const otra = m[4] === 'KT' ? '' : ` (${+m[2]} ${m[4] === 'MPS' ? 'm/s' : 'km/h'})`;
    const dato = { dir, vel, raf };
    if (vel === 0 && dir === 0) return { it: it(tok, 'Viento en calma', 'Wind calm'), dato };
    return {
      it: it(tok, `Viento ${dir === null ? 'variable' : `de los ${p3(dir)}° verdaderos`} a ${vel} nudos${otra}${raf ? `, ráfagas de ${raf} nudos` : ''}`,
        `Wind ${dir === null ? 'variable' : `${p3(dir)} degrees`}, ${vel} knots${raf ? `, gusting ${raf} knots` : ''}`),
      dato,
    };
  }
  function variacion(tok) {
    const m = /^(\d{3})V(\d{3})$/.exec(tok);
    return m ? it(tok, `La dirección del viento varía entre ${m[1]}° y ${m[2]}°`, `Wind varying between ${m[1]} and ${m[2]} degrees`) : null;
  }
  // Visibilidad. Devuelve también cuántas piezas usó (en EUA "1 1/2SM" son dos).
  function visibilidad(toks, i) {
    const t = toks[i], sig = toks[i + 1] || '';
    if (t === 'CAVOK') {
      return { n: 1, visM: 10000, cavok: true, it: it(t, 'CAVOK: visibilidad de 10 km o más, sin nubes debajo de 5,000 ft (o de la altitud mínima de sector si es mayor), sin cumulonimbos ni tiempo significativo', 'Ceiling and visibility OK') };
    }
    let m = /^(\d{4})(NDV)?$/.exec(t);
    if (m) {
      const v = +m[1];
      const es = v === 9999 ? '10 km o más' : v === 0 ? 'menos de 50 m' : v >= 5000 ? `${v / 1000} km` : `${v.toLocaleString('es-MX')} m`;
      const en = v === 9999 ? '10 kilometers or more' : v >= 5000 ? `${v / 1000} kilometers` : `${v} meters`;
      return { n: 1, visM: v === 9999 ? 10000 : v, it: it(t, `Visibilidad ${es}${m[2] ? ' (el sensor no distingue direcciones)' : ''}`, `Visibility ${en}`) };
    }
    m = /^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/.exec(t);
    if (m) return { n: 1, it: it(t, `Visibilidad mínima de ${(+m[1]).toLocaleString('es-MX')} m hacia el ${PUNTOS[m[2]][0]}`, `Minimum visibility ${+m[1]} meters to the ${PUNTOS[m[2]][1]}`) };
    // Millas terrestres (EUA, México): 10SM, 1/2SM, M1/4SM, P6SM, o "1 1/2SM" en dos piezas
    let txt = t, n = 1;
    if (/^\d{1,2}$/.test(t) && /^\d\/\d{1,2}SM$/.test(sig)) { txt = t + ' ' + sig; n = 2; }
    m = /^([MP])?(\d{1,2})?(?:\s?(\d)\/(\d{1,2}))?SM$/.exec(txt);
    if (m && (m[2] || m[3])) {
      const sm = (m[2] ? +m[2] : 0) + (m[3] ? +m[3] / +m[4] : 0);
      const lim = m[1] === 'M' ? ['menos de ', 'less than '] : m[1] === 'P' ? ['más de ', 'more than '] : ['', ''];
      const legible = txt.replace(/^[MP]/, '').replace('SM', '');
      return { n, visM: sm * MES, it: it(txt, `Visibilidad ${lim[0]}${legible} millas terrestres (${lim[0]}${(sm * 1.609).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km)`, `Visibility ${lim[1]}${legible} statute miles`) };
    }
    return null;
  }
  function rvr(tok) {
    const m = /^R(\d{2}[LCR]?)\/([PM])?(\d{4})(?:V([PM])?(\d{4}))?(FT)?\/?([UDN])?$/.exec(tok);
    if (!m) return null;
    const u = m[6] ? ['ft', 'feet'] : ['m', 'meters'];
    const lim = (x) => (x === 'P' ? ['más de ', 'more than '] : x === 'M' ? ['menos de ', 'less than '] : ['', '']);
    const a = lim(m[2]), b = lim(m[4]);
    const tend = { U: ['aumentando', 'increasing'], D: ['disminuyendo', 'decreasing'], N: ['sin cambio', 'no change'] }[m[7]];
    const es = `Alcance visual en la pista ${m[1]} (RVR): ${a[0]}${+m[3]} ${u[0]}${m[5] ? ` variando a ${b[0]}${+m[5]} ${u[0]}` : ''}${tend ? `, ${tend[0]}` : ''}`;
    const en = `Runway ${m[1]} visual range ${a[1]}${+m[3]} ${u[1]}${m[5] ? ` variable to ${b[1]}${+m[5]} ${u[1]}` : ''}${tend ? `, ${tend[1]}` : ''}`;
    return it(tok, es, en);
  }
  const RE_WX = /^(RE)?(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)*)$/;
  function tiempoPresente(tok) {
    const m = RE_WX.exec(tok);
    if (!m || (!m[3] && !m[4])) return null;
    const fens = (m[4].match(/.{2}/g) || []).map((c) => FENOMENOS[c]);
    const fEs = fens.map((f) => f[0]).join(' y '), fEn = fens.map((f) => f[1]).join(' and ');
    let es = fEs, en = fEn;
    if (m[3]) { const d = DESCRIPTORES[m[3]]; es = d[0](fEs); en = d[1](fEn); }
    if (m[2]) { const x = INTENSIDAD[m[2]]; es = m[2] === 'VC' ? `${es} ${x[0]}` : `${es}, ${x[0]}`; en = `${x[1] === 'in the vicinity' ? en + ' in the vicinity' : x[1] + ' ' + en}`; }
    // Sin signo = moderada, pero solo en precipitación que cae (no en nieve levantada BL/DR)
    else if (fens.length && /DZ|RA|SN|SG|PL|GR|GS|UP/.test(m[4]) && !m[1] && !/^(BL|DR|MI|BC|PR)$/.test(m[3] || '')) { es += ', intensidad moderada'; en = 'moderate ' + en; }
    if (m[1]) { es = `Reciente (en la última hora, ya no): ${es}`; en = `Recent ${en}`; }
    const peligro = /TS|FC|SQ|\+|FZ|VA|GR/.test(tok) && !m[1];
    return it(tok, es.charAt(0).toUpperCase() + es.slice(1), en.charAt(0).toUpperCase() + en.slice(1), peligro ? 'malo' : '');
  }
  function nubes(tok) {
    if (SIN_NUBES[tok]) return { it: it(tok, ...SIN_NUBES[tok]), capa: null };
    let m = /^VV(\d{3}|\/\/\/)$/.exec(tok);
    if (m) {
      const ft = m[1] === '///' ? null : +m[1] * 100;
      return { it: it(tok, `Cielo oscurecido: visibilidad vertical ${ft === null ? 'no medida' : ft.toLocaleString('es-MX') + ' ft'} (cuenta como techo)`, `Vertical visibility ${ft === null ? 'not available' : ft + ' feet'}`, 'malo'), capa: { techo: true, ft } };
    }
    m = /^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/.exec(tok);
    if (!m) return null;
    const ft = m[2] === '///' ? null : +m[2] * 100;
    const tipo = m[3] === 'CB' ? [' de cumulonimbos (CB): tormenta', ' cumulonimbus'] : m[3] === 'TCU' ? [' de cúmulos en torre (TCU)', ' towering cumulus'] : ['', ''];
    const techo = m[1] === 'BKN' || m[1] === 'OVC';
    return {
      it: it(tok, `${NUBES[m[1]][0]}${tipo[0]} a ${ft === null ? 'altura no medida' : ft.toLocaleString('es-MX') + ' ft sobre el aeródromo'}${techo ? ' ← techo' : ''}`,
        `${NUBES[m[1]][1].replace(/^./, (c) => c.toUpperCase())}${tipo[1]} ${ft === null ? '' : ft + ' feet'}`.trim(), m[3] === 'CB' ? 'malo' : ''),
      capa: { techo, ft },
    };
  }
  function temperatura(tok) {
    const m = /^(M?\d{2})\/(M?\d{2})?$/.exec(tok);
    if (!m) return null;
    const n = (s) => (s[0] === 'M' ? -1 : 1) * +s.replace('M', '');
    const t = n(m[1]), td = m[2] ? n(m[2]) : null;
    return { t, td, it: it(tok, `Temperatura ${t} °C${td !== null ? `, punto de rocío ${td} °C (diferencia ${t - td} °C)` : ''}`, `Temperature ${t}${td !== null ? `, dew point ${td}` : ''}`) };
  }
  function presion(tok) {
    let m = /^Q(\d{4})$/.exec(tok);
    if (m) return { hpa: +m[1], it: it(tok, `QNH ${+m[1]} hPa (${(+m[1] * 0.02953).toFixed(2)} inHg)`, `QNH ${+m[1]}`) };
    m = /^A(\d{4})$/.exec(tok);
    if (m) { const inhg = +m[1] / 100; return { hpa: Math.round(inhg / 0.02953), it: it(tok, `Altímetro ${inhg.toFixed(2)} pulgadas de mercurio (${Math.round(inhg / 0.02953)} hPa)`, `Altimeter ${m[1]}`) }; }
    return null;
  }
  // Horas de un TAF o de una tendencia
  const hz = (d, h, m) => `día ${+d} a las ${p2(h)}${m !== undefined ? p2(m) : '00'} UTC`;
  function periodo(tok) {
    const m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(tok);
    return m ? { es: `del ${hz(m[1], m[2])} al ${hz(m[3], m[4])}`, en: `from ${m[1]}${m[2]} to ${m[3]}${m[4]} UTC` } : null;
  }

  /* ----- Un grupo cualquiera del cuerpo (lo comparten METAR y TAF) ----- */
  function elemento(toks, i, datos) {
    const t = toks[i];
    let r = viento(t); if (r) { if (datos && datos.viento === undefined) datos.viento = r.dato; return { n: 1, it: r.it }; }
    let x = variacion(t); if (x) return { n: 1, it: x };
    r = visibilidad(toks, i); if (r) { if (datos && r.visM !== undefined && datos.visM === undefined) datos.visM = r.visM; if (datos && r.cavok) datos.cavok = true; return { n: r.n, it: r.it }; }
    x = rvr(t); if (x) return { n: 1, it: x };
    if (t === 'NSW') return { n: 1, it: it(t, 'Termina el tiempo significativo', 'No significant weather') };
    r = nubes(t); if (r) { if (datos && r.capa && r.capa.techo && r.capa.ft !== null && (datos.techo === undefined || r.capa.ft < datos.techo)) datos.techo = r.capa.ft; if (datos && t === 'NSC') datos.nsc = true; return { n: 1, it: r.it }; }
    x = tiempoPresente(t); if (x) { if (datos) (datos.wx = datos.wx || []).push(t); return { n: 1, it: x }; }
    r = temperatura(t); if (r) { if (datos) { datos.t = r.t; datos.td = r.td; } return { n: 1, it: r.it }; }
    r = presion(t); if (r) { if (datos) datos.hpa = r.hpa; return { n: 1, it: r.it }; }
    // Cizalladura: WS R09 · WS RWY09 · WS ALL RWY
    if (t === 'WS') {
      if (toks[i + 1] === 'ALL' && toks[i + 2] === 'RWY') return { n: 3, it: it('WS ALL RWY', 'Cizalladura del viento en todas las pistas', 'Wind shear all runways', 'malo') };
      const m = /^R(?:WY)?(\d{2}[LCR]?)$/.exec(toks[i + 1] || '');
      if (m) return { n: 2, it: it(`WS ${toks[i + 1]}`, `Cizalladura del viento en la pista ${m[1]}`, `Wind shear runway ${m[1]}`, 'malo') };
    }
    let m = /^WS(\d{3})\/(\d{3})(\d{2,3})KT$/.exec(t);   // TAF de EUA: cizalladura a baja altura
    if (m) return { n: 1, it: it(t, `Cizalladura a baja altura: a ${+m[1] * 100} ft el viento es de ${m[2]}° a ${+m[3]} nudos`, `Low level wind shear at ${+m[1] * 100} feet, wind ${m[2]} degrees ${+m[3]} knots`, 'malo') };
    m = /^T([XN])(M?\d{2})\/(\d{2})(\d{2})Z$/.exec(t);  // TAF: temperatura máxima/mínima
    if (m) { const v = (m[2][0] === 'M' ? -1 : 1) * +m[2].replace('M', ''); return { n: 1, it: it(t, `Temperatura ${m[1] === 'X' ? 'máxima' : 'mínima'} de ${v} °C el ${hz(m[3], m[4])}`, `${m[1] === 'X' ? 'Maximum' : 'Minimum'} temperature ${v} at ${m[3]}${m[4]} UTC`) }; }
    return null;
  }

  /* ----- Observaciones (RMK): formato nacional, se decodifica lo más común ----- */
  function remarks(toks) {
    const items = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      let m;
      if (t === 'AO1' || t === 'AO2') items.push(it(t, `Estación automática ${t === 'AO2' ? 'con' : 'sin'} sensor que distingue el tipo de precipitación`, `Automated station ${t === 'AO2' ? 'with' : 'without'} precipitation discriminator`));
      else if ((m = /^SLP(\d{3})$/.exec(t))) { const v = +m[1] / 10 + (+m[1] < 500 ? 1000 : 900); items.push(it(t, `Presión al nivel del mar ${v.toFixed(1)} hPa`, `Sea level pressure ${v.toFixed(1)} hectopascals`)); }
      else if ((m = /^T([01])(\d{3})([01])(\d{3})$/.exec(t))) { const a = (m[1] === '1' ? -1 : 1) * +m[2] / 10, b = (m[3] === '1' ? -1 : 1) * +m[4] / 10; items.push(it(t, `Temperatura exacta ${a.toFixed(1)} °C, punto de rocío ${b.toFixed(1)} °C`, `Temperature ${a.toFixed(1)}, dew point ${b.toFixed(1)}`)); }
      else if ((m = /^8\/([0-9/])([0-9/])([0-9/])$/.exec(t))) {
        const n = (tabla, c) => (c === '/' ? 'no visibles' : tabla[+c]);
        items.push(it(t, `Tipos de nube (código OMM): bajas: ${n(NUBE_BAJA, m[1])}; medias: ${n(NUBE_MEDIA, m[2])}; altas: ${n(NUBE_ALTA, m[3])}`, 'Cloud types group'));
      } else if (t === 'HZY') items.push(it(t, 'Brumoso (hazy)', 'Hazy'));
      else if (t === 'PK' && toks[i + 1] === 'WND' && (m = /^(\d{3})(\d{2,3})\/(\d{2,4})$/.exec(toks[i + 2] || ''))) { items.push(it(`PK WND ${toks[i + 2]}`, `Ráfaga máxima: ${m[1]}° a ${+m[2]} nudos (a las ${m[3]})`, `Peak wind ${m[1]} at ${+m[2]} knots`)); i += 2; }
      else if (t === '$') items.push(it(t, 'La estación necesita mantenimiento', 'Station requires maintenance'));
      else items.push(it(t, 'Formato nacional, sin decodificar', '', 'gris'));
    }
    return items;
  }

  /* ----- METAR / SPECI ----- */
  function decodificarMETAR(toks) {
    const r = { tipo: 'METAR', secciones: [], datos: {}, noReconocidos: [] };
    const sec = (es, en) => { const s = { titulo: [es, en], items: [] }; r.secciones.push(s); return s; };
    let actual = sec('Observación', 'Observation');
    let i = 0, enTendencia = false;
    if (/^(METAR|SPECI)$/.test(toks[i])) { r.tipo = toks[i]; actual.items.push(it(toks[i], toks[i] === 'SPECI' ? 'SPECI: reporte especial, emitido fuera de horario porque algo cambió de forma importante' : 'METAR: reporte de rutina (normalmente cada hora)', toks[i] === 'SPECI' ? 'Special report' : 'Routine report')); i++; }
    if (toks[i] === 'COR') { actual.items.push(it('COR', 'Reporte corregido', 'Corrected report')); i++; }
    if (/^[A-Z][A-Z0-9]{3}$/.test(toks[i] || '')) { r.estacion = toks[i]; actual.items.push(it(toks[i], `Estación ${toks[i]} (código OACI)`, `${toks[i]}`)); i++; }
    let m = /^(\d{2})(\d{2})(\d{2})Z$/.exec(toks[i] || '');
    if (m) { r.hora = { dia: +m[1], h: +m[2], m: +m[3] }; actual.items.push(it(toks[i], `Observado el día ${+m[1]} a las ${m[2]}:${m[3]} UTC`, `Time ${m[2]}${m[3]} Zulu`)); i++; }
    for (; i < toks.length; i++) {
      const t = toks[i];
      if (t === 'RMK') { const s = sec('Observaciones (RMK)', 'Remarks'); s.items = remarks(toks.slice(i + 1)); break; }
      if (t === 'AUTO') { actual.items.push(it(t, 'Reporte automático, sin observador humano', 'Automated observation')); continue; }
      if (t === 'NIL') { actual.items.push(it(t, 'Reporte faltante', 'Missing report', 'malo')); continue; }
      if (t === 'NOSIG') { sec('Tendencia (2 horas)', 'Trend').items.push(it(t, 'Sin cambios importantes en las próximas 2 horas', 'No significant change')); continue; }
      if (t === 'BECMG' || t === 'TEMPO') {
        actual = sec(t === 'BECMG' ? 'Tendencia: cambiando a (BECMG)' : 'Tendencia: temporalmente (TEMPO)', t === 'BECMG' ? 'Trend: becoming' : 'Trend: temporarily');
        actual.items.push(it(t, t === 'BECMG' ? 'En las próximas 2 horas las condiciones cambian a lo siguiente' : 'Ratos de menos de una hora con lo siguiente, en las próximas 2 horas', t === 'BECMG' ? 'Becoming' : 'Temporarily'));
        enTendencia = true; continue;
      }
      m = /^(FM|TL|AT)(\d{2})(\d{2})$/.exec(t);
      if (m && enTendencia) { const p = { FM: ['desde las', 'from'], TL: ['hasta las', 'until'], AT: ['a las', 'at'] }[m[1]]; actual.items.push(it(t, `${p[0]} ${m[2]}:${m[3]} UTC`, `${p[1]} ${m[2]}${m[3]}`)); continue; }
      const e = elemento(toks, i, enTendencia ? null : r.datos);
      if (e) { actual.items.push(e.it); i += e.n - 1; continue; }
      actual.items.push(it(t, 'No reconocido', '', 'gris')); r.noReconocidos.push(t);
    }
    return r;
  }

  /* ----- TAF ----- */
  function decodificarTAF(toks) {
    const r = { tipo: 'TAF', secciones: [], datos: {}, noReconocidos: [] };
    const sec = (es, en) => { const s = { titulo: [es, en], items: [] }; r.secciones.push(s); return s; };
    let actual = sec('Encabezado', 'Header');
    let i = 0;
    if (toks[i] === 'TAF') { actual.items.push(it('TAF', 'Pronóstico de aeródromo (TAF)', 'Terminal aerodrome forecast')); i++; }
    while (/^(AMD|COR|RTD)$/.test(toks[i] || '')) { const k = { AMD: ['enmendado (corrige un TAF anterior)', 'amended'], COR: ['corregido', 'corrected'], RTD: ['retrasado', 'delayed'] }[toks[i]]; actual.items.push(it(toks[i], `TAF ${k[0]}`, k[1])); i++; }
    if (/^[A-Z][A-Z0-9]{3}$/.test(toks[i] || '')) { r.estacion = toks[i]; actual.items.push(it(toks[i], `Aeródromo ${toks[i]}`, toks[i])); i++; }
    let m = /^(\d{2})(\d{2})(\d{2})Z$/.exec(toks[i] || '');
    if (m) { r.hora = { dia: +m[1], h: +m[2], m: +m[3] }; actual.items.push(it(toks[i], `Emitido el día ${+m[1]} a las ${m[2]}:${m[3]} UTC`, `Issued ${m[2]}${m[3]} Zulu`)); i++; }
    let p = periodo(toks[i] || '');
    if (p) { r.validez = toks[i]; actual.items.push(it(toks[i], `Válido ${p.es}`, `Valid ${p.en}`)); i++; }
    actual = sec('Pronóstico base', 'Base forecast');
    let base = true;
    for (; i < toks.length; i++) {
      const t = toks[i];
      if (t === 'NIL') { actual.items.push(it(t, 'TAF faltante', 'Missing', 'malo')); continue; }
      if (t === 'CNL') { actual.items.push(it(t, 'TAF cancelado', 'Cancelled', 'malo')); continue; }
      if (t === 'RMK') { const s = sec('Observaciones (RMK)', 'Remarks'); s.items = remarks(toks.slice(i + 1)); break; }
      m = /^FM(\d{2})(\d{2})(\d{2})$/.exec(t);
      if (m) { actual = sec(`Desde el ${hz(m[1], m[2], m[3])} (FM)`, `From ${m[1]}${m[2]}${m[3]}`); actual.items.push(it(t, 'Cambio rápido: desde esta hora todo el pronóstico anterior se reemplaza por esto', `From ${m[2]}${m[3]} UTC`)); base = false; continue; }
      if (t === 'BECMG' || t === 'TEMPO' || /^PROB(30|40)$/.test(t)) {
        let cab = t, j = i + 1, prob = null;
        if (/^PROB/.test(t)) { prob = t.slice(4); if (toks[j] === 'TEMPO') { cab += ' TEMPO'; j++; } }
        const per = periodo(toks[j] || '');
        const tit = prob ? `Probabilidad ${prob} %${/TEMPO/.test(cab) ? ', temporalmente' : ''}` : t === 'BECMG' ? 'Cambiando a (BECMG)' : 'Temporalmente (TEMPO)';
        actual = sec(`${tit}${per ? ', ' + per.es : ''}`, `${prob ? `Probability ${prob} percent` : t === 'BECMG' ? 'Becoming' : 'Temporarily'}${per ? ' ' + per.en : ''}`);
        const expl = prob ? `Hay ${prob} % de probabilidad de lo siguiente` : t === 'BECMG' ? 'Cambio gradual durante ese periodo; al final queda así' : 'Ratos de menos de una hora (en total, menos de la mitad del periodo)';
        actual.items.push(it(per ? `${cab} ${toks[j]}` : cab, expl, tit));
        i = per ? j : j - 1; base = false; continue;
      }
      const e = elemento(toks, i, base ? r.datos : null);
      if (e) { actual.items.push(e.it); i += e.n - 1; continue; }
      actual.items.push(it(t, 'No reconocido', '', 'gris')); r.noReconocidos.push(t);
    }
    return r;
  }

  /* ----- Entrada principal ----- */
  function decodificar(texto) {
    const toks = limpiar(texto).split(' ').filter(Boolean);
    if (!toks.length) return null;
    // ¿Es TAF? Empieza con TAF, o tiene un periodo DDHH/DDHH justo después de la hora
    const k = toks.findIndex((x) => /^\d{6}Z$/.test(x));
    const esTAF = toks[0] === 'TAF' || (k >= 0 && /^\d{4}\/\d{4}$/.test(toks[k + 1] || ''));
    const r = esTAF ? decodificarTAF(toks) : decodificarMETAR(toks);
    const d = r.datos;
    // Techo y visibilidad del cuerpo principal → categoría
    const visSM = d.cavok ? 10000 / MES : d.visM !== undefined ? d.visM / MES : null;
    const techo = d.cavok || d.nsc ? null : d.techo !== undefined ? d.techo : null;
    r.techo = techo; r.visSM = visSM;
    r.categoria = visSM === null && techo === null ? null : categoria(techo, visSM);
    r.vmc = vmcAerodromo(techo, d.visM !== undefined ? d.visM : d.cavok ? 10000 : null);
    r.avisos = avisos(r);
    return r;
  }

  // Categoría de vuelo (FAA / Aviation Weather Center). Techo en ft, visibilidad en millas terrestres.
  function categoria(techoFt, visSM) {
    const t = techoFt === null || techoFt === undefined ? Infinity : techoFt, v = visSM === null || visSM === undefined ? Infinity : visSM;
    if (t < 500 || v < 1) return 'LIFR';
    if (t < 1000 || v < 3) return 'IFR';
    if (t <= 3000 || v <= 5) return 'MVFR';
    return 'VFR';
  }
  // OACI Anexo 2, 4.2: salvo autorización ATC (VFR especial), no despegar/aterrizar VFR en zona de
  // control con techo menor a 1,500 ft o visibilidad en tierra menor a 5 km.
  function vmcAerodromo(techoFt, visM) {
    if (techoFt === undefined && visM === undefined) return null;
    const faltaTecho = techoFt !== null && techoFt !== undefined && techoFt < 1500;
    const faltaVis = visM !== null && visM !== undefined && visM < 5000;
    return { ok: !faltaTecho && !faltaVis, faltaTecho, faltaVis };
  }
  function avisos(r) {
    const a = [], d = r.datos;
    if (d.t !== undefined && d.td !== null && d.td !== undefined && d.t - d.td <= 2 && r.tipo !== 'TAF') a.push('Temperatura y punto de rocío a 2 °C o menos: riesgo de niebla, neblina o nubes bajas (sobre todo al anochecer y al amanecer).');
    if (d.viento && d.viento.raf && d.viento.raf - d.viento.vel >= 10) a.push(`Ráfagas ${d.viento.raf - d.viento.vel} nudos arriba del viento medio: suma la mitad de esa diferencia a tu velocidad de aproximación (regla común; usa la de tu POH).`);
    if ((d.wx || []).some((w) => /TS/.test(w))) a.push('Tormenta eléctrica reportada: turbulencia, cizalladura, granizo y rayos. No despegues ni aterrices debajo o cerca de ella.');
    if ((d.wx || []).some((w) => /FZ/.test(w))) a.push('Precipitación o niebla engelante: hielo en el avión. Solo aeronaves certificadas para hielo conocido.');
    if (d.t !== undefined && d.t <= 3 && d.t >= -15 && (d.wx || []).some((w) => /RA|DZ|SN|FG|BR/.test(w))) a.push('Temperatura cercana a 0 °C con humedad visible: posible engelamiento.');
    return a;
  }
  // Minutos desde el reporte (día/hora UTC). Si el día es mayor que hoy, es del mes anterior.
  function edadMin(hora, ahora = new Date()) {
    if (!hora) return null;
    let f = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), hora.dia, hora.h, hora.m);
    if (f - ahora.getTime() > 6 * 3600e3) f = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, hora.dia, hora.h, hora.m);
    return Math.round((ahora.getTime() - f) / 60000);
  }

  const logica = { decodificar, categoria, vmcAerodromo, edadMin, limpiar, FENOMENOS, DESCRIPTORES, NUBES };
  if (typeof module !== 'undefined') module.exports = logica;
  if (typeof window === 'undefined') return;

  /* ======================= 2. DATOS REALES ======================= */
  // Dirección del intermediario (función de Netlify, proyecto "airborne-meteo"; código en servicios/meteo-netlify).
  // Para probar otra dirección sin publicar: en la consola del navegador
  //   localStorage.setItem('air_meteo_servicio', 'https://…/meteo')
  const SERVICIO_PUBLICADO = 'https://airborne-meteo.netlify.app/meteo';
  const servicio = () => { try { return localStorage.getItem('air_meteo_servicio') || SERVICIO_PUBLICADO; } catch (e) { return SERVICIO_PUBLICADO; } };
  async function traer(id) {
    const base = servicio();
    if (!base) { const e = new Error('sin-servicio'); e.codigo = 'sin-servicio'; throw e; }
    const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(`${base.replace(/\/$/, '')}?ids=${encodeURIComponent(id)}`, { signal: ctl.signal, cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'El servicio respondió con error ' + r.status);
      return j;                         // { fuente, obtenido, estaciones: [{ id, nombre, metar, taf }] }
    } finally { clearTimeout(reloj); }
  }
  // Enlaces al dato oficial en texto (se abren en otra pestaña: eso sí lo permite la NOAA)
  const oficial = (prod, id) => `https://aviationweather.gov/api/data/${prod}?ids=${encodeURIComponent(id)}&format=raw`;

  /* ======================= 3. PANTALLA ======================= */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const leerLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const FAVORITOS = ['MMTO', 'MMMX', 'MMSM', 'MMGL', 'MMMY', 'MMUN', 'MMQT', 'MMPB'];
  const EJEMPLOS = [
    ['México (millas y A)', 'METAR MMTO 181542Z 36008KT 9SM SCT020 BKN200 17/02 A3031 RMK 8/270 HZY'],
    ['OACI (metros y Q)', 'METAR LEMD 181530Z 24015G28KT 200V280 4000 -SHRA BKN012 SCT030CB 12/09 Q1008 TEMPO 2500 SHRA'],
    ['Niebla (LIFR)', 'SPECI KSFO 181356Z 28005KT 1/2SM R28L/2400V4000FT FG VV002 12/12 A2998 RMK AO2 T01220117'],
    ['Nieve', 'METAR CYYZ 181500Z 05020G30KT 1 1/2SM -SN BLSN OVC008 M05/M07 A2965'],
    ['TAF con tormenta', 'TAF MMTO 181100Z 1812/1912 36010KT P6SM SCT020 BKN200 TX22/1821Z TN03/1912Z TEMPO 1820/1902 5SM -TSRA BKN015CB FM190200 VRB03KT P6SM SKC'],
    ['TAF OACI', 'TAF EGLL 181100Z 1812/1918 22012KT 9999 BKN025 PROB30 TEMPO 1815/1819 22020G32KT 4000 +SHRA BKN012CB BECMG 1902/1905 27008KT'],
  ];
  const COLOR = { VFR: '#16a34a', MVFR: '#2563eb', IFR: '#dc2626', LIFR: '#c026d3' };
  const est = { idioma: leerLS('air_meteo_idioma', 'ambos') };

  function tarjeta(texto, titulo, ejemplo) {
    const r = decodificar(texto);
    if (!r) return '';
    const edad = ejemplo ? null : edadMin(r.hora);      // los ejemplos no tienen edad real
    // Una fila por grupo: el código y su explicación (en "Ambos", el inglés va debajo, en cursiva)
    const fila = (x) => {
      const es = est.idioma !== 'en' ? esc(x.es) : '', en = est.idioma !== 'es' && x.en ? `<i lang="en">${esc(x.en)}</i>` : '';
      return `<tr class="${x.clase}"><td><code>${esc(x.cod)}</code></td><td>${es}${es && en ? '<br>' : ''}${en}</td></tr>`;
    };
    const cat = r.categoria && r.tipo !== 'TAF' ? `<span class="cat" style="background:${COLOR[r.categoria]}">${r.categoria}</span>` : '';
    const vmc = r.vmc && r.tipo !== 'TAF' ? (r.vmc.ok ? '<div class="ok">Cumple los mínimos OACI para despegar y aterrizar VFR en zona de control (techo ≥ 1,500 ft y visibilidad ≥ 5 km, Anexo 2, 4.2).</div>' : `<div class="aviso">No cumple los mínimos VFR de aeródromo en zona de control (Anexo 2, 4.2): ${[r.vmc.faltaTecho ? 'techo menor a 1,500 ft' : '', r.vmc.faltaVis ? 'visibilidad menor a 5 km' : ''].filter(Boolean).join(' y ')}. Solo con VFR especial autorizado por ATC, o IFR.</div>`) : '';
    return `<div class="card met"><div class="metcab"><h2>${esc(titulo || r.tipo)} ${cat}</h2>${edad !== null ? `<span class="nota">${r.tipo === 'TAF' ? 'emitido' : 'observado'} hace ${edad < 120 ? edad + ' min' : Math.round(edad / 60) + ' h'}${r.tipo !== 'TAF' && edad > 90 ? ' · <b>reporte viejo</b>' : ''}</span>` : ''}</div>
      <pre class="msg">${esc(limpiar(texto))}</pre>
      ${r.secciones.filter((s) => s.items.length).map((s) => `<h3 class="casilla">${esc(est.idioma === 'en' ? s.titulo[1] : s.titulo[0])}</h3><div class="tabla"><table class="codigos"><tbody>${s.items.map(fila).join('')}</tbody></table></div>`).join('')}
      ${vmc}${r.avisos.map((a) => `<div class="aviso">${esc(a)}</div>`).join('')}
      ${r.noReconocidos.length ? `<p class="nota">No reconocí: ${r.noReconocidos.map(esc).join(' ')}. Revisa que esté completo.</p>` : ''}
      ${'speechSynthesis' in window ? `<button type="button" class="boton" data-leer="${esc(encodeURIComponent(texto))}">▶ Escucharlo en inglés</button>` : ''}</div>`;
  }
  // Lectura en inglés tipo ATIS
  function leerIngles(texto) {
    const r = decodificar(texto); if (!r) return;
    const partes = r.secciones.flatMap((s) => s.items.filter((x) => x.en && x.clase !== 'gris').map((x) => x.en));
    const u = new SpeechSynthesisUtterance(partes.join('. ').replace(/(\d)(?=\d)/g, '$1 '));
    const voz = speechSynthesis.getVoices().find((v) => /^en/i.test(v.lang)); if (voz) u.voice = voz;
    u.lang = 'en-US'; u.rate = 0.92; speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function glosario() {
    const filas = (o) => Object.entries(o).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${esc(typeof v[0] === 'function' ? v[2] : v[0])}</td><td lang="en"><i>${esc(typeof v[1] === 'function' ? v[3] : v[1])}</i></td></tr>`).join('');
    const extra = [['+ / − / VC', 'Fuerte / ligero / en las cercanías', 'heavy / light / vicinity'], ['RE…', 'Reciente (ocurrió en la última hora)', 'recent'], ['CAVOK', 'Visibilidad ≥ 10 km, sin nubes bajo 5,000 ft, sin CB ni tiempo significativo', 'ceiling and visibility OK'],
      ['VV###', 'Visibilidad vertical (cielo oscurecido)', 'vertical visibility'], ['CB / TCU', 'Cumulonimbo / cúmulo en torre', 'cumulonimbus / towering cumulus'], ['NOSIG', 'Sin cambio significativo (2 h)', 'no significant change'],
      ['BECMG', 'Cambiando gradualmente a', 'becoming'], ['TEMPO', 'Temporalmente (ratos de menos de 1 h)', 'temporarily'], ['FM', 'Desde (cambio rápido)', 'from'], ['PROB30/40', 'Probabilidad 30 % / 40 %', 'probability'],
      ['TX / TN', 'Temperatura máxima / mínima pronosticada', 'max / min temperature'], ['Q / A', 'QNH en hPa / altímetro en inHg', 'QNH / altimeter'], ['R##/####', 'Alcance visual en la pista (RVR)', 'runway visual range'],
      ['WS', 'Cizalladura del viento', 'wind shear'], ['AUTO', 'Estación automática', 'automated'], ['NSW / NSC / NCD', 'Fin del tiempo significativo / sin nubes significativas / sin nubes detectadas', 'no sig. weather / no sig. cloud / no cloud detected'], ['SM', 'Millas terrestres (1 SM = 1.609 km)', 'statute miles']];
    return `<details class="repaso"><summary>Todos los códigos de METAR y TAF</summary>
      <div class="tabla"><table><thead><tr><th>Código</th><th>Español</th><th>English</th></tr></thead><tbody>
      ${filas(NUBES)}${filas(Object.fromEntries(Object.entries(DESCRIPTORES)))}${filas(FENOMENOS)}${extra.map((x) => `<tr><td><code>${esc(x[0])}</code></td><td>${esc(x[1])}</td><td lang="en"><i>${esc(x[2])}</i></td></tr>`).join('')}
      </tbody></table></div>
      <p class="fuente">[OACI] Anexo 3, Apéndices 3 y 5; Doc 8400 (abreviaturas). [USA-FAA] AC 00-45H; AIM 7-1.</p></details>`;
  }

  const meteo = {
    titulo: 'METAR y TAF',
    resumen: 'Datos reales de cualquier aeropuerto, decodificados en español e inglés.',
    render() {
      const recientes = leerLS('air_meteo_recientes', []);
      const chips = [...new Set([...recientes, ...FAVORITOS])].slice(0, 10);
      const idi = (v, t) => `<button type="button" data-idioma="${v}" aria-pressed="${est.idioma === v}">${t}</button>`;
      return `<section class="calc guia">
        <h1>METAR y TAF</h1>
        <p class="intro">Escribe el código OACI del aeropuerto para traer el reporte real, o pega cualquier METAR, SPECI o TAF. Cada grupo se explica en español y como se dice en inglés.</p>
        <div class="cols">
          <div class="card">
            <div class="campo"><label for="metId">Aeropuerto (código OACI)</label>
              <div class="fila"><input id="metId" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="MMTO" style="text-transform:uppercase;font-family:ui-monospace,Consolas,monospace"><button type="button" class="boton oro" id="metTraer">Traer</button></div>
              <div class="chips">${chips.map((c) => `<button type="button" class="chip" data-id="${c}">${c}</button>`).join('')}</div></div>
            <p class="nota" id="metEstado"></p>
            <div class="campo"><label for="metTexto">O pega el reporte</label><textarea id="metTexto" rows="4" spellcheck="false" style="font:500 16px ui-monospace,Consolas,monospace;width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px;background:var(--field);color:var(--ink)" placeholder="METAR MMTO 181542Z 36008KT 9SM SCT020 ..."></textarea></div>
            <div class="ejemplos"><button type="button" class="boton" id="metDecod">Decodificar</button></div>
            <p class="nota">Ejemplos para practicar:</p>
            <div class="chips">${EJEMPLOS.map((e, i) => `<button type="button" class="chip" data-ej="${i}" style="font-family:var(--body)">${esc(e[0])}</button>`).join('')}</div>
            <div class="campo" style="margin-top:10px"><label>Idioma de la explicación</label><div class="seg" id="metIdioma">${idi('es', 'Español')}${idi('ambos', 'Ambos')}${idi('en', 'English')}</div></div>
          </div>
          <div id="metSalida" aria-live="polite"><div class="card"><p class="nota">Aquí aparece el reporte decodificado.</p></div></div>
        </div>
        ${glosario()}
        <div class="aviso">Para estudio y conciencia situacional. Para despachar un vuelo usa la información meteorológica oficial de tu operación (en México, la que proporciona SENEAM) y tu briefing.</div>
        <p class="fuente">Datos en vivo: NOAA / NWS Aviation Weather Center (aviationweather.gov), información pública del gobierno de EUA. Categorías VFR/MVFR/IFR/LIFR: definición de la FAA (AWC). Mínimos VFR de aeródromo: [OACI] Anexo 2, 4.2.</p>
      </section>`;
    },
    activar() {
      let ultimo = [];                                    // [[texto, título], ...] lo último mostrado
      const salida = $('#metSalida'), estado = $('#metEstado');
      const pintar = (lista) => { ultimo = lista; salida.innerHTML = lista.map(([t, ti, ej]) => tarjeta(t, ti, ej)).join('') || '<div class="card"><p class="nota">No hay nada que decodificar.</p></div>'; };
      salida.addEventListener('click', (e) => { const b = e.target.closest('[data-leer]'); if (b) leerIngles(decodeURIComponent(b.dataset.leer)); });
      $('#metDecod').addEventListener('click', () => {
        // Si pegaron METAR y TAF juntos, sepáralos: cada "TAF", "METAR" o "SPECI" empieza un reporte
        const partes = limpiar($('#metTexto').value).split(/\s(?=(?:TAF|METAR|SPECI)\s)/).filter(Boolean);
        estado.textContent = ''; pintar(partes.map((p) => [p, null]));
      });
      document.querySelectorAll('[data-ej]').forEach((b) => b.addEventListener('click', () => { const e = EJEMPLOS[+b.dataset.ej]; $('#metTexto').value = e[1]; pintar([[e[1], 'Ejemplo: ' + e[0], true]]); estado.textContent = 'Ejemplo de práctica, no es un reporte real.'; }));
      document.querySelectorAll('#metIdioma button').forEach((b) => b.addEventListener('click', () => {
        est.idioma = b.dataset.idioma; guardarLS('air_meteo_idioma', est.idioma);
        document.querySelectorAll('#metIdioma button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); if (ultimo.length) pintar(ultimo);
      }));
      const pedir = async (id) => {
        id = String(id || '').toUpperCase().trim();
        if (!/^[A-Z][A-Z0-9]{3}$/.test(id)) { estado.innerHTML = 'Escribe un código OACI de 4 letras, por ejemplo <b>MMTO</b> (Toluca) o <b>MMMX</b> (Ciudad de México).'; return; }
        $('#metId').value = id;
        estado.textContent = 'Consultando ' + id + '…';
        try {
          const j = await traer(id);
          const e = (j.estaciones || [])[0];
          if (!e || (!e.metar && !e.taf)) { estado.textContent = `No hay reportes recientes de ${id}. Revisa el código o pruébalo más tarde (algunos aeropuertos no emiten TAF o cierran de noche).`; return; }
          guardarLS('air_meteo_recientes', [id, ...leerLS('air_meteo_recientes', []).filter((x) => x !== id)].slice(0, 6));
          estado.innerHTML = `<b>${esc(e.nombre || id)}</b> · consultado ${new Date(j.obtenido).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hora local · fuente: aviationweather.gov`;
          $('#metTexto').value = [e.metar, e.taf].filter(Boolean).join('\n');
          pintar([[e.metar, 'METAR ' + id], [e.taf, 'TAF ' + id]].filter((x) => x[0]));
        } catch (err) {
          const enlaces = `<a href="${oficial('metar', id)}" target="_blank" rel="noopener">METAR de ${id}</a> · <a href="${oficial('taf', id)}" target="_blank" rel="noopener">TAF de ${id}</a>`;
          estado.innerHTML = err.codigo === 'sin-servicio'
            ? `La consulta automática se está activando. Mientras, abre el dato oficial (${enlaces}), cópialo y pégalo abajo.`
            : `No se pudo conectar (${esc(err.name === 'AbortError' ? 'tardó demasiado' : err.message)}). Revisa tu internet, o abre el dato oficial (${enlaces}) y pégalo abajo.`;
        }
      };
      $('#metTraer').addEventListener('click', () => pedir($('#metId').value));
      $('#metId').addEventListener('keydown', (e) => { if (e.key === 'Enter') pedir($('#metId').value); });
      document.querySelectorAll('.chip[data-id]').forEach((b) => b.addEventListener('click', () => pedir(b.dataset.id)));
    },
  };
  raiz.AIrGuias = raiz.AIrGuias || {};
  raiz.AIrGuias.meteo = meteo;
})(typeof window !== 'undefined' ? window : globalThis);
