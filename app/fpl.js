/*
 * fpl.js — Plan de vuelo OACI (formato FPL de la OACI, "FPL 2012")
 * ----------------------------------------------------------------
 * Aquí está SOLO la lógica (sin pantallas), para poder probarla sola (pruebas_fpl.js):
 *   1. CODIGOS: el significado de cada letra de las casillas 10a, 10b, 19 y los códigos PBN/.
 *   2. separar10a / separar10b: parten "SDGR" en ["S","D","G","R"].
 *   3. armarFPL: con los datos de cada casilla arma el mensaje "(FPL-...)" y revisa errores.
 *
 * Fuente: OACI, PANS-ATM (Doc 4444), Apéndice 2 "Plan de vuelo", con la enmienda 1
 * (formato vigente desde el 15 de noviembre de 2012). Tabla de dependencias PBN/ ↔ casilla 10a
 * según la guía de implementación de la OACI. Antes de usarlo en un vuelo real, revisa el PIA (AIP)
 * de México (ENR 1.10) y lo que pida SENEAM.
 *
 * AVISO: herramienta de estudio. El plan de vuelo oficial se presenta por los medios de SENEAM.
 */

/* ---------- 1. CÓDIGOS ---------- */
const CODIGOS = {
  // Casilla 8: reglas de vuelo y tipo de vuelo
  reglas: { I: 'IFR todo el vuelo', V: 'VFR todo el vuelo', Y: 'Primero IFR y luego VFR', Z: 'Primero VFR y luego IFR' },
  tipo: { S: 'Servicio aéreo regular', N: 'Transporte aéreo no regular', G: 'Aviación general', M: 'Militar', X: 'Otro (se explica en STS/ o RMK/)' },
  // Casilla 9: categoría de estela turbulenta (por peso máximo de despegue certificado)
  estela: { L: 'Ligera: 7,000 kg o menos', M: 'Media: más de 7,000 y menos de 136,000 kg', H: 'Pesada: 136,000 kg o más', J: 'Súper (por ejemplo A380)' },
  // Casilla 10a: equipo de comunicación, navegación y aproximación
  c10a: {
    N: 'Sin equipo COM/NAV/de aproximación para la ruta, o no funciona',
    S: 'Equipo estándar: VHF de voz (RTF), VOR e ILS',
    A: 'GBAS para aterrizaje (GLS)', B: 'LPV: aproximación con guía vertical por SBAS (WAAS)', C: 'LORAN C',
    D: 'DME', E1: 'FMC WPR ACARS', E2: 'D-FIS ACARS', E3: 'PDC ACARS', F: 'ADF', G: 'GNSS (GPS y otros)',
    H: 'HF de voz', I: 'Navegación inercial', J1: 'CPDLC ATN VDL modo 2', J2: 'CPDLC FANS 1/A HFDL',
    J3: 'CPDLC FANS 1/A VDL modo A', J4: 'CPDLC FANS 1/A VDL modo 2', J5: 'CPDLC FANS 1/A SATCOM (INMARSAT)',
    J6: 'CPDLC FANS 1/A SATCOM (MTSAT)', J7: 'CPDLC FANS 1/A SATCOM (Iridium)', K: 'MLS', L: 'ILS',
    M1: 'Voz por SATCOM (INMARSAT)', M2: 'Voz por SATCOM (MTSAT)', M3: 'Voz por SATCOM (Iridium)',
    O: 'VOR', P1: 'Reservado RCP', P2: 'Reservado RCP', P3: 'Reservado RCP', P4: 'Reservado RCP', P5: 'Reservado RCP',
    P6: 'Reservado RCP', P7: 'Reservado RCP', P8: 'Reservado RCP', P9: 'Reservado RCP',
    R: 'Aprobado PBN (los niveles van en PBN/ de la casilla 18)', T: 'TACAN', U: 'UHF de voz', V: 'VHF de voz',
    W: 'Aprobado RVSM', X: 'Aprobado MNPS / NAT HLA', Y: 'VHF con separación de canales de 8.33 kHz',
    Z: 'Otro equipo (se explica en COM/, NAV/ o DAT/ de la casilla 18)',
  },
  // Casilla 10b: equipo de vigilancia (transpondedor, ADS-B, ADS-C)
  c10b: {
    N: 'Sin equipo de vigilancia, o no funciona',
    A: 'Transpondedor modo A (sin altitud)', C: 'Transpondedor modos A y C (con altitud)',
    E: 'Modo S con identificación, altitud y squitter extendido (ADS-B)', H: 'Modo S con identificación, altitud y vigilancia mejorada',
    I: 'Modo S con identificación, sin altitud', L: 'Modo S con identificación, altitud, squitter extendido y vigilancia mejorada',
    P: 'Modo S con altitud, sin identificación', S: 'Modo S con identificación y altitud',
    X: 'Modo S sin identificación ni altitud',
    B1: 'ADS-B "out" en 1090 MHz', B2: 'ADS-B "out" e "in" en 1090 MHz', U1: 'ADS-B "out" por UAT', U2: 'ADS-B "out" e "in" por UAT',
    V1: 'ADS-B "out" por VDL modo 4', V2: 'ADS-B "out" e "in" por VDL modo 4',
    D1: 'ADS-C con FANS 1/A', G1: 'ADS-C con ATN',
  },
  // Casilla 18, PBN/: hasta 8 códigos. "req" = letras que deben estar en la casilla 10a
  pbn: {
    A1: { t: 'RNAV 10 (RNP 10)', req: [] },
    B1: { t: 'RNAV 5, todos los sensores permitidos', req: ['OS', 'D', 'G', 'I'] },
    B2: { t: 'RNAV 5 con GNSS', req: ['G'] }, B3: { t: 'RNAV 5 con DME/DME', req: ['D'] },
    B4: { t: 'RNAV 5 con VOR/DME', req: ['OS', 'D'] }, B5: { t: 'RNAV 5 con INS o IRS', req: ['I'] },
    B6: { t: 'RNAV 5 con LORAN C', req: ['C'] },
    C1: { t: 'RNAV 2, todos los sensores permitidos', req: ['D', 'G', 'I'] }, C2: { t: 'RNAV 2 con GNSS', req: ['G'] },
    C3: { t: 'RNAV 2 con DME/DME', req: ['D'] }, C4: { t: 'RNAV 2 con DME/DME/IRU', req: ['D', 'I'] },
    D1: { t: 'RNAV 1, todos los sensores permitidos', req: ['D', 'G', 'I'] }, D2: { t: 'RNAV 1 con GNSS', req: ['G'] },
    D3: { t: 'RNAV 1 con DME/DME', req: ['D'] }, D4: { t: 'RNAV 1 con DME/DME/IRU', req: ['D', 'I'] },
    L1: { t: 'RNP 4', req: ['G'] },
    O1: { t: 'RNP 1 básico, todos los sensores permitidos', req: ['D', 'G'] }, O2: { t: 'RNP 1 básico con GNSS', req: ['G'] },
    O3: { t: 'RNP 1 básico con DME/DME', req: ['D'] }, O4: { t: 'RNP 1 básico con DME/DME/IRU', req: ['D', 'I'] },
    S1: { t: 'RNP APCH (aproximación RNP)', req: ['G'] }, S2: { t: 'RNP APCH con Baro-VNAV', req: ['G'] },
    T1: { t: 'RNP AR APCH con tramos RF (requiere autorización especial)', req: ['G'] },
    T2: { t: 'RNP AR APCH sin tramos RF (requiere autorización especial)', req: ['G'] },
  },
  // Casilla 19: información suplementaria (no se transmite en el mensaje; se queda en la oficina ATS)
  radio: { U: 'UHF 243.0 MHz', V: 'VHF 121.5 MHz', E: 'ELT (transmisor de localización de emergencia)' },
  supervivencia: { P: 'Polar', D: 'Desierto', M: 'Marítimo', J: 'Selva' },
  chalecos: { L: 'con luz', F: 'con fluoresceína', U: 'con radio UHF 243.0', V: 'con radio VHF 121.5' },
};

/* ---------- 2. SEPARAR CÓDIGOS ---------- */
// En 10a las letras E, J, M y P llevan número (E1, J4...). Las demás son una sola letra.
const separar10a = (txt) => (txt || '').toUpperCase().replace(/\s/g, '').match(/E[1-3]|J[1-7]|M[1-3]|P[1-9]|[A-Z]/g) || [];
// En 10b, B, U, V llevan 1 o 2; D1 y G1 son ADS-C.
const separar10b = (txt) => (txt || '').toUpperCase().replace(/\s/g, '').match(/B[12]|U[12]|V[12]|D1|G1|[A-Z]/g) || [];
const separarPBN = (txt) => (txt || '').toUpperCase().replace(/\s/g, '').match(/[A-Z]\d/g) || [];

/* ---------- 3. ARMAR Y REVISAR EL PLAN ---------- */
/*
 * d = { c7, reglas, tipo, numero, aeronave, estela, c10a, c10b, salida, hora, velocidad, nivel, ruta,
 *       destino, eet, alterno1, alterno2, pbn, nav, com, dat, sur, dof, reg, opr, per, rmk,
 *       autonomia, personas, radio, supervivencia, chalecos, botes, color, n19, piloto, licencia }
 * Regresa { mensaje, item19, errores: [...], avisos: [...], equipo: [...], vigilancia: [...], pbnLista: [...] }
 */
function armarFPL(d) {
  const errores = [], avisos = [];
  const M = (x) => (x == null ? '' : String(x)).toUpperCase().trim();
  const c7 = M(d.c7).replace(/[-\s]/g, '');
  const eq = separar10a(d.c10a), vig = separar10b(d.c10b), pbn = separarPBN(d.pbn);

  // Casilla 7: identificación (máximo 7 caracteres, sin guiones)
  if (!/^[A-Z0-9]{2,7}$/.test(c7)) errores.push('Casilla 7: la identificación lleva de 2 a 7 letras o números, sin guion (XB-ABC se escribe XBABC).');
  // Casilla 8
  if (!CODIGOS.reglas[M(d.reglas)]) errores.push('Casilla 8: reglas de vuelo I, V, Y o Z.');
  if (!CODIGOS.tipo[M(d.tipo)]) errores.push('Casilla 8: tipo de vuelo S, N, G, M o X.');
  if (M(d.reglas) === 'Y' || M(d.reglas) === 'Z') avisos.push('Con Y o Z, indica en la ruta (casilla 15) el punto donde cambias de reglas de vuelo.');
  // Casilla 9
  const tipoAv = M(d.aeronave);
  if (!/^[A-Z0-9]{2,4}$/.test(tipoAv) && tipoAv !== 'ZZZZ') errores.push('Casilla 9: el tipo de aeronave es su designador OACI de 2 a 4 caracteres (Doc 8643), por ejemplo C172.');
  if (tipoAv === 'ZZZZ' && !M(d.typ)) errores.push('Casilla 9: si escribes ZZZZ, el tipo de aeronave va en TYP/ de la casilla 18.');
  if (!CODIGOS.estela[M(d.estela)]) errores.push('Casilla 9: estela L, M, H o J.');
  const numero = Number(d.numero) > 1 ? String(Number(d.numero)) : '';
  // Casilla 10a
  if (!eq.length) errores.push('Casilla 10a: escribe al menos una letra (N si no llevas equipo).');
  const desconocidos = eq.filter((c) => !CODIGOS.c10a[c]);
  if (desconocidos.length) errores.push(`Casilla 10a: no existe el código ${desconocidos.join(', ')}.`);
  if (eq.includes('N') && eq.length > 1) errores.push('Casilla 10a: N significa "sin equipo"; no se combina con otras letras.');
  // Regla R ↔ PBN/
  if (eq.includes('R') && !pbn.length) errores.push('Si pones R en la casilla 10a, la casilla 18 debe llevar PBN/ con tus códigos.');
  if (!eq.includes('R') && pbn.length) errores.push('Si llenas PBN/ en la casilla 18, debes poner R en la casilla 10a.');
  if (pbn.length > 8) errores.push('PBN/ admite máximo 8 códigos; los demás van en NAV/.');
  const malosPBN = pbn.filter((c) => !CODIGOS.pbn[c]);
  if (malosPBN.length) errores.push(`PBN/: no existe el código ${malosPBN.join(', ')}.`);
  // Cada código PBN pide ciertas letras en 10a ("OS" = O o S)
  pbn.filter((c) => CODIGOS.pbn[c]).forEach((c) => {
    const faltan = CODIGOS.pbn[c].req.filter((q) => !q.split('').some((l) => eq.includes(l)));
    if (faltan.length) errores.push(`PBN/${c} (${CODIGOS.pbn[c].t}) requiere en la casilla 10a: ${faltan.map((q) => q.split('').join(' o ')).join(', ')}.`);
  });
  if (eq.includes('Z') && !(M(d.com) || M(d.nav) || M(d.dat))) errores.push('Si pones Z en la casilla 10a, explica el equipo en COM/, NAV/ o DAT/ de la casilla 18.');
  if (eq.includes('B') && !eq.includes('G')) avisos.push('B (LPV) normalmente va junto con G (GNSS).');
  if (eq.includes('B') && !/SBAS/.test(M(d.nav))) avisos.push('Con aumentación SBAS (WAAS), muchos operadores agregan NAV/SBAS en la casilla 18.');
  if (eq.includes('S') && (eq.includes('O') || eq.includes('L') || eq.includes('V'))) avisos.push('S ya incluye VHF, VOR e ILS: no hace falta repetir V, O o L.');
  // Casilla 10b
  if (!vig.length) errores.push('Casilla 10b: escribe N si no llevas transpondedor.');
  const malosB = vig.filter((c) => !CODIGOS.c10b[c]);
  if (malosB.length) errores.push(`Casilla 10b: no existe el código ${malosB.join(', ')}.`);
  const modos = vig.filter((c) => /^[ACEHILPSX]$/.test(c));
  if (modos.length > 1) errores.push('Casilla 10b: pon solo UNA letra de transpondedor (A, C, E, H, I, L, P, S o X).');
  // Casilla 13
  const salida = M(d.salida), hora = M(d.hora);
  if (!/^[A-Z]{4}$/.test(salida)) errores.push('Casilla 13: aeródromo de salida con su indicador OACI de 4 letras (Doc 7910), por ejemplo MMTO; ZZZZ si no tiene.');
  if (!/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) errores.push('Casilla 13: hora estimada fuera de calzos (EOBT) en 4 cifras, hora UTC (HHMM).');
  if (salida === 'ZZZZ' && !M(d.dep)) errores.push('Casilla 13: con ZZZZ, el nombre o las coordenadas del aeródromo van en DEP/ de la casilla 18.');
  // Casilla 15
  const vel = M(d.velocidad), niv = M(d.nivel), ruta = M(d.ruta).replace(/\s+/g, ' ');
  if (!/^(N\d{4}|K\d{4}|M\d{3})$/.test(vel)) errores.push('Casilla 15: velocidad de crucero N + 4 cifras (nudos, ej. N0105), K + 4 (km/h) o M + 3 (Mach, ej. M078).');
  if (!/^(F\d{3}|A\d{3}|S\d{4}|M\d{4}|VFR)$/.test(niv)) errores.push('Casilla 15: nivel F + 3 cifras (nivel de vuelo, ej. F350), A + 3 (altitud en cientos de pies, ej. A095), S o M + 4 (metros), o VFR.');
  if (M(d.reglas) === 'I' && niv === 'VFR') errores.push('Casilla 15: en un vuelo IFR el nivel no puede ser VFR.');
  if (!ruta) errores.push('Casilla 15: escribe la ruta (aerovías y puntos, o DCT para directo).');
  // Casilla 16
  const destino = M(d.destino), eet = M(d.eet);
  if (!/^[A-Z]{4}$/.test(destino)) errores.push('Casilla 16: aeródromo de destino con indicador OACI de 4 letras.');
  if (!/^\d{2}[0-5]\d$/.test(eet)) errores.push('Casilla 16: duración total estimada (EET) en 4 cifras: horas y minutos (0040 = 40 min).');
  const alternos = [M(d.alterno1), M(d.alterno2)].filter(Boolean);
  alternos.forEach((a) => { if (!/^[A-Z]{4}$/.test(a)) errores.push(`Casilla 16: el alterno ${a} debe ser un indicador OACI de 4 letras.`); });
  if (M(d.reglas) === 'I' && !alternos.length) avisos.push('Vuelo IFR sin alterno: revisa si tu normativa y tu operador te exigen uno.');

  // Casilla 18: en el orden que fija el Doc 4444
  const c18 = [];
  const add = (k, v) => { const x = M(v); if (x) c18.push(`${k}/${x}`); };
  if (pbn.length) c18.push('PBN/' + pbn.join(''));
  add('NAV', d.nav); add('COM', d.com); add('DAT', d.dat); add('SUR', d.sur);
  add('DEP', d.dep); add('DOF', d.dof); add('REG', d.reg); add('TYP', d.typ); add('OPR', d.opr); add('PER', d.per); add('RMK', d.rmk);
  if (M(d.dof) && !/^\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(M(d.dof))) errores.push('DOF/: fecha del vuelo en formato AAMMDD (261117 = 17 de noviembre de 2026).');
  if (M(d.reg) && M(d.reg).replace(/-/g, '') === c7) avisos.push('REG/ solo se pone si la matrícula es distinta de la identificación de la casilla 7.');

  // Casilla 19: información suplementaria
  const s19 = [];
  if (!/^\d{4}$/.test(M(d.autonomia))) errores.push('Casilla 19: autonomía E/ en 4 cifras, horas y minutos (0400 = 4 h).'); else s19.push('E/' + M(d.autonomia));
  if (!/^\d{1,3}$/.test(M(d.personas))) errores.push('Casilla 19: personas a bordo P/ (número, incluida la tripulación).'); else s19.push('P/' + M(d.personas).padStart(3, '0'));
  if (M(d.radio)) s19.push('R/' + M(d.radio).replace(/[^UVE]/g, ''));
  if (M(d.supervivencia)) s19.push('S/' + M(d.supervivencia).replace(/[^PDMJ]/g, ''));
  if (M(d.chalecos)) s19.push('J/' + M(d.chalecos).replace(/[^LFUV]/g, ''));
  if (M(d.botes)) s19.push('D/' + M(d.botes));
  if (M(d.color)) s19.push('A/' + M(d.color));
  if (M(d.n19)) s19.push('N/' + M(d.n19));
  if (M(d.piloto)) s19.push('C/' + M(d.piloto)); else errores.push('Casilla 19: escribe el nombre del piloto al mando (C/).');

  // El mensaje, con un guion antes de cada casilla
  const mensaje = `(FPL-${c7}-${M(d.reglas)}${M(d.tipo)}\n-${numero}${tipoAv}/${M(d.estela)}-${eq.join('')}/${vig.join('')}\n-${salida}${hora}\n-${vel}${niv} ${ruta}\n-${destino}${eet}${alternos.length ? ' ' + alternos.join(' ') : ''}\n-${c18.length ? c18.join(' ') : '0'})`;
  return {
    mensaje, item19: s19.join(' '), c18: c18.length ? c18.join(' ') : '0', errores, avisos,
    equipo: eq.map((c) => [c, CODIGOS.c10a[c] || '¿?']), vigilancia: vig.map((c) => [c, CODIGOS.c10b[c] || '¿?']),
    pbnLista: pbn.map((c) => [c, CODIGOS.pbn[c] ? CODIGOS.pbn[c].t : '¿?']),
  };
}

/* Ejemplos listos para cargar */
const EJEMPLOS = {
  vfr: {
    nombre: 'VFR · Cessna 172 de Toluca a Puebla',
    datos: { c7: 'XBABC', reglas: 'V', tipo: 'G', numero: '', aeronave: 'C172', estela: 'L', c10a: 'SG', c10b: 'C',
      salida: 'MMTO', hora: '1500', velocidad: 'N0105', nivel: 'VFR', ruta: 'DCT', destino: 'MMPB', eet: '0040',
      alterno1: 'MMTO', alterno2: '', pbn: '', nav: '', com: '', dat: '', sur: '', dep: '', dof: '261117', reg: '', typ: '', opr: '', per: '',
      rmk: 'VUELO DE INSTRUCCION', autonomia: '0400', personas: '2', radio: 'E', supervivencia: '', chalecos: '', botes: '',
      color: 'BLANCO CON FRANJAS AZULES', piloto: 'J GARCIA' },
  },
  ifr: {
    nombre: 'IFR · Cessna 172 con GNSS/WAAS, ruta ilustrativa',
    datos: { c7: 'XBABC', reglas: 'I', tipo: 'G', numero: '', aeronave: 'C172', estela: 'L', c10a: 'SBDGR', c10b: 'EB1',
      salida: 'MMTO', hora: '1500', velocidad: 'N0110', nivel: 'A160', ruta: 'DCT', destino: 'MMPB', eet: '0045',
      alterno1: 'MMTO', alterno2: '', pbn: 'C2D2S1', nav: 'SBAS', com: '', dat: '', sur: '', dep: '', dof: '261117', reg: '', typ: '', opr: '', per: '',
      rmk: '', autonomia: '0430', personas: '2', radio: 'E', supervivencia: '', chalecos: '', botes: '',
      color: 'BLANCO CON FRANJAS AZULES', piloto: 'J GARCIA' },
  },
};

const AIrFPL = { CODIGOS, separar10a, separar10b, separarPBN, armarFPL, EJEMPLOS };
if (typeof module !== 'undefined') module.exports = AIrFPL;
if (typeof window !== 'undefined') window.AIrFPL = AIrFPL;
