/*
 * app.js — Pantallas de la app de herramientas de AIrborne Academy.
 * -----------------------------------------------------------------
 * Cómo está armado:
 *  1. HERRAMIENTAS: una lista; cada herramienta dice qué datos pide (campos)
 *     y qué hace con ellos (calcular). Las matemáticas están en calc.js.
 *  2. Un "router" muy simple: la dirección #/viento muestra la herramienta "viento".
 *  3. Cada vez que cambias un dato, se recalcula al instante.
 *  4. Los últimos datos que escribiste se guardan en tu dispositivo (no se envían a ningún lado).
 *  5. Un "service worker" (sw.js) guarda la app para que funcione sin internet.
 */
(function () {
  const C = window.AIrCalc;
  const $ = (s, el = document) => el.querySelector(s);
  const f0 = (x) => Math.round(x).toLocaleString('es-MX');
  const f1 = (x) => (Math.round(x * 10) / 10).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rumbo = (x) => String(Math.round(C.norm360(x)) % 360).padStart(3, '0') + '°';
  const hm = (min) => { const h = Math.floor(min / 60), m = Math.round(min - h * 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
  const dato = (k, v, u = '') => `<div class="dato"><div class="k">${k}</div><div class="v">${v}${u ? ` <small>${u}</small>` : ''}</div></div>`;

  // Íconos (dibujos sencillos en línea)
  const ICO = {
    viento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>',
    tiempo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
    altitud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 20l6-9 4 5 3-4 5 8z"/><path d="M12 3v5M10 5l2-2 2 2"/></svg>',
    pista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 22L10 2h4l2 20z"/><path d="M12 6v2M12 11v2M12 16v2"/></svg>',
    perfil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 19l6-10h8l6 10"/><circle cx="8" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/></svg>',
    gradiente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 20L21 6"/><path d="M3 20h18"/><path d="M15 20a7 7 0 0 0-1-5"/></svg>',
    conv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>',
    espera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>',
    arco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="1.8" fill="currentColor"/><path d="M6 6a12 12 0 0 1 12 12"/><path d="M6 18L6 4M6 18L20 18"/></svg>',
    pbn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="19" cy="15" r="2"/><path d="M6.5 16.5L10.7 7.7M13.8 7.2l4 6"/></svg>',
    pyb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v16M5 20h14M4 9h16"/><path d="M4 9l-2 5h4zM20 9l-2 5h4z"/></svg>',
    bitacora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>',
    ingles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  };

  /* ---------- 1. LAS HERRAMIENTAS ---------- */
  const HERRAMIENTAS = [
    {
      id: 'viento', titulo: 'Triángulo de viento', resumen: 'Rumbo a volar y velocidad sobre el terreno.',
      intro: 'Con el curso que quieres seguir, tu velocidad verdadera y el viento, calcula cuánto corregir, qué rumbo volar y tu velocidad sobre el terreno (GS).',
      campos: [
        { id: 'tc', label: 'Curso verdadero', ayuda: 'El de tu carta, medido del norte verdadero.', u: '°', v: 90 },
        { id: 'tas', label: 'Velocidad verdadera (TAS)', ayuda: 'De la tabla de crucero del POH, o de la herramienta "Altitudes y TAS".', u: 'kt', v: 110 },
        { id: 'dirViento', label: 'Viento: de dónde viene', ayuda: 'Como en el pronóstico de vientos en altura (FB) o el METAR.', u: '°', v: 45 },
        { id: 'velViento', label: 'Viento: velocidad', u: 'kt', v: 20 },
        { id: 'variacion', label: 'Variación magnética', ayuda: 'Este = positiva, Oeste = negativa. En el centro de México es de unos 4°–6° Este; usa la de tu carta.', u: '°', v: 5 },
      ],
      calcular(d) {
        const r = C.trianguloViento(d);
        if (r.error) return `<div class="error">${r.error}</div>`;
        const lado = r.wca >= 0 ? 'a la derecha' : 'a la izquierda';
        return `<div class="big">${dato('Corrección', f1(Math.abs(r.wca)) + '°', r.wca >= 0 ? 'der.' : 'izq.')}${dato('Rumbo magnético', rumbo(r.mh))}${dato('Rumbo verdadero', rumbo(r.th))}${dato('GS', f0(r.gs), 'kt')}</div>
          <p class="explica">Apunta la nariz <b>${f1(Math.abs(r.wca))}° ${lado}</b> de tu curso: vuela rumbo magnético <b>${rumbo(r.mh)}</b>. Avanzarás a <b>${f0(r.gs)} kt</b> sobre el terreno${r.gs < d.tas ? ' (el viento te frena)' : ' (el viento te ayuda)'}.</p>
          ${dibujoViento(d, r)}
          <p class="formula">Fórmulas: <code>WCA = asin(V·sen(Dv−TC)/TAS)</code>, <code>GS = TAS·cos(WCA) − V·cos(Dv−TC)</code>. Rumbo magnético = verdadero − variación Este.</p>`;
      },
    },
    {
      id: 'tiempo', titulo: 'Tiempo, distancia y combustible', resumen: 'El dato que te falta y el combustible del tramo.',
      intro: 'Escribe dos de tres: distancia, velocidad sobre el terreno o tiempo. Deja vacío el que quieras calcular. Con el consumo por hora calcula el combustible.',
      campos: [
        { id: 'distancia', label: 'Distancia', u: 'NM', v: 120 },
        { id: 'gs', label: 'Velocidad sobre el terreno (GS)', ayuda: 'Sale del triángulo de viento.', u: 'kt', v: 105 },
        { id: 'tiempoMin', label: 'Tiempo', ayuda: 'Déjalo vacío para calcularlo.', u: 'min', v: '' },
        { id: 'consumoHora', label: 'Consumo por hora (opcional)', ayuda: 'Del POH, en la unidad que uses (gal/h, L/h o lb/h).', u: '/h', v: 8.5 },
      ],
      calcular(d) {
        const r = C.tiempoDistancia(d);
        if (r.error) return `<div class="error">${r.error}</div>`;
        return `<div class="big">${dato('Distancia', f1(r.distancia), 'NM')}${dato('GS', f0(r.gs), 'kt')}${dato('Tiempo', hm(r.tiempoMin))}${r.combustible != null ? dato('Combustible del tramo', f1(r.combustible)) : ''}</div>
          ${r.combustible != null ? `<div class="aviso">Esto es solo el combustible del tramo. Súmale rodaje, ascenso, alterno y la reserva que exija tu normativa y tu operador.</div>` : ''}
          <p class="formula">Tiempo = distancia ÷ GS × 60. Combustible = consumo × tiempo.</p>`;
      },
    },
    {
      id: 'altitud', titulo: 'Altitudes y TAS', resumen: 'Altitud de presión, de densidad y velocidad verdadera.',
      intro: 'Con la altitud del altímetro (o la elevación del aeropuerto), el QNH y la temperatura, calcula la altitud de presión, la de densidad y, si das la velocidad calibrada, tu TAS.',
      campos: [
        { id: 'altIndicada', label: 'Altitud indicada o elevación', ayuda: 'Para un aeropuerto, su elevación (en el PIA AD 2). Toluca ≈ 8,466 ft.', u: 'ft', v: 8466 },
        { id: 'qnhHpa', label: 'QNH', ayuda: 'Del METAR: Q1020 = 1020 hPa. Si tienes A3012 (inHg), usa Conversiones.', u: 'hPa', v: 1020 },
        { id: 'oat', label: 'Temperatura exterior (OAT)', ayuda: 'Del METAR: 20/08 → 20 °C.', u: '°C', v: 20 },
        { id: 'cas', label: 'Velocidad calibrada (CAS, opcional)', ayuda: 'Para calcular la TAS.', u: 'kt', v: 100 },
      ],
      calcular(d) {
        const r = C.altitudes(d);
        const alta = r.da - d.altIndicada;
        return `<div class="big">${dato('Altitud de presión', f0(r.pa), 'ft')}${dato('Altitud de densidad', f0(r.da), 'ft')}${dato('ISA a esa altitud', f1(r.isa), '°C')}${r.tas != null ? dato('TAS', f0(r.tas), 'kt') : ''}</div>
          <p class="explica">Hace ${f1(Math.abs(r.desvioIsa))} °C ${r.desvioIsa >= 0 ? 'más' : 'menos'} calor que en la atmósfera estándar. El avión rinde como si estuviera a <b>${f0(r.da)} ft</b>${alta > 1000 ? ` — ${f0(alta)} ft más alto de lo que marca el altímetro: despegue más largo y ascenso más lento.` : '.'}</p>
          ${alta > 2000 ? '<div class="aviso">Altitud de densidad alta: revisa las tablas de despegue y ascenso del POH con este valor.</div>' : ''}
          <p class="formula">PA exacta por atmósfera estándar OACI. DA ≈ PA + 120·(OAT − ISA) (regla del PHAK). TAS = CAS ÷ √(densidad relativa), sin compresibilidad (válida debajo de ~250 kt).</p>`;
      },
    },
    {
      id: 'pista', titulo: 'Viento cruzado', resumen: 'Componentes cruzado y de frente para tu pista.',
      intro: 'Con el número de pista y el viento del METAR o de la torre, calcula cuánto viento te llega de lado y de frente (o de cola).',
      campos: [
        { id: 'pista', label: 'Pista', ayuda: 'El número pintado: 15 = rumbo 150°. Usa el rumbo magnético, como el viento de la torre.', u: '', v: 15 },
        { id: 'rumboExacto', label: 'Rumbo exacto de la pista (opcional)', ayuda: 'De la carta de aeródromo, por ejemplo 152°. Si lo dejas vacío se usa el número × 10.', u: '°', v: '' },
        { id: 'dirViento', label: 'Viento: de dónde viene', ayuda: 'La torre lo da magnético; el METAR, verdadero. Para la práctica la diferencia es pequeña.', u: '°', v: 200 },
        { id: 'velViento', label: 'Viento: velocidad', u: 'kt', v: 15 },
        { id: 'rafaga', label: 'Ráfaga (opcional)', ayuda: 'METAR 20015G25KT → 25.', u: 'kt', v: '' },
        { id: 'maxCruzado', label: 'Máximo demostrado de tu avión (opcional)', ayuda: 'Del POH. Cessna 172S: 15 kt.', u: 'kt', v: 15 },
        { id: 'tasFinal', label: 'Velocidad en final, TAS (opcional)', ayuda: 'Para el rumbo a volar. Al nivel del mar TAS ≈ IAS; en aeropuertos altos es mayor (Toluca: IAS 65 → TAS ≈ 75). Usa "Altitudes y TAS".', u: 'kt', v: 70 },
      ],
      calcular(d) {
        const r = C.componentesViento(d);
        const peor = r.rafaga ? Math.abs(r.rafaga.cruzado) : r.cruzado;
        let txt = `<div class="big">${dato('Viento cruzado', f0(r.cruzado), 'kt')}${dato('Viene de la', r.lado)}${dato(r.frente >= 0 ? 'De frente' : 'De cola', f0(Math.abs(r.frente)), 'kt')}${r.rafaga ? dato('Cruzado con ráfaga', f0(Math.abs(r.rafaga.cruzado)), 'kt') : ''}</div>`;
        if (r.frente < -0.5) txt += '<div class="aviso">Viento de cola: aumenta mucho la distancia de despegue y aterrizaje. Considera la pista opuesta.</div>';
        if (d.maxCruzado && peor > d.maxCruzado) txt += `<div class="aviso">El cruzado (${f0(peor)} kt) pasa el máximo demostrado de tu avión (${f0(d.maxCruzado)} kt).</div>`;
        // Rumbo a volar en final (corrección por deriva)
        if (r.errorFinal) txt += `<div class="error">${r.errorFinal}</div>`;
        else if (r.rumboFinal != null) {
          const hacia = r.wcaFinal >= 0 ? 'derecha' : 'izquierda';
          txt += `<h2 style="margin-top:18px">Rumbo a volar en final</h2>
            <div class="big">${dato('Rumbo corregido', rumbo(r.rumboFinal))}${dato('Corrección', f1(Math.abs(r.wcaFinal)) + '°', hacia === 'derecha' ? 'der.' : 'izq.')}${dato('GS en final', f0(r.gsFinal), 'kt')}${dato('Régimen para 3°', f0(r.rod3), 'ft/min')}</div>
            <p class="explica">En la aproximación final mantén rumbo <b>${rumbo(r.rumboFinal)}</b> (nariz ${f1(Math.abs(r.wcaFinal))}° a la ${hacia}, hacia el viento) para seguir el eje de la pista ${rumbo(r.rumboPista)}. Es lo que haría el piloto automático en modo de rumbo o lo que te pediría el director de vuelo.</p>
            <div class="aviso">En el toque el avión debe quedar alineado con la pista: antes de tocar quita la corrección (técnica de "cangrejo" y alineado en el enderezamiento) o vuela con ala baja hacia el viento y pedal contrario. Usa la técnica de tu POH y tu instructor.</div>`;
        }
        return txt + dibujoPista(r, d) + `<p class="formula">Cruzado = V·sen(ángulo), de frente = V·cos(ángulo). Rumbo a volar = pista ± asen(cruzado ÷ TAS en final). GS en final = TAS·cos(corrección) − viento de frente. Régimen 3° ≈ GS × 5.3. Regla de cabeza: 30° → ½ del viento, 45° → ¾, 60° o más → todo.</p>`;
      },
    },
    {
      id: 'perfil', titulo: 'Ascenso y descenso (TOC / TOD)', resumen: 'Dónde terminas de subir y dónde empezar a bajar.',
      intro: 'Calcula a cuántas millas y minutos alcanzas tu altitud de crucero (TOC) y a cuántas millas antes del destino debes empezar a descender (TOD).',
      campos: [
        { id: 'elevOrigen', label: 'Elevación de origen', u: 'ft', v: 8466 },
        { id: 'crucero', label: 'Altitud de crucero', u: 'ft', v: 12500 },
        { id: 'elevDestino', label: 'Altitud a la que quieres llegar', ayuda: 'Altitud de circuito o de entrada, no la elevación de la pista.', u: 'ft', v: 1000 },
        { id: 'roc', label: 'Régimen de ascenso', ayuda: 'Del POH a esa altitud y temperatura (en altura es mucho menor).', u: 'ft/min', v: 500 },
        { id: 'gsAscenso', label: 'GS en el ascenso', u: 'kt', v: 80 },
        { id: 'rod', label: 'Régimen de descenso', u: 'ft/min', v: 500 },
        { id: 'gsDescenso', label: 'GS en el descenso', u: 'kt', v: 120 },
      ],
      calcular(d) {
        const r = C.perfil(d);
        if (r.error) return `<div class="error">${r.error}</div>`;
        return `<div class="big">${dato('TOC: tiempo', hm(r.tocMin))}${dato('TOC: distancia', f1(r.tocNM), 'NM')}${dato('TOD: tiempo', hm(r.todMin))}${dato('TOD: distancia', f1(r.todNM), 'NM')}</div>
          <p class="explica">Empieza a bajar <b>${f1(r.todNM)} NM</b> antes del punto de llegada. Con una trayectoria de 3° serían ${f1(r.tod3gradosNM)} NM.</p>
          ${dibujoPerfil(d, r)}
          <p class="formula">Tiempo = diferencia de altitud ÷ régimen; distancia = GS × tiempo ÷ 60. 3° ≈ 318 ft por NM.</p>`;
      },
    },
    {
      id: 'gradiente', titulo: 'Gradiente ↔ régimen', resumen: 'ft/NM, % y ft/min para salidas y aproximaciones.',
      intro: 'Las cartas de salida piden un gradiente (ft/NM o %); tu variómetro marca ft/min. Convierte entre ellos con tu velocidad sobre el terreno.',
      campos: [
        { id: 'modo', label: 'Tengo', tipo: 'seg', opciones: [['ftnm', 'ft/NM'], ['pct', '%'], ['fpm', 'ft/min']], v: 'ftnm' },
        { id: 'valor', label: 'Valor', ayuda: 'Ejemplo: una SID que pide 400 ft/NM, o 3.3 %.', u: '', v: 400 },
        { id: 'gs', label: 'Velocidad sobre el terreno (GS)', u: 'kt', v: 100 },
      ],
      calcular(d) {
        let g; // ft/NM
        if (d.modo === 'ftnm') g = d.valor; else if (d.modo === 'pct') g = C.porcientoAFtNm(d.valor); else g = C.regimenAGradiente(d.valor, d.gs);
        const fpm = C.gradienteARegimen(g, d.gs);
        return `<div class="big">${dato('Gradiente', f0(g), 'ft/NM')}${dato('Gradiente', f1(C.ftNmAPorciento(g)), '%')}${dato('Régimen', f0(fpm), 'ft/min')}${dato('Ángulo', f1(C.ftNmAGrados(g)), '°')}</div>
          <p class="explica">A ${f0(d.gs)} kt necesitas <b>${f0(fpm)} ft/min</b> para mantener ${f0(g)} ft/NM.</p>
          <p class="formula">ft/min = ft/NM × GS ÷ 60. 1 % = 60.76 ft/NM.</p>`;
      },
    },
    {
      id: 'arco', titulo: 'Arcos DME', resumen: 'Dónde virar para entrar al arco y para salir al radial final.',
      intro: 'Un arco DME es volar alrededor de una estación VOR/DME a una distancia fija. Ya se usa menos (hoy casi todo es RNAV), pero sigue en cartas de México y en los exámenes. Calcula dónde empezar cada viraje, qué rumbos volar y cuánto dura el arco.',
      campos: [
        { id: 'dme', label: 'Distancia del arco', ayuda: 'La de la carta, por ejemplo "ARC 10 DME".', u: 'NM', v: 10 },
        { id: 'radialEntrada', label: 'Radial por el que llegas al arco', ayuda: 'El radial que vuelas antes de entrar al arco.', u: '°', v: 90 },
        { id: 'tramoEntrada', label: 'Sobre ese radial vas', tipo: 'seg', opciones: [['alejandose', 'Alejándote'], ['acercandose', 'Acercándote']], v: 'alejandose' },
        { id: 'sentido', label: 'Recorres el arco en sentido', tipo: 'seg', opciones: [['horario', 'Horario (radiales suben)'], ['antihorario', 'Antihorario (bajan)']], v: 'horario' },
        { id: 'radialSalida', label: 'Radial final', ayuda: 'El que interceptas al terminar el arco (por ejemplo el curso de aproximación final).', u: '°', v: 180 },
        { id: 'tramoSalida', label: 'Sobre el radial final vas a ir', tipo: 'seg', opciones: [['acercandose', 'Hacia la estación'], ['alejandose', 'Alejándote']], v: 'acercandose' },
        { id: 'gs', label: 'Velocidad sobre el terreno (GS)', u: 'kt', v: 120 },
        { id: 'giro', label: 'Tipo de viraje', tipo: 'seg', opciones: [['estandar', 'Estándar (3°/s)'], ['medio', '½ estándar']], v: 'estandar' },
      ],
      calcular(d) {
        const r = C.arcoDME(d);
        if (r.error) return `<div class="error">${r.error}</div>`;
        const lado = (g) => (g >= 0 ? 'derecha' : 'izquierda');
        const rad = (x) => 'R-' + String(Math.round(C.norm360(x)) % 360).padStart(3, '0');
        return `<div class="big">${dato('Virar a', f1(r.dmeInicioViraje), 'DME')}${dato('Rumbo en el arco', rumbo(r.rumboArco))}${dato('Virar al final en', rad(r.radialInicioViraje2))}${dato('Curso final', rumbo(r.cursoFinal))}</div>
          <ol class="pasos">
            <li><b>Entrada.</b> Volando ${d.tramoEntrada === 'alejandose' ? 'alejándote' : 'acercándote'} por el ${rad(d.radialEntrada)} (rumbo ${rumbo(r.rumboActual)}), al llegar a <b>${f1(r.dmeInicioViraje)} DME</b> vira a la <b>${lado(r.viraje1)}</b> a rumbo <b>${rumbo(r.rumboArco)}</b>. Anticipas ${f1(r.radio)} NM, que es tu radio de viraje.</li>
            <li><b>Sobre el arco.</b> Mantén la aguja del RMI o del indicador de marcación en la punta del ala ${d.sentido === 'horario' ? 'derecha' : 'izquierda'} (la estación queda de ese lado). Cuando se atrase unos 10° detrás del ala, vira unos 10° hacia la estación y repite. Si el DME aumenta, corrige hacia la estación; si disminuye, aléjate un poco. En esta distancia, cada NM sobre el arco son <b>${f1(r.radialesPorNM)} radiales</b>.</li>
            <li><b>Salida.</b> Selecciona curso <b>${rumbo(r.cursoFinal)}</b> en el CDI. Al pasar el <b>${rad(r.radialInicioViraje2)}</b> (${f1(r.anticipacion)}° antes del ${rad(d.radialSalida)}) vira a la <b>${lado(r.viraje2)}</b> para quedar ${d.tramoSalida === 'acercandose' ? 'hacia la estación' : 'alejándote'} en curso ${rumbo(r.cursoFinal)}.</li>
          </ol>
          <div class="big">${dato('Largo del arco', f1(r.largoNM), 'NM')}${dato('Tiempo en el arco', hm(r.minutos))}${dato('Radio de viraje', f1(r.radio), 'NM')}${dato('Inclinación', f0(r.bank) + '°')}</div>
          ${r.limitado ? '<div class="aviso">A esta velocidad el viraje estándar pediría más de 25° de inclinación: se calculó con 25°, por eso el radio es mayor.</div>' : ''}
          ${r.arcoCorto ? '<div class="aviso">El arco es muy corto: casi no hay tramo recto entre los dos virajes.</div>' : ''}
          ${dibujoArco(d, r)}
          <div class="aviso">Con viento, la aguja no queda exactamente en el ala: queda adelante o atrás por la corrección de deriva. Si la carta publica un radial de anticipación (lead radial), usa el de la carta.</div>
          <p class="formula">Radio de viraje estándar ≈ GS ÷ 190 (a 120 kt ≈ 0.6 NM). Entrada: arco − radio (alejándote) o arco + radio (acercándote). Radiales de anticipación = radio × 60 ÷ DME. Largo = π × DME × grados ÷ 180. Fuente: FAA Instrument Flying Handbook (FAA-H-8083-15B), arcos DME. [USA-FAA]</p>`;
      },
    },
    {
      id: 'conv', titulo: 'Conversiones', resumen: 'kt, km/h, ft, m, °C, hPa, inHg, lb, kg, gal, L.',
      intro: 'Escribe un valor y elige qué convertir.',
      campos: [
        { id: 'tipo', label: 'Convertir', tipo: 'select', opciones: [
          ['kt_kmh', 'nudos → km/h'], ['kmh_kt', 'km/h → nudos'], ['kt_mph', 'nudos → mph'],
          ['ft_m', 'pies → metros'], ['m_ft', 'metros → pies'], ['nm_km', 'NM → km'], ['km_nm', 'km → NM'], ['nm_sm', 'NM → millas terrestres'],
          ['c_f', '°C → °F'], ['f_c', '°F → °C'], ['hpa_inhg', 'hPa → inHg'], ['inhg_hpa', 'inHg → hPa'],
          ['lb_kg', 'lb → kg'], ['kg_lb', 'kg → lb'], ['usgal_l', 'galones (EUA) → litros'], ['l_usgal', 'litros → galones (EUA)'],
          ['avgas_lb', 'galones AVGAS → lb (6 lb/gal)'], ['jeta_lb', 'galones JET A → lb (6.7 lb/gal)']], v: 'kt_kmh' },
        { id: 'valor', label: 'Valor', u: '', v: 100 },
      ],
      calcular(d) {
        const r = C.conv[d.tipo](d.valor);
        const dec = Math.abs(r) < 100 ? 2 : 1;
        return `<div class="big">${dato('Resultado', r.toLocaleString('es-MX', { maximumFractionDigits: dec }))}</div>
          ${d.tipo === 'avgas_lb' || d.tipo === 'jeta_lb' ?'<div class="aviso">El peso por galón cambia con la temperatura; para peso y balance usa el valor de tu POH.</div>' : ''}`;
      },
    },
  ];

  /* ---------- Dibujos (SVG) ---------- */
  function dibujoViento(d, r) {
    // Vectores: aire (TAS en el rumbo verdadero), viento, y suelo (GS en el curso). Norte arriba.
    // 1) vectores en unidades reales (nudos); 2) se escalan y centran para que quepan en el dibujo
    const v = (ang, len) => [Math.sin(ang * Math.PI / 180) * len, -Math.cos(ang * Math.PI / 180) * len];
    const a = v(r.th, d.tas), w = v(d.dirViento + 180, d.velViento);   // el viento SOPLA hacia dirViento+180
    const pts = [[0, 0], a, [a[0] + w[0], a[1] + w[1]]];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const ancho = Math.max(...xs) - Math.min(...xs) || 1, alto = Math.max(...ys) - Math.min(...ys) || 1;
    const k = Math.min(240 / ancho, 200 / alto);                 // escala para caber en 240 × 200
    const H = Math.max(120, alto * k + 70);                       // alto del dibujo según la forma del triángulo
    const ox = 150 - ((Math.max(...xs) + Math.min(...xs)) / 2) * k, oy = H / 2 + 8 - ((Math.max(...ys) + Math.min(...ys)) / 2) * k;
    const [P0, P1, P2] = pts.map((p) => [ox + p[0] * k, oy + p[1] * k]);
    const cen = [(P0[0] + P1[0] + P2[0]) / 3, (P0[1] + P1[1] + P2[1]) / 3];   // centro del triángulo
    // etiqueta en la mitad de cada lado, empujada hacia afuera del triángulo
    const fl = (p, q, col, lab) => {
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], dx = m[0] - cen[0], dy = m[1] - cen[1], n = Math.hypot(dx, dy) || 1;
      return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${col}" stroke-width="3" marker-end="url(#m${col.replace('#', '')})"/><text x="${m[0] + dx / n * 16}" y="${m[1] + dy / n * 16 + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="${col}">${lab}</text>`;
    };
    const mk = (col) => `<marker id="m${col.replace('#', '')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker>`;
    return `<svg class="dib" viewBox="0 0 300 ${H}" role="img" aria-label="Triángulo de viento: rumbo, viento y trayectoria sobre el terreno">
      <defs>${mk('#3b82f6')}${mk('#d97706')}${mk('#16a34a')}</defs>
      <text x="150" y="16" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6">N ↑</text>
      ${fl(P0, P1, '#3b82f6', 'Rumbo/TAS')}${fl(P1, P2, '#d97706', 'Viento')}${fl(P0, P2, '#16a34a', 'Curso/GS')}
    </svg>`;
  }
  function dibujoPista(r) {
    // Pista vertical; flecha del viento llegando desde su ángulo relativo
    const ang = r.angulo, L = 90, cx = 150, cy = 150;
    const x0 = cx + Math.sin(ang * Math.PI / 180) * L * 1.4, y0 = cy - Math.cos(ang * Math.PI / 180) * L * 1.4;
    // Si hay rumbo a volar: un avión en final, girado el ángulo de corrección (nariz hacia el viento)
    const avion = r.rumboFinal != null ? `
      <line x1="150" y1="262" x2="150" y2="350" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 5" opacity=".45"/>
      <g transform="translate(150 318) rotate(${r.wcaFinal})">
        <path d="M0 -16 L3 -6 L18 1 L18 5 L3 2 L2 11 L7 15 L7 17 L0 15 L-7 17 L-7 15 L-2 11 L-3 2 L-18 5 L-18 1 L-3 -6 Z" fill="#3b82f6"/>
        <line x1="0" y1="-18" x2="0" y2="-40" stroke="#3b82f6" stroke-width="2" stroke-dasharray="3 3"/>
      </g>
      <text x="${r.wcaFinal >= 0 ? 112 : 188}" y="322" text-anchor="middle" font-size="12" font-weight="700" fill="#3b82f6">${String(Math.round(C.norm360(r.rumboFinal)) % 360).padStart(3, '0')}°</text>` : '';
    return `<svg class="dib" viewBox="0 0 300 ${r.rumboFinal != null ? 360 : 300}" role="img" aria-label="Pista, dirección del viento y rumbo a volar en final">
      <defs><marker id="mv" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#d97706"/></marker></defs>
      <rect x="135" y="40" width="30" height="220" rx="3" fill="#56627a" opacity=".85"/>
      <line x1="150" y1="60" x2="150" y2="240" stroke="#fff" stroke-width="2" stroke-dasharray="10 10"/>
      <text x="150" y="252" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${String(Math.round(r.rumboPista / 10) || 36).padStart(2, '0')}</text>
      <text x="150" y="32" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">sentido de aterrizaje ↑</text>
      <line x1="${x0}" y1="${y0}" x2="${cx + (x0 - cx) * 0.25}" y2="${cy + (y0 - cy) * 0.25}" stroke="#d97706" stroke-width="4" marker-end="url(#mv)"/>
      <text x="${x0}" y="${y0 + (y0 < cy ? -6 : 14)}" text-anchor="middle" font-size="11" font-weight="600" fill="#d97706">viento</text>${avion}
    </svg>`;
  }
  function dibujoArco(d, r) {
    // Estación al centro, norte arriba. El arco mide 95 px de radio; todo se escala con eso.
    const cx = 160, cy = 160, k = 95 / d.dme;
    const horario = d.sentido === 'horario';
    // punto a cierta distancia (NM) sobre un radial (grados): x = sen, y = −cos (norte arriba)
    const P = (radial, nm) => [cx + Math.sin(radial * Math.PI / 180) * nm * k, cy - Math.cos(radial * Math.PI / 180) * nm * k];
    const p = (q) => q.map((n) => n.toFixed(1)).join(' ');
    const D = d.dme, rr = r.radio, signo = horario ? 1 : -1;
    // 1) tramo de entrada sobre el radial y viraje (curva) hasta quedar sobre el arco
    const ini = d.tramoEntrada === 'alejandose' ? P(d.radialEntrada, D * 0.2) : P(d.radialEntrada, D * 1.55);
    const vir1 = P(d.radialEntrada, r.dmeInicioViraje);
    const th1 = d.radialEntrada + signo * (rr / D) * 180 / Math.PI;   // radial donde termina el viraje de entrada
    const enArco1 = P(th1, D);
    // 2) el arco, desde th1 hasta el radial donde empieza el viraje de salida
    const th2 = r.radialInicioViraje2;
    const recorrido = horario ? C.norm360(th2 - th1) : C.norm360(th1 - th2);
    const enArco2 = P(th2, D);
    // 3) viraje de salida y tramo final sobre el radial
    const finVir2 = P(d.radialSalida, d.tramoSalida === 'acercandose' ? D - rr : D + rr);
    const fin = d.tramoSalida === 'acercandose' ? P(d.radialSalida, D * 0.2) : P(d.radialSalida, D * 1.55);
    const ruta = `M${p(ini)} L${p(vir1)} Q${p(P(d.radialEntrada, D))} ${p(enArco1)} A${(D * k).toFixed(1)} ${(D * k).toFixed(1)} 0 ${recorrido > 180 ? 1 : 0} ${horario ? 1 : 0} ${p(enArco2)} Q${p(P(d.radialSalida, D))} ${p(finVir2)} L${p(fin)}`;
    const etiqueta = (radial, txt) => { const q = P(radial, D * 1.42); return `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" style="paint-order:stroke;stroke:var(--card);stroke-width:4px">${txt}</text>`; };
    const R3 = (x) => 'R-' + String(Math.round(C.norm360(x)) % 360).padStart(3, '0');
    return `<svg class="dib" viewBox="0 0 320 348" role="img" aria-label="Dibujo del arco DME con los puntos de viraje">
      <defs><marker id="mArc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3b82f6"/></marker></defs>
      <text x="160" y="14" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">N ↑</text>
      <circle cx="${cx}" cy="${cy}" r="${(D * k).toFixed(1)}" fill="none" stroke="currentColor" stroke-dasharray="3 5" opacity=".3"/>
      <line x1="${cx}" y1="${cy}" x2="${p(P(d.radialEntrada, D * 1.6)).split(' ')[0]}" y2="${p(P(d.radialEntrada, D * 1.6)).split(' ')[1]}" stroke="currentColor" opacity=".35"/>
      <line x1="${cx}" y1="${cy}" x2="${p(P(d.radialSalida, D * 1.6)).split(' ')[0]}" y2="${p(P(d.radialSalida, D * 1.6)).split(' ')[1]}" stroke="currentColor" opacity=".35"/>
      ${etiqueta(d.radialEntrada, R3(d.radialEntrada))}${etiqueta(d.radialSalida, R3(d.radialSalida))}
      <path d="${ruta}" fill="none" stroke="#3b82f6" stroke-width="3" marker-end="url(#mArc)"/>
      <circle cx="${vir1[0].toFixed(1)}" cy="${vir1[1].toFixed(1)}" r="5" fill="#d97706"/>
      <circle cx="${enArco2[0].toFixed(1)}" cy="${enArco2[1].toFixed(1)}" r="5" fill="#16a34a"/>
      <rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="2" fill="currentColor"/>
      <text x="${cx - 10}" y="${cy - 10}" text-anchor="end" font-size="10" fill="currentColor" opacity=".75" style="paint-order:stroke;stroke:var(--card);stroke-width:3px">VOR/DME</text>
      <g font-size="12"><circle cx="16" cy="334" r="5" fill="#d97706"/><text x="26" y="338" fill="currentColor">virar a ${f1(r.dmeInicioViraje)} DME</text>
      <circle cx="176" cy="334" r="5" fill="#16a34a"/><text x="186" y="338" fill="currentColor">virar en ${R3(th2)}</text></g>
    </svg>`;
  }
  function dibujoPerfil(d, r) {
    const W = 300, H = 150, total = r.tocNM + r.todNM + Math.max(10, (r.tocNM + r.todNM) * 0.4);
    const x = (nm) => 15 + (nm / total) * (W - 30), maxA = d.crucero, y = (a) => H - 20 - (a / maxA) * (H - 45);
    const xa = x(r.tocNM), xb = x(total - r.todNM);
    return `<svg class="dib" viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil vertical del vuelo">
      <polyline fill="none" stroke="#3b82f6" stroke-width="3" points="${x(0)},${y(d.elevOrigen)} ${xa},${y(d.crucero)} ${xb},${y(d.crucero)} ${x(total)},${y(d.elevDestino)}"/>
      <circle cx="${xa}" cy="${y(d.crucero)}" r="4" fill="#16a34a"/><text x="${xa}" y="${y(d.crucero) - 8}" font-size="11" text-anchor="middle" fill="currentColor">TOC ${f1(r.tocNM)} NM</text>
      <circle cx="${xb}" cy="${y(d.crucero)}" r="4" fill="#d97706"/><text x="${xb}" y="${y(d.crucero) - 8}" font-size="11" text-anchor="middle" fill="currentColor">TOD −${f1(r.todNM)} NM</text>
      <line x1="10" y1="${H - 20}" x2="${W - 10}" y2="${H - 20}" stroke="currentColor" opacity=".3"/>
    </svg>`;
  }

  /* ---------- 2. Guardar y leer los últimos datos (solo en tu dispositivo) ---------- */
  const guardar = (id, datos) => { try { localStorage.setItem('air_' + id, JSON.stringify(datos)); } catch (e) { /* sin almacenamiento: no pasa nada */ } };
  const leer = (id) => { try { return JSON.parse(localStorage.getItem('air_' + id) || 'null'); } catch (e) { return null; } };

  /* ---------- 3. Pantallas ---------- */
  function inicio() {
    $('#btnBack').hidden = true;
    const tiles = HERRAMIENTAS.map((h) => `<a class="tile" href="#/${h.id}"><span class="ico">${ICO[h.id]}</span><span><h2>${h.titulo}</h2><p>${h.resumen}</p></span></a>`).join('')
      + `<a class="tile" href="esperas.html"><span class="ico">${ICO.espera}</span><span><h2>Esperas y acrónimos</h2><p>Entrada directa, gota o paralela, práctica y acrónimos de cabina.</p></span></a>`;
    // Guías de estudio (guias.js): no calculan, explican, y la del plan de vuelo arma el mensaje
    const guias = Object.entries(window.AIrGuias || {}).map(([id, g]) => `<a class="tile" href="#/${id}"><span class="ico">${ICO[id]}</span><span><h2>${g.titulo}</h2><p>${g.resumen}</p></span></a>`).join('');
    return `<section class="hola"><h1>Herramientas de vuelo</h1><p>Calcula paso a paso. Funcionan sin internet una vez abiertas.</p></section><div class="grid">${tiles}</div>
      ${guias ? `<section class="hola" style="margin-top:26px"><h1>Guías de estudio</h1><p>Explicadas claro, con fuentes OACI, AFAC y FAA.</p></section><div class="grid">${guias}</div>` : ''}`;
  }

  function pantalla(h) {
    $('#btnBack').hidden = false;
    const guardados = leer(h.id) || {};
    const campo = (c) => {
      const val = guardados[c.id] !== undefined ? guardados[c.id] : c.v;
      if (c.tipo === 'seg') {
        return `<div class="campo"><label>${c.label}</label><div class="seg" data-id="${c.id}">${c.opciones.map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${k === val}">${t}</button>`).join('')}</div></div>`;
      }
      if (c.tipo === 'select') {
        return `<div class="campo"><label for="${c.id}">${c.label}</label><select id="${c.id}" data-id="${c.id}">${c.opciones.map(([k, t]) => `<option value="${k}"${k === val ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
      }
      return `<div class="campo"><label for="${c.id}">${c.label}</label><div class="fila"><input id="${c.id}" data-id="${c.id}" type="text" inputmode="decimal" autocomplete="off" value="${val}">${c.u ? `<span class="u">${c.u}</span>` : ''}</div>${c.ayuda ? `<div class="ayuda">${c.ayuda}</div>` : ''}</div>`;
    };
    return `<section class="calc"><h1>${h.titulo}</h1><p class="intro">${h.intro}</p>
      <div class="cols"><form class="card" id="form" onsubmit="return false">${h.campos.map(campo).join('')}</form>
      <div class="card res" aria-live="polite"><h2>Resultado</h2><div id="salida"></div></div></div></section>`;
  }

  function leerDatos(h) {
    const d = {};
    for (const c of h.campos) {
      if (c.tipo === 'seg') { d[c.id] = $(`.seg[data-id="${c.id}"] [aria-pressed="true"]`).dataset.v; continue; }
      const el = $(`[data-id="${c.id}"]`);
      if (c.tipo === 'select') { d[c.id] = el.value; continue; }
      const txt = el.value.trim().replace(',', '.');
      d[c.id] = txt === '' ? undefined : Number(txt);
    }
    return d;
  }

  function recalcular(h) {
    const d = leerDatos(h);
    // Campos numéricos obligatorios: todos menos los "opcional" y el tiempo de la herramienta de tiempo
    const faltan = h.campos.filter((c) => !c.tipo && !/opcional/i.test(c.label) && !(h.id === 'tiempo') && (d[c.id] === undefined || isNaN(d[c.id])));
    const malos = h.campos.filter((c) => !c.tipo && d[c.id] !== undefined && isNaN(d[c.id]));
    guardar(h.id, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === undefined ? '' : v])));
    if (malos.length) { $('#salida').innerHTML = `<div class="error">Revisa "${malos[0].label}": escribe solo números.</div>`; return; }
    if (faltan.length) { $('#salida').innerHTML = `<div class="error">Falta: ${faltan.map((c) => c.label).join(', ')}.</div>`; return; }
    try { $('#salida').innerHTML = h.calcular(d); } catch (e) { $('#salida').innerHTML = `<div class="error">No se pudo calcular con esos datos.</div>`; }
  }

  function mostrar() {
    const id = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
    const h = HERRAMIENTAS.find((x) => x.id === id);
    const vista = $('#vista');
    const guia = window.AIrGuias && window.AIrGuias[id];
    if (guia) {
      // Pantalla de guía: la dibuja guias.js y conecta sus propios botones
      $('#btnBack').hidden = false;
      vista.innerHTML = guia.render();
      document.title = guia.titulo + ' · AIrborne Academy';
      guia.activar();
      vista.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      return;
    }
    if (!h) { vista.innerHTML = inicio(); document.title = 'AIrborne Academy · Herramientas'; return; }
    vista.innerHTML = pantalla(h);
    document.title = h.titulo + ' · AIrborne Academy';
    $('#form').addEventListener('input', () => recalcular(h));
    $('#form').addEventListener('change', () => recalcular(h));
    vista.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      s.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      recalcular(h);
    }));
    recalcular(h);
    vista.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', mostrar);
  mostrar();

  /* ---------- 4. Instalar la app y modo sin internet ---------- */
  let aviso;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; $('#btnInstall').hidden = false; });
  $('#btnInstall').addEventListener('click', async () => { if (!aviso) return; aviso.prompt(); await aviso.userChoice; aviso = null; $('#btnInstall').hidden = true; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
