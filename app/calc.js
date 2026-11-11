/*
 * calc.js — Motor de cálculo de AIrborne Academy
 * ------------------------------------------------
 * Aquí viven SOLO las matemáticas (sin pantallas). Así se pueden probar solas
 * (ver pruebas_calc.js) y la app las usa sin repetirlas.
 *
 * Convenciones:
 *  - Ángulos en grados (0–360). Viento "de dónde viene" (como en el METAR).
 *  - Velocidades en nudos (kt), distancias en millas náuticas (NM),
 *    altitudes en pies (ft), temperaturas en °C, tiempo en minutos.
 *  - Variación magnética: Este = positiva, Oeste = negativa.
 *    Regla "el Este se resta, el Oeste se suma": rumbo magnético = verdadero − variación.
 *
 * AVISO: herramienta de estudio. No sustituye al POH/AFM ni a la planeación oficial.
 */

const R = Math.PI / 180;                       // grados → radianes
const rad = (g) => g * R;
const deg = (r) => r / R;
// Normaliza un ángulo a 0–360 (por ejemplo −10 → 350, 370 → 10)
const norm360 = (a) => ((a % 360) + 360) % 360;
// Normaliza a −180…+180 (útil para "a la izquierda / a la derecha")
const norm180 = (a) => { const x = norm360(a); return x > 180 ? x - 360 : x; };

/* 1) TRIÁNGULO DE VIENTO
 * Entrada: curso verdadero (TC), TAS, viento (dirección de dónde viene y velocidad), variación.
 * Salida: ángulo de corrección (WCA, + = a la derecha), rumbo verdadero, rumbo magnético, GS.
 * Fórmulas: WCA = asin( Vw·sin(Dw − TC) / TAS ),  GS = TAS·cos(WCA) − Vw·cos(Dw − TC)
 */
function trianguloViento({ tc, tas, dirViento, velViento, variacion = 0 }) {
  if (tas <= 0) return { error: 'La TAS debe ser mayor que cero.' };
  const ang = rad(dirViento - tc);              // ángulo entre el viento y el curso
  const s = (velViento * Math.sin(ang)) / tas;  // seno del ángulo de corrección
  if (Math.abs(s) > 1) return { error: 'El viento cruzado es mayor que la TAS: no hay solución.' };
  const wca = deg(Math.asin(s));
  const gs = tas * Math.cos(rad(wca)) - velViento * Math.cos(ang);
  const th = norm360(tc + wca);
  const mh = norm360(th - variacion);
  return { wca, th, mh, gs };
}

/* 2) TIEMPO – VELOCIDAD – DISTANCIA – COMBUSTIBLE
 * Das dos de tres (distancia, GS, tiempo) y calcula el que falta.
 * Si das el consumo (por hora), calcula el combustible del tramo.
 */
function tiempoDistancia({ distancia, gs, tiempoMin, consumoHora }) {
  let d = distancia, v = gs, t = tiempoMin;
  const tiene = (x) => typeof x === 'number' && isFinite(x) && x > 0;
  if (tiene(d) && tiene(v) && !tiene(t)) t = (d / v) * 60;
  else if (tiene(d) && tiene(t) && !tiene(v)) v = d / (t / 60);
  else if (tiene(v) && tiene(t) && !tiene(d)) d = v * (t / 60);
  else if (!(tiene(d) && tiene(v) && tiene(t))) return { error: 'Escribe exactamente dos de: distancia, velocidad y tiempo.' };
  const combustible = tiene(consumoHora) ? consumoHora * (t / 60) : null;
  return { distancia: d, gs: v, tiempoMin: t, combustible };
}

/* 3) ALTITUDES Y TAS (atmósfera estándar OACI)
 * Altitud de presión exacta a partir del QNH (hPa):
 *   PA = altitud indicada + 145366.45 · (1 − (QNH/1013.25)^0.190284)
 * Altitud de densidad con la regla estándar (la del PHAK):
 *   ISA(°C) = 15 − 2·PA/1000;   DA ≈ PA + 120·(OAT − ISA)
 * TAS a partir de CAS (sin compresibilidad, bien para < 250 kt):
 *   TAS = CAS · √(ρ0/ρ),  con ρ/ρ0 = (P/P0)/(T/T0)
 */
const hpaAInhg = (h) => h * 0.0295299830714;
const inhgAHpa = (i) => i / 0.0295299830714;

function altitudes({ altIndicada, qnhHpa, oat, cas }) {
  const pa = altIndicada + 145366.45 * (1 - Math.pow(qnhHpa / 1013.25, 0.190284));
  const isa = 15 - 2 * (pa / 1000);
  const da = pa + 120 * (oat - isa);
  let tas = null;
  if (typeof cas === 'number' && cas > 0) {
    const pRel = Math.pow(1 - 6.8755856e-6 * pa, 5.2558797);   // P/P0 a esa altitud de presión
    const tRel = (oat + 273.15) / 288.15;                        // T/T0 real
    const sigma = pRel / tRel;                                   // densidad relativa ρ/ρ0
    tas = cas / Math.sqrt(sigma);
  }
  return { pa, isa, desvioIsa: oat - isa, da, tas };
}

/* 4) COMPONENTES DE VIENTO PARA UNA PISTA
 * Pista 27 → rumbo 270°. Ángulo = viento − pista.
 * Cruzado = V·sin(ángulo) (+ desde la derecha); de frente = V·cos(ángulo) (− = de cola).
 */
function componentesViento({ pista, rumboExacto, dirViento, velViento, rafaga, tasFinal }) {
  // Si das el rumbo exacto de la pista (carta de aeródromo, ej. 152°) se usa ese; si no, el número × 10.
  const rumboPista = rumboExacto > 0 ? rumboExacto : (pista <= 36 ? pista * 10 : pista);
  const ang = norm180(dirViento - rumboPista);
  const calc = (v) => ({ cruzado: v * Math.sin(rad(ang)), frente: v * Math.cos(rad(ang)) });
  const r = calc(velViento);
  const res = {
    rumboPista, angulo: ang,
    cruzado: Math.abs(r.cruzado), lado: r.cruzado >= 0 ? 'derecha' : 'izquierda',
    frente: r.frente,                      // positivo = de frente; negativo = de cola
    rafaga: rafaga ? calc(rafaga) : null,
  };
  /* RUMBO A VOLAR EN FINAL (corrección por deriva, "crab")
   * Es el triángulo de viento con el curso = eje de la pista:
   *   WCA = asin(cruzado / TAS en final)   → se apunta la nariz HACIA el viento
   *   rumbo a volar = rumbo de pista + WCA (viento por la derecha) o − WCA (por la izquierda)
   *   GS en final = TAS·cos(WCA) − componente de frente
   *   régimen para 3°: GS × 318.4 / 60  (≈ GS × 5.3)
   */
  if (tasFinal > 0) {
    const s = r.cruzado / tasFinal;
    if (Math.abs(s) >= 1) { res.errorFinal = 'El viento cruzado es mayor que la velocidad en final.'; return res; }
    const wca = deg(Math.asin(s));                 // + = corregir a la derecha
    res.wcaFinal = wca;
    res.rumboFinal = norm360(rumboPista + wca);
    res.gsFinal = tasFinal * Math.cos(rad(wca)) - r.frente;
    res.rod3 = res.gsFinal * 318.4 / 60;
  }
  return res;
}

/* 5) PERFIL DE ASCENSO Y DESCENSO (TOC / TOD)
 * Tiempo de ascenso = (altitud de crucero − elevación de origen) / régimen de ascenso
 * Distancia = GS de ascenso × tiempo. Lo mismo para el descenso.
 */
function perfil({ elevOrigen, elevDestino, crucero, roc, gsAscenso, rod, gsDescenso }) {
  const subir = crucero - elevOrigen, bajar = crucero - elevDestino;
  if (subir < 0 || bajar < 0) return { error: 'La altitud de crucero debe ser mayor que las elevaciones.' };
  const tSub = subir / roc, tBaj = bajar / rod;            // minutos
  return {
    tocMin: tSub, tocNM: gsAscenso * tSub / 60,
    todMin: tBaj, todNM: gsDescenso * tBaj / 60,
    // regla práctica de 3°: ~318 ft por NM (se muestra para comparar)
    tod3gradosNM: bajar / 318.4,
    gradienteDescenso: bajar / (gsDescenso * tBaj / 60),   // ft/NM real con estos datos
  };
}

/* 6) GRADIENTE ↔ RÉGIMEN
 * régimen (ft/min) = gradiente (ft/NM) × GS / 60;   1 % de gradiente = 60.76 ft/NM
 */
const FT_NM_POR_PORCIENTO = 6076.12 / 100;
function gradienteARegimen(gradFtNm, gs) { return gradFtNm * gs / 60; }
function regimenAGradiente(fpm, gs) { return fpm * 60 / gs; }
function porcientoAFtNm(p) { return p * FT_NM_POR_PORCIENTO; }
function ftNmAPorciento(g) { return g / FT_NM_POR_PORCIENTO; }
// ángulo de trayectoria en grados a partir de ft/NM
function ftNmAGrados(g) { return deg(Math.atan(g / 6076.12)); }

/* 7) CONVERSIONES */
const conv = {
  kt_kmh: (x) => x * 1.852,           kmh_kt: (x) => x / 1.852,
  kt_mph: (x) => x * 1.150779,        mph_kt: (x) => x / 1.150779,
  ft_m: (x) => x * 0.3048,            m_ft: (x) => x / 0.3048,
  nm_km: (x) => x * 1.852,            km_nm: (x) => x / 1.852,
  nm_sm: (x) => x * 1.150779,         sm_nm: (x) => x / 1.150779,
  c_f: (x) => x * 9 / 5 + 32,         f_c: (x) => (x - 32) * 5 / 9,
  hpa_inhg: hpaAInhg,                 inhg_hpa: inhgAHpa,
  lb_kg: (x) => x * 0.45359237,       kg_lb: (x) => x / 0.45359237,
  usgal_l: (x) => x * 3.785411784,    l_usgal: (x) => x / 3.785411784,
  // combustible: galones de AVGAS (6 lb/gal) y JET A (6.7 lb/gal) a libras
  avgas_lb: (x) => x * 6.0,           jeta_lb: (x) => x * 6.7,
};

/* 8) ENTRADA A ESPERA (sectores OACI/FAA)
 * Fórmula del prototipo validado (ejemplo del manual CX-3):
 *   O = curso de ALEJAMIENTO (= acercamiento + 180°), H = rumbo actual, r = norm(O − H)
 *   virajes a la derecha:  r < 70 → gota;  r ≤ 250 → directa;  si no → paralela
 *   virajes a la izquierda: espejo con r' = 360 − r
 * Ejemplo: rumbo 155°, acercamiento 090° (O = 270°) → r = 115° → directa.
 */
function entradaEspera({ cursoAcercamiento, rumbo, virajes = 'derecha' }) {
  const alejamiento = norm360(cursoAcercamiento + 180);
  let r = norm360(alejamiento - rumbo);
  if (virajes === 'izquierda') r = norm360(360 - r);
  let tipo;
  if (r < 70) tipo = 'gota';
  else if (r <= 250) tipo = 'directa';
  else tipo = 'paralela';
  // distancia al límite más cercano (aviso cuando está a ±5°)
  const limites = [0, 70, 250];
  const cerca = Math.min(...limites.map((l) => Math.abs(norm180(r - l))));
  return { tipo, r, cercaDeLimite: cerca <= 5 };
}

const AIrCalc = { norm360, norm180, trianguloViento, tiempoDistancia, altitudes, componentesViento,
  perfil, gradienteARegimen, regimenAGradiente, porcientoAFtNm, ftNmAPorciento, ftNmAGrados, conv, entradaEspera };

if (typeof module !== 'undefined') module.exports = AIrCalc;   // para las pruebas en Node
if (typeof window !== 'undefined') window.AIrCalc = AIrCalc;    // para la app en el navegador
