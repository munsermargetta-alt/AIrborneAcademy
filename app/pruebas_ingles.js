/*
 * pruebas_ingles.js — Pruebas de la normalización y comparación de voz.  Correr con: node pruebas_ingles.js
 */
const I = require('./ingles.js');
let ok = 0, mal = 0;
const p = (n, a, b) => { const bien = JSON.stringify(a) === JSON.stringify(b); console.log(`${bien ? '✔' : '✘'} ${n}: ${JSON.stringify(a)}`); bien ? ok++ : mal++; };
p('niner, nine y 9 son iguales', I.normalizar('heading zero niner zero'), I.normalizar('heading 090'));
p('flight level = FL', I.normalizar('FL240').join(' '), 'flight level 2 4 0');
p('frecuencia con punto', I.normalizar('119.85').join(' '), '1 1 9 decimal 8 5');
p('tree y fife', I.normalizar('tree fife').join(' '), '3 5');
let c = I.comparar('climb flight level 240 right heading 090 Aeromexico 234', 'Climb flight level two four zero, right heading zero niner zero, Aeromexico two three four.');
p('colación perfecta = 100%', c.pct, 100);
c = I.comparar('climb flight level 240 heading 090 Aeromexico 234', 'Climb flight level two four zero, right heading zero niner zero, Aeromexico two three four.');
p('falta "right"', c.ops.filter((o) => o.tipo === 'falta').map((o) => o.palabra), ['right']);
c = I.comparar('climb flight level 250', 'climb flight level two four zero');
p('cambio de 4 por 5', c.ops.filter((o) => o.tipo === 'cambio').map((o) => o.dijiste + '→' + o.palabra), ['5→4']);
p('fluidez', I.fluidez('um we have a bird strike eh on engine two', 6), { palabras: 10, ppm: 100, muletillas: 2 });
console.log(`\n${ok} correctas, ${mal} con error`);
process.exit(mal ? 1 : 0);
