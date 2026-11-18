/*
 * ingles.js — Inglés aeronáutico para el RTARI (#/ingles).
 *
 * Partes:
 *   1. LÓGICA (sin pantalla, con pruebas en pruebas_ingles.js):
 *      - normalizar(): pasa lo que reconoce el micrófono a palabras comparables
 *        ("niner", "nine" y "9" cuentan igual; "flight level" = "FL"; etc.).
 *      - comparar(): alinea lo que dijiste contra lo esperado (distancia de edición por palabras)
 *        y dice qué palabras faltaron, sobraron o cambiaste, con un porcentaje.
 *   2. CONTENIDO: criterios OACI, alfabeto y números, colaciones, frases de pronunciación,
 *      escenas de escucha, tareas de habla y lecturas. Todo es material original de AIrborne.
 *   3. PANTALLA: voz del navegador (speechSynthesis) para escuchar, reconocimiento de voz
 *      (SpeechRecognition) para hablar y la grabadora (MediaRecorder) para oírte.
 *
 * Importante: el puntaje de la app mide qué tanto de lo que dijiste entendió el reconocedor.
 * Sirve para practicar inteligibilidad y precisión, NO es una calificación OACI.
 */
(function (raiz) {
  /* ---------- 1. LÓGICA ---------- */
  const NUM = { zero: '0', one: '1', wun: '1', two: '2', too: '2', three: '3', tree: '3', four: '4', fower: '4', five: '5', fife: '5',
    six: '6', seven: '7', eight: '8', ait: '8', nine: '9', niner: '9' };
  const EQUIV = { tousand: 'thousand', 'thousand': 'thousand', hundred: 'hundred', decimal: 'decimal', dayseemal: 'decimal', point: 'decimal',
    okay: 'ok', 'o.k.': 'ok', fl: 'flight level', 'squawking': 'squawk' };
  function normalizar(txt) {
    let t = String(txt || '').toLowerCase()
      .replace(/flight level/g, ' fl ')
      .replace(/(\d)\.(\d)/g, '$1 decimal $2')       // 118.1 → 118 decimal 1
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');   // FL240 → fl 240
    const out = [];
    t.split(/\s+/).filter(Boolean).forEach((p) => {
      if (/^\d+$/.test(p)) { p.split('').forEach((d) => out.push(d)); return; }   // "240" → 2 4 0
      if (NUM[p]) { out.push(NUM[p]); return; }
      if (p === 'fl') { out.push('flight', 'level'); return; }
      out.push(EQUIV[p] || p);
    });
    return out;
  }
  // Alinea dos listas de palabras (Levenshtein) y devuelve las operaciones
  function comparar(dicho, esperado) {
    const a = normalizar(dicho), b = normalizar(esperado);
    const n = a.length, m = b.length;
    const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    // reconstruir el camino
    const ops = []; let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
        ops.unshift(a[i - 1] === b[j - 1] ? { tipo: 'ok', palabra: b[j - 1] } : { tipo: 'cambio', palabra: b[j - 1], dijiste: a[i - 1] }); i--; j--;
      } else if (j > 0 && D[i][j] === D[i][j - 1] + 1) { ops.unshift({ tipo: 'falta', palabra: b[j - 1] }); j--; }
      else { ops.unshift({ tipo: 'sobra', dijiste: a[i - 1] }); i--; }
    }
    const aciertos = ops.filter((o) => o.tipo === 'ok').length;
    const pct = m ? Math.max(0, Math.round((1 - D[n][m] / Math.max(m, n)) * 100)) : 0;
    return { ops, aciertos, total: m, pct, dicho: a, esperado: b };
  }
  // Fluidez aproximada: palabras por minuto y muletillas
  function fluidez(texto, segundos) {
    const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
    const muletillas = palabras.filter((p) => /^(uh+|um+|eh+|em+|er+|ah+|este|like)$/i.test(p)).length;
    return { palabras: palabras.length, ppm: segundos > 0 ? Math.round(palabras.length / (segundos / 60)) : 0, muletillas };
  }
  const logica = { normalizar, comparar, fluidez };
  if (typeof module !== 'undefined') module.exports = logica;
  if (typeof window === 'undefined') return;

  /* ---------- 2. CONTENIDO ---------- */
  const CRITERIOS = [
    ['Pronunciación', 'Acento, ritmo y entonación que se entienden sin esfuerzo.', 'Acento influido por el español que a veces obliga a pedir repetición.', 'Rara vez interfiere.', 'Aunque tengas acento, nunca interfiere: se entiende siempre, con entonación natural.'],
    ['Estructura', 'Gramática y oraciones.', 'Errores en estructuras complejas, pero que no cambian el significado.', 'Buen control; errores raros.', 'Control constante de estructuras básicas y complejas.'],
    ['Vocabulario', 'Palabras técnicas y comunes.', 'Suficiente para temas comunes y de trabajo; parafrasea cuando le falta una palabra.', 'Amplio y preciso; parafrasea bien.', 'Amplio, preciso e idiomático, sensible al registro (formal o informal).'],
    ['Fluidez', 'Ritmo sin pausas que estorben.', 'Ritmo adecuado con pausas para buscar palabras.', 'Habla extensa con poco esfuerzo; usa conectores.', 'Discurso natural y sin esfuerzo, con conectores que lo hacen coherente.'],
    ['Comprensión', 'Entender lo que te dicen.', 'Entiende temas comunes; en situaciones inesperadas tarda más.', 'Entiende bien temas laborales y no rutinarios.', 'Entiende con precisión casi todo, incluidos matices y acentos variados.'],
    ['Interacción', 'Responder, confirmar y aclarar.', 'Responde a tiempo; verifica y aclara cuando hace falta.', 'Responde rápido y maneja bien los malentendidos.', 'Interactúa con soltura en todo tipo de situaciones; capta señales verbales y no verbales.'],
  ];
  const ALFABETO = 'Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu'.split(' ');
  const NUMEROS = [['0', 'ZE-RO'], ['1', 'WUN'], ['2', 'TOO'], ['3', 'TREE'], ['4', 'FOW-er'], ['5', 'FIFE'], ['6', 'SIX'], ['7', 'SEV-en'], ['8', 'AIT'], ['9', 'NIN-er'], ['.', 'DAY-SEE-MAL'], ['100', 'HUN-dred'], ['1000', 'TOU-SAND']];
  // Colaciones: ATC dice, el piloto debe colacionar (readback)
  const COLACIONES = [
    { atc: 'Aeromexico two three four, climb flight level two four zero, turn right heading zero niner zero.', rb: 'Climb flight level two four zero, right heading zero niner zero, Aeromexico two three four.' },
    { atc: 'X-ray Bravo Alfa Bravo Charlie, squawk four five two one, QNH one zero one three.', rb: 'Squawk four five two one, QNH one zero one three, X-ray Bravo Alfa Bravo Charlie.' },
    { atc: 'Volaris five one two, contact Mexico Approach one one niner decimal eight five.', rb: 'Mexico Approach one one niner decimal eight five, Volaris five one two.' },
    { atc: 'Viva four one zero, hold short runway two three, traffic on short final.', rb: 'Holding short runway two three, Viva four one zero.' },
    { atc: 'Aeromexico two three four, descend and maintain one two thousand feet, reduce speed two one zero knots.', rb: 'Descend and maintain one two thousand feet, reduce speed two one zero knots, Aeromexico two three four.' },
    { atc: 'X-ray Bravo Alfa Bravo Charlie, runway two seven, cleared for takeoff, wind two six zero degrees one two knots.', rb: 'Runway two seven, cleared for takeoff, X-ray Bravo Alfa Bravo Charlie.' },
    { atc: 'Volaris five one two, proceed direct to TLC, then hold as published, expect further clearance at one four three zero.', rb: 'Direct TLC, hold as published, expect further clearance at one four three zero, Volaris five one two.' },
    { atc: 'Viva four one zero, go around, I say again, go around, vehicle on the runway.', rb: 'Going around, Viva four one zero.' },
  ];
  const FRASES = [
    'Request vectors around the weather to the south.',
    'We have a passenger with severe chest pain, request priority landing.',
    'Bird strike on climb out, engine vibrations, request immediate return.',
    'Unable to maintain flight level two four zero due to moderate turbulence.',
    'Our left hydraulic system has failed, we will need a longer landing roll.',
    'Request lower altitude, we are picking up light to moderate icing.',
    'We are declaring a fuel emergency and require the shortest routing available.',
    'Say again your last transmission, it was partially blocked.',
    'Confirm the cleared altitude is one zero thousand feet.',
    'The aircraft ahead appears to have stopped on the taxiway, we are holding position.',
  ];
  const ESCUCHA = [
    { titulo: 'Emergencia médica', lineas: [
      ['P', 'Monterrey Center, Aeromexico three five one, we have a medical situation on board.'],
      ['C', 'Aeromexico three five one, Monterrey Center, go ahead.'],
      ['P', 'A male passenger, about sixty years old, is unconscious. A doctor on board is attending him. We request diversion to the nearest suitable airport.'],
      ['C', 'Roger. Nearest suitable is Monterrey, one two zero miles to the north. Turn left heading three five zero, descend flight level two zero zero. Do you require medical services on arrival?'],
      ['P', 'Left heading three five zero, descending flight level two zero zero. Affirm, please have an ambulance waiting at the gate, Aeromexico three five one.']],
      preguntas: [['¿Qué le pasa al pasajero?', ['Tiene dolor de pecho', 'Está inconsciente', 'Está agresivo'], 1],
        ['¿A cuántas millas está el aeropuerto propuesto?', ['20', '120', '210'], 1],
        ['¿Qué pide el piloto para la llegada?', ['Bomberos', 'Una ambulancia en la posición', 'Remolque'], 1]] },
    { titulo: 'Impacto de ave al despegue', lineas: [
      ['P', 'Guadalajara Tower, Volaris two two eight, we had a bird strike on the right engine during rotation.'],
      ['C', 'Volaris two two eight, Guadalajara Tower, say intentions.'],
      ['P', 'We have abnormal vibrations on engine number two. We will level off at six thousand feet, run the checklist and request to return for landing runway two eight.'],
      ['C', 'Roger, maintain six thousand feet, turn left heading one niner zero, expect runway two eight. Emergency services will be standing by.'],
      ['P', 'Maintain six thousand, left heading one niner zero, expecting runway two eight, Volaris two two eight.']],
      preguntas: [['¿Qué motor fue afectado?', ['El izquierdo (número 1)', 'El derecho (número 2)', 'Ambos'], 1],
        ['¿A qué altitud se va a nivelar?', ['6,000 ft', '8,000 ft', '16,000 ft'], 0],
        ['¿Qué pista espera?', ['10', '28', '18'], 1]] },
    { titulo: 'Desvío por tormentas', lineas: [
      ['P', 'Mexico Center, Viva one four six, request a deviation twenty miles left of track due to weather.'],
      ['C', 'Viva one four six, deviation up to twenty miles left of track approved, when able proceed direct to PAZ and report clear of weather.'],
      ['P', 'Deviation twenty miles left approved, will report clear of weather, Viva one four six.'],
      ['C', 'Viva one four six, also be advised, moderate turbulence reported at flight level three three zero by a Boeing seven three seven ahead.'],
      ['P', 'Copy the turbulence report, we would like to climb to flight level three five zero if available.']],
      preguntas: [['¿Hacia qué lado se desvía?', ['Derecha', 'Izquierda', 'No se desvía'], 1],
        ['¿Hasta cuántas millas autorizan?', ['10', '20', '30'], 1],
        ['¿Qué nivel pide el piloto al final?', ['FL330', 'FL350', 'FL370'], 1]] },
  ];
  const HABLA = [
    'Describe your flight training so far: aircraft, airports and the most challenging lesson.',
    'You are on final approach and the tower reports a vehicle near the runway. Explain what you do and what you say.',
    'Explain to a passenger why the flight is delayed because of thunderstorms at the destination.',
    'Describe a time when you misunderstood an instruction from ATC or an instructor. How did you resolve it?',
    'Your engine starts running rough at cruise. Describe your actions and your radio call.',
    'What do you think is the biggest safety risk in general aviation in Mexico, and why?',
  ];
  const LECTURAS = [
    { titulo: 'Fatigue: the hazard you cannot see', texto: 'Fatigue is insidious precisely because the impaired person is often the last to notice it. Studies of flight crews show that after seventeen hours awake, reaction times can deteriorate to a level comparable with a moderate blood alcohol concentration. Unlike alcohol, however, fatigue leaves no trace that an inspector can measure, which is why operators rely on fatigue risk management systems that combine scheduling rules, crew reporting and data analysis. The most effective countermeasure remains adequate sleep; caffeine and controlled rest can buy time, but they merely postpone the inevitable.',
      vocab: [['insidious', 'que avanza sin notarse'], ['impaired', 'disminuido, afectado'], ['countermeasure', 'medida de mitigación'], ['postpone', 'posponer']],
      preguntas: [['Según el texto, ¿por qué es peligrosa la fatiga?', ['Porque se mide fácil', 'Porque quien la sufre casi no la nota', 'Porque solo afecta de noche'], 1],
        ['¿Cuál es la contramedida más efectiva?', ['La cafeína', 'Dormir lo suficiente', 'El descanso controlado'], 1]] },
    { titulo: 'Runway incursions and the culture of readback', texto: 'A runway incursion rarely results from a single error. More often it is the product of an ambiguous taxi instruction, a hurried readback and a controller who hears what he expects to hear. Mandatory readback of hold short instructions exists to break that chain: the pilot repeats the clearance verbatim, and the controller actively listens for discrepancies. When either party treats the readback as a formality, the safety barrier quietly disappears. Plain language should complement, never replace, standard phraseology.',
      vocab: [['incursion', 'incursión, entrada indebida'], ['ambiguous', 'ambiguo'], ['verbatim', 'palabra por palabra'], ['discrepancies', 'diferencias, inconsistencias']],
      preguntas: [['¿Para qué existe la colación obligatoria de "hold short"?', ['Para ahorrar tiempo', 'Para romper la cadena de errores', 'Para practicar inglés'], 1],
        ['¿Qué dice el texto del lenguaje claro?', ['Debe reemplazar a la fraseología', 'Debe complementar a la fraseología', 'No debe usarse'], 1]] },
  ];

  /* ---------- 3. PANTALLA ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const tts = window.speechSynthesis;
  const est = { vel: 0.95, voz: null };
  function voces() { return (tts ? tts.getVoices() : []).filter((v) => /^en/i.test(v.lang)); }
  function hablar(texto, quien = 'C') {
    if (!tts) return;
    const u = new SpeechSynthesisUtterance(texto);
    const vs = voces();
    const preferida = vs.find((v) => v.name === est.voz) || vs[0];
    // piloto y controlador con voces distintas si hay más de una
    u.voice = quien === 'P' && vs.length > 1 ? (vs.find((v) => v !== preferida) || preferida) : preferida;
    u.lang = (u.voice && u.voice.lang) || 'en-US'; u.rate = est.vel;
    tts.speak(u);
  }
  function escuchar(onTexto, onFin) {
    if (!SR) { onFin('Tu navegador no tiene reconocimiento de voz. Usa Chrome o Edge (computadora o Android), o Safari reciente en iPhone.'); return null; }
    const r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    let final = '';
    r.onresult = (e) => { let parcial = ''; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '; else parcial += e.results[i][0].transcript; } onTexto(final + parcial); };
    r.onerror = (e) => onFin(e.error === 'not-allowed' ? 'Permite el micrófono para practicar.' : 'Error del reconocimiento: ' + e.error);
    r.onend = () => onFin(null, final.trim());
    r.start(); return r;
  }
  function pintarComparacion(c) {
    const pal = c.ops.map((o) => o.tipo === 'ok' ? `<span class="w ok">${esc(o.palabra)}</span>` : o.tipo === 'falta' ? `<span class="w falta" title="Faltó">${esc(o.palabra)}</span>` : o.tipo === 'cambio' ? `<span class="w cambio" title="Dijiste: ${esc(o.dijiste)}">${esc(o.palabra)}</span>` : `<span class="w sobra" title="Sobró">${esc(o.dijiste)}</span>`).join(' ');
    return `<div class="${c.pct >= 90 ? 'ok' : c.pct >= 70 ? 'aviso' : 'error'}">Coincidencia: <b>${c.pct}%</b> (${c.aciertos} de ${c.total} palabras).</div>
      <p class="palabras">${pal}</p><p class="nota">Verde: bien · Rojo: faltó · Ámbar: el reconocedor entendió otra palabra (toca para ver cuál) · Tachado: sobró.</p>`;
  }
  // Ejercicio "escucha y repite / colaciona": botones de oír, hablar y resultado
  function ejercicio(id, oirTexto, esperado, etiqueta) {
    return `<div class="card ej" data-ej="${id}"><p>${etiqueta}</p>
      <div class="ejemplos"><button type="button" class="boton" data-oir="${id}">▶ Escuchar</button><button type="button" class="boton oro" data-hablar="${id}">🎙 Responder</button></div>
      <p class="nota" data-vivo="${id}"></p><div data-res="${id}"></div>
      <details class="repaso"><summary>Ver texto</summary><p>${esc(oirTexto)}</p>${esperado !== oirTexto ? `<p><b>Colación esperada:</b> ${esc(esperado)}</p>` : ''}</details></div>`;
  }
  const ingles = {
    titulo: 'Inglés aeronáutico · RTARI',
    resumen: 'Criterios OACI, colaciones, escucha y pronunciación con reconocimiento de voz.',
    render() {
      const tab = (id, t) => `<button type="button" data-tab="${id}" aria-pressed="${id === 'criterios'}">${t}</button>`;
      return `<section class="calc guia">
        <h1>Inglés aeronáutico · Nivel 6</h1>
        <p class="intro">Preparación para el examen de competencia lingüística (RTARI). Escucha, responde en voz alta y revisa qué entendió el reconocedor. El examen oficial lo aplica un centro evaluador autorizado por la AFAC (CO DC-1.01/25); esta app te prepara, no te califica.</p>
        <div class="seg" id="ingTabs" style="flex-wrap:wrap">${tab('criterios', 'Criterios')}${tab('fraseo', 'Fraseología')}${tab('colacion', 'Colaciones')}${tab('pronun', 'Pronunciación')}${tab('escucha', 'Escucha')}${tab('habla', 'Habla')}${tab('lectura', 'Lectura')}</div>
        <div class="card" style="margin-top:12px"><div class="cols"><div class="campo"><label for="ingVoz">Voz en inglés</label><select id="ingVoz"></select></div>
          <div class="campo"><label for="ingVel">Velocidad: <span id="ingVelT">0.95</span></label><input id="ingVel" type="range" min="0.6" max="1.3" step="0.05" value="0.95"></div></div>
          <p class="nota">${SR ? 'El reconocimiento de voz usa el servicio de tu navegador (en Chrome, los audios se procesan en servidores de Google) y necesita internet.' : 'Tu navegador no tiene reconocimiento de voz: podrás escuchar y leer, pero para responder en voz alta usa Chrome o Edge.'}</p></div>
        <div id="ingCuerpo"></div>
        <p class="fuente">[OACI] Anexo 1, Apéndice 1 (escala de calificación de la competencia lingüística); Doc 9835 (manual de requisitos de competencia lingüística); Doc 9432 (manual de radiotelefonía). [MX-AFAC] CO DC-1.01/25.</p>
      </section>`;
    },
    activar() {
      const cuerpo = $('#ingCuerpo');
      const llenarVoces = () => { const s = $('#ingVoz'); if (!s) return; const vs = voces(); s.innerHTML = vs.length ? vs.map((v) => `<option ${v.name === est.voz ? 'selected' : ''}>${esc(v.name)}</option>`).join('') : '<option>Voz del sistema</option>'; if (!est.voz && vs[0]) est.voz = vs[0].name; };
      llenarVoces(); if (tts) tts.onvoiceschanged = llenarVoces;
      $('#ingVoz').addEventListener('change', (e) => { est.voz = e.target.value; });
      $('#ingVel').addEventListener('input', (e) => { est.vel = +e.target.value; $('#ingVelT').textContent = est.vel.toFixed(2); });
      const textos = {};   // id → {oir, esperado}
      const vistas = {
        criterios: () => `<h2>Cómo te califican</h2><p>Seis criterios. Tu nivel final es el <b>más bajo</b> de los seis: si tienes 6 en todo y 4 en pronunciación, eres nivel 4.</p>
          <div class="tabla"><table><thead><tr><th>Criterio</th><th>Qué es</th><th>Nivel 4 (operacional)</th><th>Nivel 5 (avanzado)</th><th>Nivel 6 (experto)</th></tr></thead><tbody>
          ${CRITERIOS.map((c) => `<tr><td><b>${c[0]}</b></td><td>${c[1]}</td><td>${c[2]}</td><td>${c[3]}</td><td>${c[4]}</td></tr>`).join('')}</tbody></table></div>
          <p class="nota">Resumen en español de la escala de la OACI (Anexo 1, Apéndice 1). Vigencia según la OACI: nivel 4, al menos cada 3 años; nivel 5, cada 6; nivel 6, sin reevaluación.</p>
          <h3>Lo que más baja a un hispanohablante</h3><ul>
          <li><b>Pronunciación:</b> la "th" (three, thousand), la "v" contra la "b", la "i" corta (ship / sheep) y poner "e" antes de "s" ("e-speed").</li>
          <li><b>Estructura:</b> olvidar la "s" de tercera persona ("the engine fail") y los tiempos ("we have lost" contra "we lost").</li>
          <li><b>Fluidez:</b> muletillas ("eh", "este") y traducir en la cabeza. Practica respuestas completas en voz alta.</li>
          <li><b>Interacción:</b> no pedir confirmación cuando no entiendes. Decir "say again" o "confirm…" es parte de un nivel alto.</li></ul>`,
        fraseo: () => `<h2>Alfabeto y números OACI</h2><div class="chips">${ALFABETO.map((a) => `<button type="button" class="chip" data-decir="${a}">${a}</button>`).join('')}</div>
          <div class="tabla"><table><thead><tr><th>Número</th><th>Se dice</th></tr></thead><tbody>${NUMEROS.map(([n, d]) => `<tr><td>${n}</td><td><button type="button" class="chip" data-decir="${d.replace(/-/g, '')}">${d}</button></td></tr>`).join('')}</tbody></table></div>
          <h3>Reglas que se olvidan</h3><ul><li>Los números se dicen dígito por dígito: rumbo 090 = "zero niner zero"; FL240 = "flight level two four zero".</li>
          <li>Altitudes en miles: 12,000 ft = "one two thousand feet"; 1,500 = "one thousand five hundred".</li>
          <li>Frecuencias con "decimal": 119.85 = "one one niner decimal eight five".</li>
          <li>En una colación repites lo esencial (autorizaciones, niveles, rumbos, pistas, frecuencias, squawk, QNH) y terminas con tu indicativo.</li>
          <li>Lenguaje claro (plain English): cuando la fraseología no alcanza (emergencias, situaciones raras), habla claro, corto y específico.</li></ul>`,
        colacion: () => `<h2>Colaciones (readback)</h2><p>Escucha al controlador y responde con tu colación completa, terminando con tu indicativo.</p>
          ${COLACIONES.map((c, i) => { textos['c' + i] = { oir: c.atc, esperado: c.rb, quien: 'C' }; return ejercicio('c' + i, c.atc, c.rb, `Mensaje ${i + 1}`); }).join('')}`,
        pronun: () => `<h2>Pronunciación</h2><p>Escucha la frase y repítela. La app marca qué palabras no entendió el reconocedor: esas son las que debes trabajar.</p>
          ${FRASES.map((f, i) => { textos['f' + i] = { oir: f, esperado: f, quien: 'P' }; return ejercicio('f' + i, f, f, `<b>${esc(f)}</b>`); }).join('')}`,
        escucha: () => `<h2>Escucha</h2><p>Escucha la escena completa y contesta. Si necesitas, baja la velocidad.</p>
          ${ESCUCHA.map((e, i) => `<div class="card ej"><h3>${esc(e.titulo)}</h3><button type="button" class="boton" data-escena="${i}">▶ Escuchar la escena</button>
            ${e.preguntas.map((q, k) => `<div class="campo"><label>${esc(q[0])}</label><div class="chips">${q[1].map((o, n) => `<button type="button" class="chip" data-resp="${i}-${k}-${n}" data-ok="${n === q[2]}">${esc(o)}</button>`).join('')}</div></div>`).join('')}
            <details class="repaso"><summary>Ver transcripción</summary>${e.lineas.map(([q, t]) => `<p><b>${q === 'P' ? 'Pilot' : 'ATC'}:</b> ${esc(t)}</p>`).join('')}</details></div>`).join('')}`,
        habla: () => `<h2>Habla</h2><p>Responde en voz alta de 45 a 90 segundos. Al terminar verás lo que entendió el reconocedor, tus palabras por minuto y tus muletillas. Escúchate y califícate con los 6 criterios.</p>
          ${HABLA.map((h, i) => `<div class="card ej"><p><b>${esc(h)}</b></p><div class="ejemplos"><button type="button" class="boton" data-decir="${esc(h)}">▶ Escuchar la pregunta</button><button type="button" class="boton oro" data-libre="${i}">🎙 Empezar</button></div>
            <p class="nota" data-libvivo="${i}"></p><div data-libres="${i}"></div></div>`).join('')}
          <h3>Autoevaluación</h3><ul><li>¿Te entendió casi todo el reconocedor? (pronunciación)</li><li>¿Usaste oraciones completas y tiempos correctos? (estructura)</li><li>¿Tuviste las palabras técnicas y parafraseaste cuando faltaron? (vocabulario)</li><li>¿Hablaste sin pausas largas, entre 110 y 160 palabras por minuto? (fluidez)</li><li>¿Respondiste justo lo que te preguntaron? (comprensión e interacción)</li></ul>`,
        lectura: () => `<h2>Lectura nivel 6</h2>${LECTURAS.map((l, i) => { textos['l' + i] = { oir: l.texto, esperado: l.texto, quien: 'P' };
          return `<div class="card ej"><h3>${esc(l.titulo)}</h3><p>${esc(l.texto)}</p><div class="ejemplos"><button type="button" class="boton" data-oir="l${i}">▶ Escuchar</button><button type="button" class="boton oro" data-hablar="l${i}">🎙 Léelo en voz alta</button></div>
            <p class="nota" data-vivo="l${i}"></p><div data-res="l${i}"></div>
            <p><b>Vocabulario:</b> ${l.vocab.map(([a, b]) => `<i>${esc(a)}</i> = ${esc(b)}`).join(' · ')}</p>
            ${l.preguntas.map((q, k) => `<div class="campo"><label>${esc(q[0])}</label><div class="chips">${q[1].map((o, n) => `<button type="button" class="chip" data-resp="l${i}-${k}-${n}" data-ok="${n === q[2]}">${esc(o)}</button>`).join('')}</div></div>`).join('')}</div>`; }).join('')}`,
      };
      let rec = null;
      function mostrar(id) {
        if (rec) { try { rec.stop(); } catch (e) { /* nada */ } rec = null; }
        if (tts) tts.cancel();
        cuerpo.innerHTML = vistas[id]();
        cuerpo.querySelectorAll('[data-decir]').forEach((b) => b.addEventListener('click', () => { tts && tts.cancel(); hablar(b.dataset.decir); }));
        cuerpo.querySelectorAll('[data-oir]').forEach((b) => b.addEventListener('click', () => { const t = textos[b.dataset.oir]; tts && tts.cancel(); hablar(t.oir, t.quien); }));
        cuerpo.querySelectorAll('[data-escena]').forEach((b) => b.addEventListener('click', () => { tts && tts.cancel(); ESCUCHA[+b.dataset.escena].lineas.forEach(([q, t]) => hablar(t, q)); }));
        cuerpo.querySelectorAll('[data-resp]').forEach((b) => b.addEventListener('click', () => { b.classList.add(b.dataset.ok === 'true' ? 'activo' : 'malo'); if (b.dataset.ok !== 'true') b.title = 'Incorrecto'; }));
        cuerpo.querySelectorAll('[data-hablar]').forEach((b) => b.addEventListener('click', () => {
          const id2 = b.dataset.hablar, t = textos[id2], vivo = cuerpo.querySelector(`[data-vivo="${id2}"]`), res = cuerpo.querySelector(`[data-res="${id2}"]`);
          if (rec) { rec.stop(); return; }
          tts && tts.cancel(); b.textContent = '■ Terminar'; res.innerHTML = '';
          rec = escuchar((txt) => { vivo.textContent = '“' + txt + '”'; }, (err, final) => {
            rec = null; b.textContent = '🎙 Responder';
            if (err) { vivo.textContent = err; return; }
            res.innerHTML = final ? pintarComparacion(comparar(final, t.esperado)) : '<p class="nota">No se escuchó nada. Revisa el micrófono.</p>';
          });
        }));
        cuerpo.querySelectorAll('[data-libre]').forEach((b) => b.addEventListener('click', () => {
          const i = b.dataset.libre, vivo = cuerpo.querySelector(`[data-libvivo="${i}"]`), res = cuerpo.querySelector(`[data-libres="${i}"]`);
          if (rec) { rec.stop(); return; }
          tts && tts.cancel(); const t0 = Date.now(); b.textContent = '■ Terminar'; res.innerHTML = '';
          // grabación para que te escuches (si el navegador lo permite)
          let grabador = null, trozos = [];
          if (navigator.mediaDevices && window.MediaRecorder) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => { grabador = new MediaRecorder(s); grabador.ondataavailable = (e) => trozos.push(e.data);
              grabador.onstop = () => { s.getTracks().forEach((x) => x.stop()); const url = URL.createObjectURL(new Blob(trozos)); res.insertAdjacentHTML('beforeend', `<p><b>Tu grabación:</b></p><audio controls src="${url}"></audio>`); }; grabador.start(); }).catch(() => {});
          }
          rec = escuchar((txt) => { vivo.textContent = '“' + txt + '”'; }, (err, final) => {
            rec = null; b.textContent = '🎙 Empezar'; if (grabador && grabador.state !== 'inactive') grabador.stop();
            if (err) { vivo.textContent = err; return; }
            const f = fluidez(final, (Date.now() - t0) / 1000);
            res.insertAdjacentHTML('afterbegin', `<div class="big">${[['Palabras', f.palabras], ['Palabras por minuto', f.ppm], ['Muletillas', f.muletillas]].map(([k, v]) => `<div class="dato"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
              ${f.ppm && (f.ppm < 100) ? '<div class="aviso">Ritmo lento: practica respuestas más continuas.</div>' : ''}${f.muletillas > 2 ? '<div class="aviso">Muchas muletillas: haz una pausa en silencio en lugar de "eh".</div>' : ''}`);
          });
        }));
      }
      document.querySelectorAll('#ingTabs button').forEach((b) => b.addEventListener('click', () => {
        document.querySelectorAll('#ingTabs button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); mostrar(b.dataset.tab);
      }));
      mostrar('criterios');
    },
  };
  raiz.AIrGuias = raiz.AIrGuias || {};
  raiz.AIrGuias.ingles = ingles;
})(typeof window !== 'undefined' ? window : globalThis);
