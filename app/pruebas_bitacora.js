/*
 * pruebas_bitacora.js — Pruebas de los cálculos de la bitácora.  Correr con: node pruebas_bitacora.js
 */
const B = require('./bitacora.js');
let ok = 0, mal = 0;
const p = (n, a, b) => { const bien = JSON.stringify(a) === JSON.stringify(b); console.log(`${bien ? '✔' : '✘'} ${n}: ${JSON.stringify(a)} (esperado ${JSON.stringify(b)})`); bien ? ok++ : mal++; };
// Vuelo típico: encendido 8:05, se mueve 8:15, despega 8:25, aterriza 9:30, se detiene 9:38, apaga 9:40
const v = { fecha: '2026-11-17', encendido: '08:05', calzosFuera: '08:15', despegue: '08:25', aterrizaje: '09:30', calzosDentro: '09:38', apagado: '09:40', hobbsInicio: '1234.5', hobbsFin: '1236.1', horasCobradas: '1.7', costoHora: '3500', eetPlan: '0040', aterrizajes: '3' };
const c = B.calcularVuelo(v);
p('calzo a calzo 1:23', c.bloque, 83);
p('en el aire 1:05', c.aire, 65);
p('motor 1:35', c.motor, 95);
p('horómetro 1.6 h = 96 min', c.hobbs, 96);
p('cobrado 1.7 h = 102 min', c.cobrado, 102);
p('te cobraron 19 min de más', c.extra, 19);
p('costo extra ≈ $1,108', Math.round(c.costoExtra), 1108);
p('formato 1:23', B.hm(83), '1:23');
// Cruce de medianoche: 23:50 → 00:40 = 50 min
p('medianoche', B.dif('23:50', '00:40'), 50);
// Orden cronológico y totales
const l = [{ ...v, fecha: '2026-11-18' }, v, { ...v, calzosFuera: '07:00', calzosDentro: '07:30', horasCobradas: '0.5' }];
p('orden', B.ordenar(l).map((x) => x.fecha + ' ' + x.calzosFuera), ['2026-11-17 07:00', '2026-11-17 08:15', '2026-11-18 08:15']);
const t = B.totales(l);
p('total calzo a calzo', t.bloque, 83 + 83 + 30);
p('total aterrizajes', t.aterrizajes, 9);
// Error de captura: aire mayor que calzo a calzo
p('aviso de horas imposibles', B.calcularVuelo({ calzosFuera: '08:00', calzosDentro: '08:30', despegue: '07:50', aterrizaje: '08:40' }).avisos.length > 0, true);
p('CSV con encabezado', B.aCSV([v]).split('\n')[0].startsWith('﻿fecha;matricula'), true);
console.log(`\n${ok} correctas, ${mal} con error`);
process.exit(mal ? 1 : 0);
