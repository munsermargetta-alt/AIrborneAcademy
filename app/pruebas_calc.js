/*
 * pruebas_calc.js — Pruebas automáticas del motor de cálculo.
 * Cómo correrlas (en una terminal con Node instalado):  node pruebas_calc.js
 * Cada prueba compara el resultado con un valor esperado y una tolerancia.
 * Los valores esperados vienen de cálculos independientes (fórmulas estándar
 * del PHAK/atmósfera ISA) y del ejemplo resuelto del manual de la CX-3 para esperas.
 */
const C = require('./calc.js');
let ok = 0, mal = 0;
function cerca(nombre, real, esperado, tol) {
  const bien = Math.abs(real - esperado) <= tol;
  console.log(`${bien ? '✔' : '✘'} ${nombre}: ${real.toFixed(2)} (esperado ${esperado} ± ${tol})`);
  bien ? ok++ : mal++;
}
function igual(nombre, real, esperado) {
  const bien = real === esperado;
  console.log(`${bien ? '✔' : '✘'} ${nombre}: ${real} (esperado ${esperado})`);
  bien ? ok++ : mal++;
}

// Triángulo de viento: viento de frente puro → sin corrección, GS = TAS − viento
let t = C.trianguloViento({ tc: 90, tas: 120, dirViento: 90, velViento: 20 });
cerca('viento de frente: WCA', t.wca, 0, 0.01); cerca('viento de frente: GS', t.gs, 100, 0.01);
// Viento cruzado puro desde la izquierda (desde 360 con curso 090): WCA = asin(20/120) = −9.59°
t = C.trianguloViento({ tc: 90, tas: 120, dirViento: 0, velViento: 20 });
cerca('cruzado izq: WCA', t.wca, -9.594, 0.01); cerca('cruzado izq: GS', t.gs, 118.32, 0.02);
// Caso general: TC 090, TAS 120, viento 045/20 → WCA = asin(20·sin(−45°)/120) = −6.77°, GS ≈ 105.0
t = C.trianguloViento({ tc: 90, tas: 120, dirViento: 45, velViento: 20, variacion: 5 });
cerca('general: WCA', t.wca, -6.77, 0.02); cerca('general: GS', t.gs, 105.01, 0.05);
cerca('general: rumbo magnético (var 5°E)', t.mh, 78.23, 0.05);

// Tiempo / distancia / combustible
let d = C.tiempoDistancia({ distancia: 150, gs: 100, consumoHora: 9 });
cerca('tiempo 150 NM a 100 kt (min)', d.tiempoMin, 90, 0.001); cerca('combustible 1.5 h × 9 gal/h', d.combustible, 13.5, 0.001);
d = C.tiempoDistancia({ distancia: 60, tiempoMin: 30 }); cerca('GS con 60 NM en 30 min', d.gs, 120, 0.001);

// Altitudes: QNH 1013.25 → PA = altitud indicada; ISA a 5000 ft = 5 °C
let a = C.altitudes({ altIndicada: 5000, qnhHpa: 1013.25, oat: 5 });
cerca('PA con QNH estándar', a.pa, 5000, 0.5); cerca('ISA a 5000 ft', a.isa, 5, 0.01); cerca('DA en ISA', a.da, 5000, 0.5);
// Toluca (MMTO, elev. ~8,466 ft) con QNH 1020 hPa y 20 °C: PA ≈ 8,466 − 184 ≈ 8,282; ISA ≈ −1.6; DA ≈ 8,282 + 120·21.6 ≈ 10,870
a = C.altitudes({ altIndicada: 8466, qnhHpa: 1020, oat: 20 });
cerca('Toluca: PA', a.pa, 8282, 6); cerca('Toluca: DA', a.da, 10872, 15);
// TAS: a nivel del mar ISA, TAS = CAS. A 10,000 ft ISA (−5 °C), TAS ≈ CAS × 1.16
a = C.altitudes({ altIndicada: 0, qnhHpa: 1013.25, oat: 15, cas: 100 }); cerca('TAS nivel del mar ISA', a.tas, 100, 0.05);
a = C.altitudes({ altIndicada: 10000, qnhHpa: 1013.25, oat: -4.81, cas: 100 }); cerca('TAS 10,000 ft ISA (σ tabla ISA = 0.7385)', a.tas, 116.37, 0.1);

// Componentes de viento: pista 27, viento 300/20 → cruzado 10 kt derecha, frente 17.3
let w = C.componentesViento({ pista: 27, dirViento: 300, velViento: 20 });
cerca('cruzado pista 27 viento 300/20', w.cruzado, 10, 0.01); igual('lado', w.lado, 'derecha'); cerca('de frente', w.frente, 17.32, 0.01);
w = C.componentesViento({ pista: 9, dirViento: 270, velViento: 10 }); cerca('viento de cola puro (negativo)', w.frente, -10, 0.01);
// Rumbo a volar en final: pista 27, viento 300/20, TAS 65 kt → WCA = asin(10/65) = 8.85° → rumbo 278.8°
w = C.componentesViento({ pista: 27, dirViento: 300, velViento: 20, tasFinal: 65 });
cerca('final: WCA', w.wcaFinal, 8.85, 0.01); cerca('final: rumbo a volar', w.rumboFinal, 278.85, 0.01);
cerca('final: GS = 65·cos(8.85°) − 17.32', w.gsFinal, 46.91, 0.02); cerca('final: régimen 3° (fpm)', w.rod3, 248.9, 0.3);
// Viento desde la izquierda: pista 09 (090), viento 040/15, TAS 70 → cruzado 11.49 izq → WCA −9.45° → rumbo 080.55°
w = C.componentesViento({ pista: 9, dirViento: 40, velViento: 15, tasFinal: 70 });
cerca('final izq: rumbo a volar', w.rumboFinal, 80.55, 0.02);
// Rumbo exacto de pista (152°) en lugar del número
w = C.componentesViento({ pista: 15, rumboExacto: 152, dirViento: 152, velViento: 10 }); cerca('rumbo exacto: sin cruzado', w.cruzado, 0, 0.001);

// Perfil: de 0 a 9,000 ft a 500 fpm = 18 min; a 90 kt = 27 NM
let p = C.perfil({ elevOrigen: 0, elevDestino: 0, crucero: 9000, roc: 500, gsAscenso: 90, rod: 500, gsDescenso: 120 });
cerca('TOC minutos', p.tocMin, 18, 0.001); cerca('TOC NM', p.tocNM, 27, 0.001); cerca('TOD NM', p.todNM, 36, 0.001);

// Gradiente ↔ régimen: 300 ft/NM a 120 kt = 600 fpm; 3.3 % ≈ 200.5 ft/NM
cerca('300 ft/NM a 120 kt', C.gradienteARegimen(300, 120), 600, 0.001);
cerca('3.3 % en ft/NM', C.porcientoAFtNm(3.3), 200.51, 0.01);
cerca('318 ft/NM ≈ 3°', C.ftNmAGrados(318.4), 3.0, 0.01);

// Conversiones
cerca('100 kt en km/h', C.conv.kt_kmh(100), 185.2, 0.001);
cerca('29.92 inHg en hPa', C.conv.inhg_hpa(29.92), 1013.2, 0.1);
cerca('0 °C en °F', C.conv.c_f(0), 32, 0.001);

// Esperas — ejemplo del manual CX-3: rumbo 155°, acercamiento 090°, virajes derecha → directa
igual('espera CX-3 → directa', C.entradaEspera({ cursoAcercamiento: 90, rumbo: 155 }).tipo, 'directa');
// Llegando con el mismo rumbo del acercamiento (090, desde atrás del fijo) → directa
igual('espera rumbo = acercamiento → directa', C.entradaEspera({ cursoAcercamiento: 90, rumbo: 90 }).tipo, 'directa');
// Llegando de frente al curso de alejamiento desde el lado no protegido: rumbo 300, acercamiento 090 → paralela? (r = norm(270−300)=330 → paralela)
igual('espera rumbo 300, acerc 090 → paralela', C.entradaEspera({ cursoAcercamiento: 90, rumbo: 300 }).tipo, 'paralela');
// r = norm(270−240)=30 → gota
igual('espera rumbo 240, acerc 090 → gota', C.entradaEspera({ cursoAcercamiento: 90, rumbo: 240 }).tipo, 'gota');

// Arcos DME
// Radio de viraje estándar a 120 kt: v = 61.73 m/s, ω = 0.05236 rad/s → r = 1179 m = 0.637 NM; inclinación ≈ 18.2°
let v = C.radioViraje(120);
cerca('radio estándar 120 kt (NM)', v.rNM, 0.637, 0.005); cerca('inclinación estándar 120 kt', v.bank, 18.24, 0.1);
// A 250 kt el viraje estándar pediría ~35°: se limita a 25° → r = v²/(g·tan25) = 128.6²/(9.80665·0.4663) = 3617 m = 1.95 NM
v = C.radioViraje(250);
cerca('radio a 250 kt limitado a 25° (NM)', v.rNM, 1.953, 0.01); igual('250 kt: limitado', v.limitado, true);
// Ejemplo: saliendo por el R-090, arco de 10 DME en sentido horario hasta el R-180, entrar al acercamiento, GS 120 kt
let ar = C.arcoDME({ dme: 10, radialEntrada: 90, tramoEntrada: 'alejandose', sentido: 'horario', radialSalida: 180, tramoSalida: 'acercandose', gs: 120 });
cerca('arco: DME para empezar a virar (10 − 0.64)', ar.dmeInicioViraje, 9.363, 0.01);
cerca('arco: rumbo sobre el arco 180', ar.rumboArco, 180, 0.001);
cerca('arco: viraje de entrada +90 (derecha)', ar.viraje1, 90, 0.001);
cerca('arco: 90° de arco = 15.7 NM', ar.largoNM, 15.708, 0.01);
cerca('arco: radiales de anticipación 0.637×6', ar.anticipacion, 3.82, 0.02);
cerca('arco: radial para empezar a virar ≈ 176', ar.radialInicioViraje2, 176.18, 0.02);
cerca('arco: curso final 360', ar.cursoFinal % 360, 0, 0.001);
cerca('arco: viraje de salida +90 (derecha)', ar.viraje2, 90, 0.001);
// Mismo arco antihorario del R-090 al R-360 acercándose a la estación por el R-090: empieza en 10.64 DME, rumbo 360
ar = C.arcoDME({ dme: 10, radialEntrada: 90, tramoEntrada: 'acercandose', sentido: 'antihorario', radialSalida: 0, tramoSalida: 'acercandose', gs: 120 });
cerca('antihorario: DME de inicio 10.64', ar.dmeInicioViraje, 10.637, 0.01);
cerca('antihorario: rumbo sobre el arco 000', ar.rumboArco % 360, 0, 0.001);
cerca('antihorario: viraje de entrada +90 (de 270 a 360, derecha)', ar.viraje1, 90, 0.001);
cerca('antihorario: radial de anticipación ≈ 003.8', ar.radialInicioViraje2, 3.82, 0.02);
cerca('antihorario: viraje de salida −90 (izquierda)', ar.viraje2, -90, 0.001);

// Niveles de crucero
const txt = (r) => r.lista.map((x) => x.texto).join(' ');
let nc = C.nivelesCrucero({ derrota: 90, reglas: 'VFR', pais: 'MX' });
igual('MX VFR al este', txt(nc), '3,500 ft 5,500 ft 7,500 ft 9,500 ft 11,500 ft 13,500 ft 15,500 ft 17,500 ft');
nc = C.nivelesCrucero({ derrota: 270, reglas: 'VFR', pais: 'MX' });
igual('MX VFR al oeste (18,500 = altitud de transición)', txt(nc), '4,500 ft 6,500 ft 8,500 ft 10,500 ft 12,500 ft 14,500 ft 16,500 ft 18,500 ft');
nc = C.nivelesCrucero({ derrota: 179, reglas: 'IFR', pais: 'MX', minimo: 15000 });
igual('MX IFR 179° (este) desde 15,000', txt(nc), '15,000 ft 17,000 ft FL210 FL230 FL250 FL270 FL290 FL310 FL330 FL350 FL370 FL390 FL410');
nc = C.nivelesCrucero({ derrota: 180, reglas: 'IFR', pais: 'MX', minimo: 15000 });
igual('MX IFR 180° (oeste) desde 15,000', txt(nc), '16,000 ft 18,000 ft FL200 FL220 FL240 FL260 FL280 FL300 FL320 FL340 FL360 FL380 FL400');
nc = C.nivelesCrucero({ derrota: 0, reglas: 'IFR', pais: 'US', minimo: 15000 });
igual('EUA IFR 000° desde 15,000', txt(nc), '15,000 ft 17,000 ft FL190 FL210 FL230 FL250 FL270 FL290 FL310 FL330 FL350 FL370 FL390 FL410');
nc = C.nivelesCrucero({ derrota: 359, reglas: 'VFR', pais: 'US', minimo: 15000 });
igual('EUA VFR 359° desde 15,000 (nada de 18,500: clase A)', txt(nc), '16,500 ft');
nc = C.nivelesCrucero({ derrota: 200, reglas: 'IFR', pais: 'US', minimo: 15000 });
igual('EUA IFR 200° desde 15,000', txt(nc), '16,000 ft FL180 FL200 FL220 FL240 FL260 FL280 FL300 FL320 FL340 FL360 FL380 FL400');

console.log(`\n${ok} correctas, ${mal} con error`);
process.exit(mal ? 1 : 0);
