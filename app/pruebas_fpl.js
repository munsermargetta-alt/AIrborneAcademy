/*
 * pruebas_fpl.js — Pruebas del armado del plan de vuelo OACI.
 * Correr con:  node pruebas_fpl.js
 */
const F = require('./fpl.js');
let ok = 0, mal = 0;
const prueba = (nombre, cond) => { console.log(`${cond ? '✔' : '✘'} ${nombre}`); cond ? ok++ : mal++; };

// Separar códigos
prueba('10a "SDE2GJ3R" → S D E2 G J3 R', F.separar10a('SDE2GJ3R').join(' ') === 'S D E2 G J3 R');
prueba('10b "EB1" → E B1', F.separar10b('EB1').join(' ') === 'E B1');
prueba('PBN "C2D2S1" → C2 D2 S1', F.separarPBN('C2D2S1').join(' ') === 'C2 D2 S1');

// Ejemplo VFR: sin errores y mensaje esperado
let r = F.armarFPL(F.EJEMPLOS.vfr.datos);
prueba('VFR sin errores', r.errores.length === 0);
prueba('VFR mensaje', r.mensaje === '(FPL-XBABC-VG\n-C172/L-SG/C\n-MMTO1500\n-N0105VFR DCT\n-MMPB0040 MMTO\n-DOF/261117 RMK/VUELO DE INSTRUCCION)');
prueba('VFR casilla 19', r.item19 === 'E/0400 P/002 R/E A/BLANCO CON FRANJAS AZULES C/J GARCIA');

// Ejemplo IFR: sin errores, PBN/ antes que NAV/
r = F.armarFPL(F.EJEMPLOS.ifr.datos);
prueba('IFR sin errores', r.errores.length === 0);
prueba('IFR casilla 18 en orden', /-PBN\/C2D2S1 NAV\/SBAS DOF\/261117\)$/.test(r.mensaje));

// Errores típicos
const base = { ...F.EJEMPLOS.ifr.datos };
r = F.armarFPL({ ...base, c10a: 'SBDG' });
prueba('PBN/ sin R en 10a → error', r.errores.some((e) => /debes poner R/.test(e)));
r = F.armarFPL({ ...base, pbn: '' });
prueba('R sin PBN/ → error', r.errores.some((e) => /debe llevar PBN/.test(e)));
r = F.armarFPL({ ...base, c10a: 'SR', pbn: 'D2' });
prueba('D2 sin G → error de dependencia', r.errores.some((e) => /PBN\/D2/.test(e)));
r = F.armarFPL({ ...base, c7: 'XB-ABC' });
prueba('XB-ABC se acepta quitando el guion', r.errores.length === 0 && r.mensaje.startsWith('(FPL-XBABC-'));
r = F.armarFPL({ ...base, nivel: 'VFR' });
prueba('IFR con nivel VFR → error', r.errores.some((e) => /no puede ser VFR/.test(e)));
r = F.armarFPL({ ...base, c10b: 'CS' });
prueba('dos transpondedores → error', r.errores.some((e) => /solo UNA letra/.test(e)));
r = F.armarFPL({ ...base, hora: '2560' });
prueba('hora inválida → error', r.errores.some((e) => /Casilla 13/.test(e)));
r = F.armarFPL({ ...base, pbn: 'A1B2C2D2L1O2S1S2T1' });
prueba('más de 8 PBN → error', r.errores.some((e) => /máximo 8/.test(e)));

console.log(`\n${ok} correctas, ${mal} con error`);
process.exit(mal ? 1 : 0);
