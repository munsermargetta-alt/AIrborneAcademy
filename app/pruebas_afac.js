/*
 * pruebas_afac.js — Llena el formato AFAC con el ejemplo VFR y revisa campo por campo.
 * Correr con:  node pruebas_afac.js   (genera prueba_afac.pdf para verlo)
 */
const fs = require('fs');
const PDFLib = require('./vendor/pdf-lib.min.js');
const F = require('./fpl.js');
const { llenarAFAC } = require('./afac_pdf.js');
(async () => {
  const d = { ...F.EJEMPLOS.vfr.datos, licencia: 'PP-12345' };
  const r = F.armarFPL(d);
  const out = await llenarAFAC(PDFLib, fs.readFileSync('plan_vuelo_afac.pdf'), { ...d, casilla18: r.c18 });
  fs.writeFileSync('prueba_afac.pdf', out.bytes);
  const pdf = await PDFLib.PDFDocument.load(out.bytes);
  const v = (n) => { const f = pdf.getForm().getFields().find((x) => x.getName() === n || x.getName().endsWith('.' + n)); return f.getText() || ''; };
  let ok = 0, mal = 0;
  const p = (nom, a, b) => { const bien = a === b; console.log(`${bien ? '✔' : '✘'} ${nom}: "${a}" (esperado "${b}")`); bien ? ok++ : mal++; };
  p('casilla 7', ['ID 1', 'ID 2', 'ID 3', 'ID4', 'ID 4', 'ID 5', 'ID 6'].map(v).join(''), 'XBABC');
  p('reglas / tipo', v('REG 1') + v('TIP 1'), 'VG');
  p('aeronave / estela', ['AE 1', 'AE 2', 'AE 3', 'AE 4'].map(v).join('') + v('TE 1'), 'C172L');
  p('casilla 10', v('RAD 1').replace(/\s+/g, ' '), 'SG C');
  p('salida + hora', ['AS 1', 'AS 2', 'AS 3', 'AS 4', 'HS 1', 'HS 2', 'HS 3', 'HS 4'].map(v).join(''), 'MMTO1500');
  p('velocidad + nivel', ['VC 1', 'VC 2', 'VC 3', 'VC 4', 'VC 5', 'NI 1', 'NI 2', 'NI 3'].map(v).join(''), 'N0105VFR');
  p('ruta', v('RU 1'), 'DCT');
  p('destino + EET + alterno', ['AD 1', 'AD 2', 'AD 3', 'AD 4', 'EE 1', 'EE 2', 'EE 3', 'EE 4', 'AP 1', 'AP 2', 'AP 3', 'AP 4'].map(v).join(''), 'MMPB0040MMTO');
  p('casilla 18', v('DATOS 1'), 'DOF/261117 RMK/VUELO DE INSTRUCCION');
  p('fecha', ['FECHA1', 'FECHA2', 'FECHA3', 'FECHA4', 'FECHA5', 'FECHA6', 'FECHA7', 'FECHA8'].map(v).join(''), '17112026');
  p('E/ y P/', ['AU 1', 'AU 2', 'AU 3', 'AU 4', 'PR 1', 'PR 2', 'PR 3'].map(v).join(''), '0400002');
  p('R/: lleva ELT, se tachan U y V', v('UHF1') + v('VHF1') + v('E 1'), 'XX');
  p('S/, J/, D/ y N/ tachados', ['S 1', 'CH 1', 'D11', 'CU 1', 'N11'].map(v).join(''), 'XXXXX');
  p('A/', v('CM 1'), 'BLANCO CON FRANJAS AZULES');
  p('C/ con licencia', v('PI 1').replace(/\s+/g, ' '), 'J GARCIA PP-12345');
  console.log(`\n${ok} correctas, ${mal} con error`);
  process.exit(mal ? 1 : 0);
})();
