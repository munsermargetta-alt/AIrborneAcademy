/*
 * pruebas_meteo.js — Pruebas del decodificador de METAR y TAF.  Correr con: node pruebas_meteo.js
 */
const M = require('./meteo.js');
let ok = 0, mal = 0;
const p = (n, a, b) => { const bien = JSON.stringify(a) === JSON.stringify(b); console.log(`${bien ? '✔' : '✘'} ${n}: ${JSON.stringify(a)}${bien ? '' : '  (esperaba ' + JSON.stringify(b) + ')'}`); bien ? ok++ : mal++; };
const todos = (r) => r.secciones.flatMap((s) => s.items);
const busca = (r, cod) => todos(r).find((x) => x.cod === cod) || {};

// 1. METAR de México (millas terrestres y altímetro en inHg)
let r = M.decodificar('METAR MMTO 181542Z 36008KT 9SM SCT020 BKN200 17/02 A3031 RMK 8/270 HZY');
p('tipo y estación', [r.tipo, r.estacion], ['METAR', 'MMTO']);
p('hora', r.hora, { dia: 18, h: 15, m: 42 });
p('viento', busca(r, '36008KT').es, 'Viento de los 360° verdaderos a 8 nudos');
p('visibilidad 9 SM', busca(r, '9SM').es, 'Visibilidad 9 millas terrestres (14.5 km)');
p('techo = capa BKN más baja', r.techo, 20000);
p('categoría VFR', r.categoria, 'VFR');
p('altímetro A3031 → 1026 hPa', busca(r, 'A3031').es, 'Altímetro 30.31 pulgadas de mercurio (1026 hPa)');
p('grupo 8/ de tipos de nube', /bajas: cúmulos de desarrollo/.test(busca(r, '8/270').es), true);
p('nada sin reconocer', r.noReconocidos, []);

// 2. METAR OACI con ráfagas, variación, chubascos, CB y tendencia
r = M.decodificar('METAR LEMD 181530Z 24015G28KT 200V280 4000 -SHRA BKN012 SCT030CB 12/09 Q1008 TEMPO 2500 SHRA');
p('ráfagas', busca(r, '24015G28KT').en, 'Wind 240 degrees, 15 knots, gusting 28 knots');
p('variación', busca(r, '200V280').es, 'La dirección del viento varía entre 200° y 280°');
p('chubascos ligeros', [busca(r, '-SHRA').es, busca(r, '-SHRA').en], ['Chubascos de lluvia, intensidad ligera', 'Light rain showers']);
p('CB marcado como peligro', busca(r, 'SCT030CB').clase, 'malo');
p('IFR por visibilidad 4 km (2.5 SM) — el techo 1,200 ft solo daría MVFR', r.categoria, 'IFR');
p('no cumple VMC de aeródromo (techo 1,200 ft, vis 4 km)', r.vmc, { ok: false, faltaTecho: true, faltaVis: true });
p('la tendencia TEMPO no cambia el techo actual', r.techo, 1200);
p('aviso de ráfagas (13 kt de diferencia)', r.avisos.some((a) => /Ráfagas 13 nudos/.test(a)), true);

// 3. SPECI de niebla: RVR en pies, VV, LIFR
r = M.decodificar('SPECI KSFO 181356Z 28005KT 1/2SM R28L/2400V4000FT FG VV002 12/12 A2998 RMK AO2 T01220117');
p('SPECI', r.tipo, 'SPECI');
p('RVR variable en pies', busca(r, 'R28L/2400V4000FT').es, 'Alcance visual en la pista 28L (RVR): 2400 ft variando a 4000 ft');
p('VV002 = techo 200 ft', r.techo, 200);
p('LIFR', r.categoria, 'LIFR');
p('aviso de niebla (T = Td)', r.avisos.some((a) => /punto de rocío a 2 °C/.test(a)), true);
p('T de RMK', busca(r, 'T01220117').es, 'Temperatura exacta 12.2 °C, punto de rocío 11.7 °C');

// 4. Visibilidad en dos piezas "1 1/2SM", temperaturas bajo cero, nieve levantada
r = M.decodificar('METAR CYYZ 181500Z 05020G30KT 1 1/2SM -SN BLSN OVC008 M05/M07 A2965');
p('1 1/2SM en una sola pieza', busca(r, '1 1/2SM').en, 'Visibility 1 1/2 statute miles');
p('temperaturas negativas', busca(r, 'M05/M07').es, 'Temperatura -5 °C, punto de rocío -7 °C (diferencia 2 °C)');
p('nieve levantada', busca(r, 'BLSN').en, 'Blowing snow');
p('IFR', r.categoria, 'IFR');

// 5. CAVOK y calma
r = M.decodificar('MMMX 181544Z 00000KT CAVOK 19/06 Q1022 NOSIG');
p('calma', busca(r, '00000KT').es, 'Viento en calma');
p('CAVOK → VFR', r.categoria, 'VFR');
p('NOSIG', busca(r, 'NOSIG').en, 'No significant change');

// 6. TAF con TEMPO, FM, TX/TN
r = M.decodificar('TAF MMTO 181100Z 1812/1912 36010KT P6SM SCT020 BKN200 TX22/1821Z TN03/1912Z TEMPO 1820/1902 5SM -TSRA BKN015CB FM190200 VRB03KT P6SM SKC');
p('es TAF', [r.tipo, r.estacion, r.validez], ['TAF', 'MMTO', '1812/1912']);
p('secciones', r.secciones.map((s) => s.titulo[1].split(' ')[0]), ['Header', 'Base', 'Temporarily', 'From']);
p('TX', busca(r, 'TX22/1821Z').es, 'Temperatura máxima de 22 °C el día 18 a las 2100 UTC');
p('P6SM', busca(r, 'P6SM').es, 'Visibilidad más de 6 millas terrestres (más de 9.7 km)');
p('tormenta con lluvia', busca(r, '-TSRA').es, 'Tormenta eléctrica con lluvia, intensidad ligera');
p('sin errores', r.noReconocidos, []);

// 7. TAF OACI con PROB30 TEMPO y BECMG, sin la palabra TAF al inicio
r = M.decodificar('EGLL 181100Z 1812/1918 22012KT 9999 BKN025 PROB30 TEMPO 1815/1819 22020G32KT 4000 +SHRA BKN012CB BECMG 1902/1905 27008KT');
p('detecta TAF por el periodo', r.tipo, 'TAF');
p('PROB30 TEMPO', r.secciones[2].titulo[0], 'Probabilidad 30 %, temporalmente, del día 18 a las 1500 UTC al día 18 a las 1900 UTC');
p('9999', busca(r, '9999').es, 'Visibilidad 10 km o más');
p('chubascos fuertes', busca(r, '+SHRA').en, 'Heavy rain showers');

// 8. Funciones sueltas
p('MVFR en el límite (3000 ft)', M.categoria(3000, 10), 'MVFR');
p('VFR arriba de 3000 ft y 5 SM', M.categoria(3100, 6), 'VFR');
p('edad del reporte', M.edadMin({ dia: 18, h: 15, m: 0 }, new Date(Date.UTC(2026, 10, 18, 15, 45))), 45);
p('edad cruzando de mes', M.edadMin({ dia: 31, h: 23, m: 0 }, new Date(Date.UTC(2026, 10, 1, 1, 0))), 120);
p('niebla en bancos', M.decodificar('METAR XXXX 010000Z 00000KT 0800 BCFG FEW001 08/08 Q1015').secciones[0].items.find((x) => x.cod === 'BCFG').en, 'Patches of fog');

console.log(`\n${ok} correctas, ${mal} con error`);
process.exit(mal ? 1 : 0);
