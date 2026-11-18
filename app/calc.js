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

/* 9) ARCO DME: ENTRAR AL ARCO DESDE UN RADIAL Y SALIR DEL ARCO A OTRO RADIAL
 * Un arco DME es volar en círculo alrededor de una estación VOR/DME a una distancia fija.
 *
 * Radio de viraje (r), según el tipo de viraje y la velocidad:
 *   - viraje estándar = 3°/s (½ estándar = 1.5°/s). Sin límite: r = V / ω.
 *   - inclinación necesaria: tan φ = V·ω / g. Si pasa de 25°, se limita a 25° (práctica común)
 *     y entonces r = V² / (g · tan 25°).
 *   Con viraje estándar sale r ≈ GS ÷ 190 (la regla de cabeza "0.5 % de la GS"):
 *   120 kt → 0.64 NM.  (Se usa la GS: con viento el radio real cambia; es una estimación.)
 *
 * ENTRADA (de radial a arco), viraje de unos 90°:
 *   - alejándote de la estación: empieza a virar en  DME = arco − r
 *   - acercándote a la estación: empieza a virar en  DME = arco + r
 *   - rumbo inicial sobre el arco (tangente): radial + 90° si recorres el arco en sentido horario
 *     (los radiales van subiendo), radial − 90° si es antihorario.
 *
 * SALIDA (de arco a radial), viraje de unos 90°:
 *   - radiales de anticipación = r × 60 / DME   (regla 60:1: a 10 DME, 1 NM ≈ 6 radiales)
 *   - empiezas a virar ese número de radiales ANTES del radial final.
 *   - curso a seleccionar: al acercarte = radial + 180 (TO); al alejarte = el radial (FROM).
 *
 * Longitud del arco = π · DME · Δ / 180   (Δ = grados recorridos alrededor de la estación)
 *
 * Fuentes: FAA Instrument Flying Handbook (FAA-H-8083-15B), cap. 9, arcos DME;
 * manuales de vuelo por instrumentos de la US Navy (regla 60/DME × 1 % de la GS).
 */
const G = 9.80665;               // gravedad (m/s²)
const KT_MS = 1852 / 3600;       // 1 nudo en m/s
function radioViraje(gs, giro = 'estandar', maxBank = 25) {
  const w = rad(giro === 'medio' ? 1.5 : 3);          // velocidad angular en rad/s
  const v = gs * KT_MS;                                 // velocidad en m/s
  let bank = deg(Math.atan(v * w / G));                 // inclinación necesaria
  let rM;
  if (bank > maxBank) { bank = maxBank; rM = v * v / (G * Math.tan(rad(maxBank))); }  // limitado a 25°
  else rM = v / w;
  return { rNM: rM / 1852, bank, limitado: bank === maxBank };
}

function arcoDME({ dme, radialEntrada, tramoEntrada = 'alejandose', sentido = 'horario',
  radialSalida, tramoSalida = 'acercandose', gs, giro = 'estandar' }) {
  if (!(dme > 0)) return { error: 'La distancia del arco debe ser mayor que cero.' };
  if (!(gs > 0)) return { error: 'La velocidad sobre el terreno debe ser mayor que cero.' };
  const vir = radioViraje(gs, giro);
  const r = vir.rNM;
  if (r >= dme * 0.5) return { error: 'El radio de viraje es demasiado grande para un arco tan cerrado. Baja la velocidad o usa un arco más lejano.' };
  const horario = sentido === 'horario';

  // --- Entrada al arco ---
  const dmeInicioViraje = tramoEntrada === 'alejandose' ? dme - r : dme + r;
  const rumboActual = tramoEntrada === 'alejandose' ? norm360(radialEntrada) : norm360(radialEntrada + 180);
  const rumboArco = norm360(radialEntrada + (horario ? 90 : -90));          // tangente al arco
  const viraje1 = norm180(rumboArco - rumboActual);                         // + derecha, − izquierda

  // --- Recorrido sobre el arco ---
  const delta = horario ? norm360(radialSalida - radialEntrada) : norm360(radialEntrada - radialSalida);
  const largoNM = Math.PI * dme * delta / 180;
  const minutos = largoNM / gs * 60;
  const radialesPorNM = 60 / dme;

  // --- Salida al radial final ---
  const anticipacion = r * radialesPorNM;                                   // grados (radiales)
  const radialInicioViraje2 = norm360(radialSalida + (horario ? -anticipacion : anticipacion));
  const cursoFinal = tramoSalida === 'acercandose' ? norm360(radialSalida + 180) : norm360(radialSalida);
  // rumbo sobre el arco justo al llegar al radial final (tangente en ese punto)
  const rumboArcoFinal = norm360(radialSalida + (horario ? 90 : -90));
  const viraje2 = norm180(cursoFinal - rumboArcoFinal);

  return {
    radio: r, bank: vir.bank, limitado: vir.limitado,
    dmeInicioViraje, rumboActual, rumboArco, viraje1,
    delta, largoNM, minutos, radialesPorNM,
    anticipacion, radialInicioViraje2, cursoFinal, rumboArcoFinal, viraje2,
    // aviso si el arco es muy corto para virar dos veces
    arcoCorto: delta < anticipacion + 5,
  };
}

/* 10) NIVELES DE CRUCERO SEGÚN LA DERROTA (regla semicircular, "hemisférica")
 * Derrota / curso MAGNÉTICO (no rumbo): de 000° a 179° → miles IMPARES; de 180° a 359° → miles PARES.
 * IFR: miles exactos (3,000, 5,000…).  VFR: miles + 500 ft (3,500, 5,500…).
 * Abajo de la altitud de transición se vuela en ALTITUD (con QNH); arriba del nivel de transición en NIVEL DE VUELO (1013.2 hPa / 29.92).
 *   - México: altitud de transición 18,500 ft, nivel de transición FL195 (cartas de México; confírmalo en el PIA, ENR 1.7).
 *   - EUA: 18,000 ft MSL y FL180 (14 CFR 91.121). 14 CFR 91.159 (VFR) y 91.179 (IFR).
 * RVSM (FL290–FL410, México y EUA): hacia el este FL290, 310 … 410; hacia el oeste FL300, 320 … 400.
 * Fuera del rango (arriba de FL410) no se calcula aquí.
 */
function nivelesCrucero({ derrota, reglas = 'IFR', pais = 'MX', minimo = 3000 }) {
  const d = norm360(derrota);
  const este = d < 180;                                  // 000–179
  const TA = pais === 'MX' ? 18500 : 18000;              // altitud de transición (ft)
  const TL = pais === 'MX' ? 195 : 180;                  // nivel de transición (FL)
  const lista = [];
  const vfr = reglas === 'VFR';
  // 1) Altitudes (debajo o en la altitud de transición)
  for (let mil = 1; mil <= 19; mil++) {
    if ((mil % 2 === 1) !== este) continue;              // impares al este, pares al oeste
    const ft = mil * 1000 + (vfr ? 500 : 0);
    if (ft < minimo) continue;
    const enAltitud = pais === 'MX' ? ft <= TA : ft < TA;
    if (enAltitud) lista.push({ texto: ft.toLocaleString('en-US') + ' ft', ft, tipo: 'alt' });
  }
  // 2) Niveles de vuelo (en o arriba del nivel de transición). VFR: no en EUA (espacio clase A) y,
  //    según el Anexo 2 de la OACI, no arriba de FL200 salvo autorización: aquí no se listan.
  if (!vfr) {
    for (let fl = Math.ceil(TL / 10) * 10; fl <= 410; fl += 10) {   // FL195 → el primero completo es FL200
      const miles = fl / 10;
      if (fl >= 290) { if ((este && (fl - 290) % 20 !== 0) || (!este && (fl - 300) % 20 !== 0)) continue; } // RVSM
      else if ((miles % 2 === 1) !== este) continue;
      lista.push({ texto: 'FL' + String(fl).padStart(3, '0'), ft: fl * 100, tipo: 'FL' });
    }
  }
  return { derrota: d, este, TA, TL, lista };
}

/* 11) PESO Y BALANCE (aviones ligeros)
 * Momento = peso × brazo.  CG = suma de momentos ÷ peso total.
 * Se revisa en tres momentos: peso cero combustible (ZFW), despegue y aterrizaje.
 * La envolvente se da como polígono [brazo, peso] (en pulgadas y libras), como en el POH.
 * Brazos y límites: tomados del POH de cada modelo (ver PERFILES_PYB). El peso vacío y su brazo
 * SIEMPRE salen del registro de peso y balance de TU avión (cambian con cada equipo instalado).
 */
const LB_GAL_AVGAS = 6.0;
const PERFILES_PYB = {
  C172S: {
    nombre: 'Cessna 172S Skyhawk SP', fuente: 'POH Cessna 172S, sección 6',
    pesoMaxDespegue: 2550, pesoMaxRampa: 2558, pesoMaxAterrizaje: 2550, combustibleUtilGal: 53, rodajeGal: 1.4,
    estaciones: [
      { id: 'frente', nombre: 'Piloto y copiloto', brazo: 37.0 },
      { id: 'atras', nombre: 'Asientos traseros', brazo: 73.0 },
      { id: 'equipaje1', nombre: 'Equipaje área 1', brazo: 95.0, max: 120 },
      { id: 'equipaje2', nombre: 'Equipaje área 2', brazo: 123.0, max: 50 },
    ],
    brazoCombustible: 48.0,
    notaEquipaje: 'Área 1 + área 2: máximo 120 lb juntas.', equipajeConjuntoMax: 120,
    // categoría normal: límite delantero 35.0 in hasta 1,950 lb, sube en línea recta a 41.0 in en 2,550 lb; trasero 47.3 in
    envolvente: [[35.0, 1500], [35.0, 1950], [41.0, 2550], [47.3, 2550], [47.3, 1500]],
  },
  PA28_161: {
    nombre: 'Piper PA-28-161 Warrior II', fuente: 'POH Piper PA-28-161 Warrior II, sección 6; TCDS 2A13',
    pesoMaxDespegue: 2325, pesoMaxRampa: 2332, pesoMaxAterrizaje: 2325, combustibleUtilGal: 48, rodajeGal: 1.2,
    estaciones: [
      { id: 'frente', nombre: 'Piloto y copiloto', brazo: 80.5 },
      { id: 'atras', nombre: 'Asientos traseros', brazo: 118.1 },
      { id: 'equipaje1', nombre: 'Equipaje', brazo: 142.8, max: 200 },
    ],
    brazoCombustible: 95.0,
    // categoría normal: delantero 83.0 in hasta 1,950 lb, sube a 87.0 in en 2,325 lb; trasero 93.0 in
    envolvente: [[83.0, 1400], [83.0, 1950], [87.0, 2325], [93.0, 2325], [93.0, 1400]],
  },
};

// ¿El punto (brazo, peso) está dentro del polígono? (método del rayo)
function dentroEnvolvente(pol, x, y) {
  let dentro = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i], [xj, yj] = pol[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  // los bordes cuentan como dentro (el límite es "hasta")
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i], [xj, yj] = pol[j];
    const cruz = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cruz) < 1e-6 && x >= Math.min(xi, xj) - 1e-9 && x <= Math.max(xi, xj) + 1e-9 && y >= Math.min(yi, yj) - 1e-9 && y <= Math.max(yi, yj) + 1e-9) return true;
  }
  return dentro;
}

function pesoBalance(perfil, { pesoVacio, brazoVacio, cargas = {}, combustibleGal = 0, consumoGal = 0 }) {
  const p = perfil;
  const filas = [{ nombre: 'Peso vacío básico', peso: pesoVacio, brazo: brazoVacio }];
  p.estaciones.forEach((e) => { const w = Number(cargas[e.id]) || 0; filas.push({ nombre: e.nombre, peso: w, brazo: e.brazo }); });
  const suma = (fs) => fs.reduce((a, f) => ({ peso: a.peso + f.peso, momento: a.momento + f.peso * f.brazo }), { peso: 0, momento: 0 });
  const zfw = suma(filas);
  const lbComb = combustibleGal * LB_GAL_AVGAS;
  const lbRodaje = Math.min(p.rodajeGal, combustibleGal) * LB_GAL_AVGAS;
  const lbConsumo = consumoGal * LB_GAL_AVGAS;
  const rampa = { peso: zfw.peso + lbComb, momento: zfw.momento + lbComb * p.brazoCombustible };
  const despegue = { peso: rampa.peso - lbRodaje, momento: rampa.momento - lbRodaje * p.brazoCombustible };
  const aterrizaje = { peso: despegue.peso - lbConsumo, momento: despegue.momento - lbConsumo * p.brazoCombustible };
  const cg = (x) => (x.peso > 0 ? x.momento / x.peso : 0);
  const punto = (x, max) => ({ peso: x.peso, momento: x.momento, cg: cg(x), dentro: dentroEnvolvente(p.envolvente, cg(x), x.peso) && (!max || x.peso <= max + 1e-9) });
  const avisos = [];
  if (combustibleGal > p.combustibleUtilGal) avisos.push(`Más combustible que el utilizable (${p.combustibleUtilGal} gal).`);
  if (consumoGal + p.rodajeGal > combustibleGal) avisos.push('El consumo del vuelo es mayor que el combustible cargado.');
  p.estaciones.forEach((e) => { if (e.max && (Number(cargas[e.id]) || 0) > e.max) avisos.push(`${e.nombre}: máximo ${e.max} lb.`); });
  if (p.equipajeConjuntoMax) {
    const eq = p.estaciones.filter((e) => e.id.startsWith('equipaje')).reduce((a, e) => a + (Number(cargas[e.id]) || 0), 0);
    if (eq > p.equipajeConjuntoMax) avisos.push(p.notaEquipaje);
  }
  const res = {
    filas, lbComb, lbRodaje, lbConsumo,
    zfw: punto(zfw), rampa: { ...punto(rampa), dentroPeso: rampa.peso <= p.pesoMaxRampa },
    despegue: punto(despegue, p.pesoMaxDespegue), aterrizaje: punto(aterrizaje, p.pesoMaxAterrizaje), avisos,
  };
  res.ok = res.zfw.dentro && res.despegue.dentro && res.aterrizaje.dentro && res.rampa.dentroPeso && !avisos.length;
  return res;
}

const AIrCalc = { norm360, norm180, trianguloViento, tiempoDistancia, altitudes, componentesViento,
  perfil, gradienteARegimen, regimenAGradiente, porcientoAFtNm, ftNmAPorciento, ftNmAGrados, conv, entradaEspera,
  radioViraje, arcoDME, nivelesCrucero, PERFILES_PYB, pesoBalance, dentroEnvolvente };

if (typeof module !== 'undefined') module.exports = AIrCalc;   // para las pruebas en Node
if (typeof window !== 'undefined') window.AIrCalc = AIrCalc;    // para la app en el navegador
