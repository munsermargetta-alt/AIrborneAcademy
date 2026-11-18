/*
 * afac_pdf.js — Pasa el plan de vuelo de la app al formato oficial de la AFAC (PDF rellenable).
 * ---------------------------------------------------------------------------------------------
 * Cómo funciona:
 *   1. Abre la plantilla oficial "plan_vuelo_afac.pdf" (el formato F-1-1407 de la AFAC, que trae
 *      campos rellenables: una cajita por letra en casi todas las casillas).
 *   2. Reparte cada dato letra por letra en sus cajitas (por ejemplo XBABC en las 7 cajas de la casilla 7).
 *   3. En la casilla 19, donde el papel trae letras impresas (U V E, S P D M J, J L F U V, D C, N),
 *      la regla OACI es TACHAR lo que NO llevas: aquí se escribe una X encima.
 *   4. Regresa el PDF lleno. Los campos siguen siendo editables, por si quieres corregir algo a mano.
 *
 * Usa la librería pdf-lib (licencia MIT), guardada en vendor/pdf-lib.min.js para que funcione sin internet.
 * La lógica es la misma en el navegador y en Node (pruebas_afac.js).
 *
 * Destinatarios: se llenan con los del manual de rutas de SENEAM cuando el aeródromo de salida aparece ahí.
 * Lo que NO se llena porque lo pone la oficina ATS o tú a mano: prioridad, hora de
 * depósito, remitente, hora efectiva (ATD), domicilio y firma del piloto, y los recuadros de abajo.
 */
(function (raiz) {
  // Nombres de las cajitas del PDF, en orden de izquierda a derecha
  const CAJAS = {
    fecha: ['FECHA1', 'FECHA2', 'FECHA3', 'FECHA4', 'FECHA5', 'FECHA6', 'FECHA7', 'FECHA8'], // DD MM AAAA
    c7: ['ID 1', 'ID 2', 'ID 3', 'ID4', 'ID 4', 'ID 5', 'ID 6'],
    numero: ['NUMERO1', 'NUMERO2'],
    aeronave: ['AE 1', 'AE 2', 'AE 3', 'AE 4'],
    salida: ['AS 1', 'AS 2', 'AS 3', 'AS 4'], hora: ['HS 1', 'HS 2', 'HS 3', 'HS 4'],
    velocidad: ['VC 1', 'VC 2', 'VC 3', 'VC 4', 'VC 5'], nivel: ['NI 1', 'NI 2', 'NI 3', 'NI 4', 'NI 5'],
    destino: ['AD 1', 'AD 2', 'AD 3', 'AD 4'], eet: ['EE 1', 'EE 2', 'EE 3', 'EE 4'],
    alterno1: ['AP 1', 'AP 2', 'AP 3', 'AP 4'], alterno2: ['AA 1', 'AA 2', 'AA 3', 'AA 4'],
    autonomia: ['AU 1', 'AU 2', 'AU 3', 'AU 4'], personas: ['PR 1', 'PR 2', 'PR 3'],
    botesNum: ['NU1', 'NU2'], botesCap: ['CAP 1', 'CAP 2', 'CAP 3'],
  };
  // Renglones de texto libre y su ancho útil (puntos PDF) para cortar las líneas
  const RUTA = [['RU 1', 336], ['RU 2', 510], ['RU 3', 510], ['RU 4', 510], ['RU 5', 455]];
  const OTROS = [['DATOS 1', 498], ['DATOS 2', 507], ['DATOS 3', 506], ['DATOS 4', 506], ['DATOS 5', 452]];
  const X_10B = 463;   // en el renglón de la casilla 10, la diagonal "/" impresa está en x ≈ 457: 10b empieza después
  const X_RAD = 225;   // donde empieza el campo de la casilla 10
  const X_PILOTO = 89, X_LICENCIA = 218; // en el renglón C/: nombre y "No. LIC."

  async function llenarAFAC(PDFLib, plantilla, d) {
    const { PDFDocument, StandardFonts } = PDFLib;
    const pdf = await PDFDocument.load(plantilla);
    const form = pdf.getForm();
    const times = await pdf.embedFont(StandardFonts.TimesRoman);
    const M = (x) => (x == null ? '' : String(x)).toUpperCase().trim();
    // Algunos campos tienen nombre compuesto ("undefined.PO 1"): se buscan por la terminación
    const todos = form.getFields();
    const campo = (n) => todos.find((f) => f.getName() === n || f.getName().endsWith('.' + n));
    const poner = (n, txt) => { const f = campo(n); if (f) f.setText(txt); };
    const tachar = (n) => poner(n, 'X');
    // Reparte un texto letra por letra en sus cajas
    const cajas = (lista, txt) => { const t = M(txt).replace(/\s/g, ''); lista.forEach((n, i) => poner(n, t[i] || '')); };
    // Rellena con espacios hasta llegar a cierta posición x (para alinear con lo impreso)
    const ancho = (t) => times.widthOfTextAtSize(t, 10);
    const hasta = (txt, x0, x) => { let t = txt; while (x0 + ancho(t + ' ') <= x) t += ' '; return t; };
    // Corta un texto largo en renglones según su ancho
    const renglones = (txt, filas) => {
      const palabras = M(txt).split(/\s+/).filter(Boolean); const out = filas.map(() => '');
      let i = 0;
      palabras.forEach((p) => {
        while (i < filas.length && ancho((out[i] ? out[i] + ' ' : '') + p) > filas[i][1]) i++;
        if (i < filas.length) out[i] = out[i] ? out[i] + ' ' + p : p;
      });
      filas.forEach(([n], k) => poner(n, out[k]));
      return palabras.join(' ').length > out.join(' ').trim().length; // true = no cupo todo
    };

    // Fecha (de DOF/ AAMMDD; si no hay, hoy)
    const dof = M(d.dof);
    let dd, mm, aaaa;
    if (/^\d{6}$/.test(dof)) { aaaa = '20' + dof.slice(0, 2); mm = dof.slice(2, 4); dd = dof.slice(4, 6); }
    else { const h = new Date(); dd = String(h.getUTCDate()).padStart(2, '0'); mm = String(h.getUTCMonth() + 1).padStart(2, '0'); aaaa = String(h.getUTCFullYear()); }
    cajas(CAJAS.fecha, dd + mm + aaaa);

    // Destinatarios AFTN (del manual de rutas de SENEAM, si el aeródromo de salida aparece ahí)
    if (d.destinatarios && d.destinatarios.length) renglones(d.destinatarios.join(' '), [['Dest 1', 436], ['Dest 2', 436], ['Dest 3', 385]]);

    // Casillas 7, 8 y 9
    cajas(CAJAS.c7, M(d.c7).replace(/-/g, ''));
    poner('REG 1', M(d.reglas)); poner('TIP 1', M(d.tipo));
    if (Number(d.numero) > 1) cajas(CAJAS.numero, String(Number(d.numero)).padStart(2, '0'));
    cajas(CAJAS.aeronave, d.aeronave); poner('TE 1', M(d.estela));
    // Casilla 10: 10a a la izquierda de la "/" impresa, 10b a la derecha
    poner('RAD 1', hasta(M(d.c10a).replace(/\s/g, ''), X_RAD, X_10B) + M(d.c10b).replace(/\s/g, ''));
    // Casillas 13, 15 y 16
    cajas(CAJAS.salida, d.salida); cajas(CAJAS.hora, d.hora);
    cajas(CAJAS.velocidad, d.velocidad); cajas(CAJAS.nivel, d.nivel);
    const rutaLarga = renglones(d.ruta, RUTA);
    cajas(CAJAS.destino, d.destino); cajas(CAJAS.eet, d.eet);
    cajas(CAJAS.alterno1, d.alterno1); cajas(CAJAS.alterno2, d.alterno2);
    // Casilla 18: lo mismo que arma fpl.js, sin el paréntesis final
    const c18 = (d.casilla18 || '0');
    const otrosLargo = renglones(c18, OTROS);

    // Casilla 19
    cajas(CAJAS.autonomia, d.autonomia);
    if (M(d.personas)) cajas(CAJAS.personas, M(d.personas).padStart(3, '0'));
    const radio = M(d.radio);
    if (!radio.includes('U')) tachar('UHF1'); if (!radio.includes('V')) tachar('VHF1'); if (!radio.includes('E')) tachar('E 1');
    const sup = M(d.supervivencia);
    if (!sup) ['S 1', 'PO 1', 'DE 1', 'MA 1', 'SE 1'].forEach(tachar);
    else [['P', 'PO 1'], ['D', 'DE 1'], ['M', 'MA 1'], ['J', 'SE 1']].forEach(([l, n]) => { if (!sup.includes(l)) tachar(n); });
    const cha = M(d.chalecos);
    if (!cha) ['CH 1', 'LU 1', 'FL 1', 'UH 1', 'VHF2'].forEach(tachar);
    else [['L', 'LU 1'], ['F', 'FL 1'], ['U', 'UH 1'], ['V', 'VHF2']].forEach(([l, n]) => { if (!cha.includes(l)) tachar(n); });
    // Botes: "número capacidad [C] color", por ejemplo "2 012 C NARANJA"
    const botes = M(d.botes).split(/\s+/).filter(Boolean);
    if (!botes.length) { tachar('D11'); tachar('CU 1'); }
    else {
      cajas(CAJAS.botesNum, (botes[0] || '').padStart(2, '0'));
      cajas(CAJAS.botesCap, (botes[1] || '').padStart(3, '0'));
      const conCubierta = botes[2] === 'C';
      if (!conCubierta) tachar('CU 1');
      poner('COL 1', botes.slice(conCubierta ? 3 : 2).join(' '));
    }
    poner('CM 1', M(d.color));
    if (M(d.n19)) poner('OBS 1', M(d.n19)); else tachar('N11');
    // C/: nombre del piloto y, alineado con "No. LIC.", su número de licencia
    poner('PI 1', M(d.licencia) ? hasta(M(d.piloto), X_PILOTO, X_LICENCIA) + M(d.licencia) : M(d.piloto));

    form.updateFieldAppearances(times);
    return { bytes: await pdf.save(), rutaLarga, otrosLargo };
  }

  const AIrAFAC = { llenarAFAC, CAJAS };
  if (typeof module !== 'undefined') module.exports = AIrAFAC;
  if (typeof window !== 'undefined') raiz.AIrAFAC = AIrAFAC;
})(typeof window !== 'undefined' ? window : globalThis);
