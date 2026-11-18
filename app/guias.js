/*
 * guias.js — Guías de estudio de la app (no son calculadoras):
 *   - #/pbn  : qué es PBN, RNAV, RNP, VNAV, LNAV, LPV… explicado paso a paso.
 *   - #/plan : el plan de vuelo OACI casilla por casilla, con ejemplos y un armador
 *              que escribe el mensaje FPL y revisa errores (la lógica está en fpl.js).
 * app.js llama a window.AIrGuias[id].render() y luego a .activar() para conectar botones.
 */
(function () {
  const F = window.AIrFPL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ===================== GUÍA PBN ===================== */
  // Dibujo 1: navegación convencional (de VOR a VOR) contra RNAV (directo entre puntos)
  const dibRuta = `<svg class="dib" viewBox="0 0 320 170" role="img" aria-label="Ruta convencional de VOR a VOR comparada con ruta RNAV entre waypoints">
    <g font-size="11" fill="currentColor">
      <text x="20" y="18" font-weight="700">Convencional</text><text x="180" y="18" font-weight="700">RNAV</text>
      <!-- convencional: zigzag entre estaciones -->
      <polyline points="25,150 70,60 120,130 140,40" fill="none" stroke="#d97706" stroke-width="3"/>
      <g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="64" y="54" width="12" height="12"/><rect x="114" y="124" width="12" height="12"/></g>
      <text x="80" y="58">VOR</text><text x="70" y="150">VOR</text>
      <circle cx="25" cy="150" r="4"/><circle cx="140" cy="40" r="4"/>
      <!-- RNAV: línea más directa con waypoints -->
      <polyline points="185,150 230,100 300,40" fill="none" stroke="#3b82f6" stroke-width="3"/>
      <g fill="#3b82f6"><path d="M230 93l7 7-7 7-7-7z"/></g>
      <text x="240" y="112">waypoint</text>
      <circle cx="185" cy="150" r="4"/><circle cx="300" cy="40" r="4"/>
    </g></svg>`;
  // Dibujo 2: el "corredor" de RNAV 1 / RNP 1 (±1 NM el 95 % del tiempo)
  const dibCorredor = `<svg class="dib" viewBox="0 0 320 120" role="img" aria-label="Corredor de más o menos 1 NM alrededor de la ruta">
    <rect x="10" y="35" width="300" height="50" fill="#3b82f6" opacity=".12"/>
    <line x1="10" y1="60" x2="310" y2="60" stroke="#3b82f6" stroke-width="3"/>
    <line x1="10" y1="35" x2="310" y2="35" stroke="#3b82f6" stroke-dasharray="5 5"/><line x1="10" y1="85" x2="310" y2="85" stroke="#3b82f6" stroke-dasharray="5 5"/>
    <path d="M150 58 q20 -10 40 -6 t40 8" fill="none" stroke="#d97706" stroke-width="2"/>
    <g font-size="11" fill="currentColor"><text x="14" y="28">+1 NM</text><text x="14" y="102">−1 NM</text><text x="200" y="48" fill="#d97706">tu trayectoria real</text><text x="20" y="56">ruta</text></g></svg>`;

  const pbn = {
    titulo: 'PBN, RNAV, RNP y VNAV',
    resumen: 'Qué son, en qué se diferencian y cómo se ven en la carta y en el plan de vuelo.',
    render() {
      return `<article class="guia">
      <h1>PBN, RNAV, RNP y VNAV, explicado sin rodeos</h1>
      <p class="intro">Si alguna vez te perdiste entre siglas de navegación, empieza aquí. Al final hay preguntas de repaso.</p>

      <h2>1. La idea en una frase</h2>
      <p>Antes se volaba de estación en estación (VOR, NDB): la ruta dependía de dónde estaban las antenas en tierra. Con <b>navegación de área (RNAV)</b> el avión calcula su posición (con GPS, DME o inercial) y vuela entre <b>puntos de recorrido (waypoints)</b> definidos por coordenadas, estén o no sobre una estación. La <b>PBN</b> no dice qué aparato llevar: dice <b>qué tan preciso y confiable</b> debe ser tu sistema para volar cada ruta o procedimiento.</p>
      ${dibRuta}

      <h2>2. Qué es PBN, según la OACI</h2>
      <blockquote>Navegación de área basada en requisitos de performance que se aplican a las aeronaves que realizan operaciones en una ruta ATS, en un procedimiento de aproximación por instrumentos o en un espacio aéreo designado.</blockquote>
      <p>La performance se mide en cuatro cosas:</p>
      <ul>
        <li><b>Precisión:</b> qué tan cerca de la ruta vas (el 95 % del tiempo).</li>
        <li><b>Integridad:</b> que el sistema te avise a tiempo si su posición ya no es confiable.</li>
        <li><b>Continuidad:</b> que el servicio no se corte a mitad del procedimiento.</li>
        <li><b>Funcionalidad:</b> lo que el equipo debe poder hacer (por ejemplo, volar un tramo curvo).</li>
      </ul>
      <p>El concepto PBN tiene tres piezas: la <b>especificación de navegación</b> (lo que se le pide al avión y a la tripulación), la <b>infraestructura de ayudas</b> (GNSS, DME, VOR) y la <b>aplicación</b> (la ruta, SID, STAR o aproximación donde se usa).</p>
      <p class="fuente">[OACI] Doc 9613, Manual de navegación basada en la performance (PBN). [MX-AFAC] La CO AV-040/23 usa una definición equivalente.</p>

      <h2>3. RNAV contra RNP: la diferencia que preguntan en el examen</h2>
      <p>Las dos son especificaciones PBN y las dos llevan un número: <b>la precisión lateral en millas náuticas</b> que debes mantener el 95 % del tiempo de vuelo. RNAV 1 y RNP 1 piden lo mismo: ±1 NM.</p>
      <p>La diferencia: <b>RNP exige vigilancia de la performance y alerta a bordo</b>. Tu equipo vigila su propia precisión y te avisa si ya no la cumple. En RNAV no se exige esa alerta; ahí la vigilancia la hace el control de tránsito, normalmente con radar.</p>
      ${dibCorredor}
      <p class="fuente">[OACI] Doc 9613, Vol. I.</p>

      <h2>4. Las especificaciones y dónde se usan</h2>
      <div class="tabla"><table>
        <thead><tr><th>Especificación</th><th>Precisión</th><th>Dónde se usa</th></tr></thead>
        <tbody>
          <tr><td>RNAV 10 (antes "RNP 10")</td><td>±10 NM</td><td>Oceánico y zonas remotas</td></tr>
          <tr><td>RNP 4</td><td>±4 NM</td><td>Oceánico y zonas remotas</td></tr>
          <tr><td>RNP 2</td><td>±2 NM</td><td>En ruta continental, oceánico y remoto</td></tr>
          <tr><td>RNAV 5</td><td>±5 NM</td><td>En ruta continental</td></tr>
          <tr><td>RNAV 2</td><td>±2 NM</td><td>En ruta y área terminal</td></tr>
          <tr><td>RNAV 1</td><td>±1 NM</td><td>Área terminal: SID y STAR (con radar)</td></tr>
          <tr><td>RNP 1</td><td>±1 NM</td><td>SID y STAR, también sin radar</td></tr>
          <tr><td>RNP avanzada (A-RNP)</td><td>según la fase</td><td>Todas las fases, con funciones extra (como tramos curvos RF)</td></tr>
          <tr><td>RNP APCH</td><td>±0.3 NM en final</td><td>Aproximaciones RNP: LNAV, LNAV/VNAV, LP y LPV</td></tr>
          <tr><td>RNP AR APCH</td><td>de 0.3 a 0.1 NM</td><td>Aproximaciones con autorización especial (terreno difícil)</td></tr>
          <tr><td>RNP 0.3</td><td>±0.3 NM</td><td>Helicópteros</td></tr>
        </tbody></table></div>
      <p class="fuente">[OACI] Doc 9613 (4.ª edición, 2013, y posteriores).</p>

      <h2>5. Aproximaciones RNP: LNAV, LP, LNAV/VNAV y LPV</h2>
      <p>Una carta de aproximación RNP (en cartas nuevas "RNP RWY 15"; en las anteriores "RNAV (GNSS) RWY 15") puede traer hasta cuatro líneas de mínimos. Cuál puedes volar depende de tu equipo y de tu autorización:</p>
      <div class="tabla"><table>
        <thead><tr><th>Mínimo</th><th>Guía</th><th>Qué necesitas</th><th>Se baja a</th></tr></thead>
        <tbody>
          <tr><td><b>LNAV</b></td><td>Solo lateral (2D)</td><td>GNSS</td><td>MDA</td></tr>
          <tr><td><b>LP</b></td><td>Solo lateral, más precisa (2D)</td><td>GNSS con SBAS (WAAS)</td><td>MDA</td></tr>
          <tr><td><b>LNAV/VNAV</b></td><td>Lateral y vertical (3D)</td><td>GNSS + Baro-VNAV, o SBAS</td><td>DA</td></tr>
          <tr><td><b>LPV</b></td><td>Lateral y vertical (3D), parecida a un ILS</td><td>GNSS con SBAS (WAAS)</td><td>DA</td></tr>
        </tbody></table></div>
      <p>Las que tienen guía vertical (LNAV/VNAV y LPV) son <b>APV</b>: aproximaciones con guía vertical.</p>
      <p class="fuente">[OACI] Doc 9613, Vol. II, especificación RNP APCH.</p>

      <h2>6. ¿Y VNAV?</h2>
      <p><b>VNAV es navegación vertical</b>: el equipo calcula una senda de descenso y te da guía hacia arriba o hacia abajo, como el glide slope de un ILS pero calculado.</p>
      <ul>
        <li><b>Baro-VNAV</b> usa el altímetro. Por eso depende de que el <b>QNH sea correcto</b> y de la <b>temperatura</b>: con mucho frío vas más bajo de lo que crees. Las cartas publican una temperatura mínima (o máxima) para usar los mínimos LNAV/VNAV.</li>
        <li><b>LPV</b> no usa el altímetro para la senda: la calcula con GNSS corregido por SBAS (altura geométrica). Por eso no le afecta la temperatura.</li>
        <li>En aviones con FMS, "VNAV" también es el modo que planea el descenso en ruta. Es la misma idea: el sistema calcula la trayectoria vertical.</li>
      </ul>

      <h2>7. GNSS y por qué importa la integridad</h2>
      <ul>
        <li><b>GNSS</b> es el nombre general: GPS (EUA), Galileo (Europa), GLONASS (Rusia), BeiDou (China).</li>
        <li><b>RAIM:</b> el receptor revisa que los satélites coincidan entre sí. Si no puede garantizar la posición, te avisa. Antes de una aproximación se revisa su disponibilidad.</li>
        <li><b>SBAS:</b> satélites que envían correcciones y avisos de integridad del GPS: WAAS en Norteamérica, EGNOS en Europa. Es lo que permite LP y LPV.</li>
        <li><b>GBAS:</b> una estación en tierra del aeropuerto da correcciones para aproximaciones GLS. Es otra cosa, no es una aproximación RNP.</li>
      </ul>

      <h2>8. Waypoints y tramos</h2>
      <ul>
        <li><b>Fly-by (vuela por):</b> el equipo empieza el viraje antes del punto y "corta la esquina". Es el más común.</li>
        <li><b>Fly-over (sobrevuelo):</b> debes pasar exactamente sobre el punto y luego virar. En la carta se dibuja con un círculo alrededor.</li>
        <li><b>Tipos de tramo (path terminators):</b> TF (recta de un punto a otro), DF (directo a un punto), CF (curso hacia un punto) y <b>RF</b> (arco de radio fijo, como un arco DME pero calculado). El tramo RF solo se vuela si tu equipo y tu autorización lo permiten.</li>
      </ul>

      <h2>9. En México</h2>
      <ul>
        <li>La <b>CO AV-11/09 R2</b> (17 de agosto de 2020) establece las especificaciones para implementar y autorizar operaciones PBN (RNAV y RNP).</li>
        <li>Las aproximaciones <b>RNP AR</b> requieren una aprobación específica según la <b>CO AV-46/17 R1</b>.</li>
        <li>Para volar un procedimiento PBN necesitas un equipo certificado para esa especificación, la aprobación que corresponda y el procedimiento publicado en el PIA (AIP) de México.</li>
      </ul>
      <p class="fuente">[MX-AFAC] CO AV-11/09 R2; CO AV-46/17 R1.</p>

      <h2>10. Cómo se ve en el plan de vuelo</h2>
      <p>Si tu avión está aprobado para PBN, pones <b>R</b> en la casilla 10a y tus especificaciones en la casilla 18 con <b>PBN/</b>. Por ejemplo, un avión con GPS aprobado para RNAV 2, RNAV 1 y aproximaciones RNP lleva <code>PBN/C2D2S1</code>. Si pones R, debe haber PBN/; si hay PBN/, debe haber R.</p>
      <p><a class="boton" href="#/plan">Abrir el plan de vuelo OACI →</a></p>
      <p class="fuente">[OACI] PANS-ATM, Doc 4444, Apéndice 2.</p>

      <h2>Preguntas de repaso</h2>
      ${[
        ['¿Qué diferencia a una especificación RNP de una RNAV?', 'RNP exige vigilancia de la performance y alerta a bordo; RNAV no.'],
        ['¿Qué significa el 1 de "RNAV 1"?', 'Precisión lateral de ±1 NM durante el 95 % del tiempo de vuelo.'],
        ['¿Qué mínimos de una aproximación RNP necesitan SBAS (WAAS)?', 'LP y LPV.'],
        ['¿Por qué la temperatura afecta a LNAV/VNAV y no a LPV?', 'LNAV/VNAV con Baro-VNAV usa el altímetro barométrico; LPV usa altura geométrica del GNSS corregido por SBAS.'],
        ['Pusiste R en la casilla 10a. ¿Qué más debes llenar?', 'PBN/ en la casilla 18, con los códigos de las especificaciones aprobadas (máximo 8).'],
      ].map(([p, r]) => `<details class="repaso"><summary>${p}</summary><p>${r}</p></details>`).join('')}

      <h2>Fuentes</h2>
      <ul class="fuentes">
        <li>[OACI] Doc 9613, Manual de navegación basada en la performance (PBN).</li>
        <li>[OACI] PANS-ATM, Doc 4444, Apéndice 2 (plan de vuelo).</li>
        <li>[MX-AFAC] CO AV-11/09 R2, Navegación basada en la performance (PBN), 17 de agosto de 2020.</li>
        <li>[MX-AFAC] CO AV-46/17 R1, operaciones RNP AR, 17 de agosto de 2020.</li>
        <li>[USA-FAA] Aeronautical Information Manual (AIM), capítulo 1, ayudas a la navegación.</li>
      </ul>
      </article>`;
    },
    activar() {},
  };

  /* ===================== PLAN DE VUELO OACI ===================== */
  // Cada campo del armador: casilla, id (como en fpl.js), etiqueta, ayuda
  const CAMPOS = [
    ['7', 'c7', 'Identificación de la aeronave', 'La matrícula sin guion (XB-ABC → XBABC) o el indicativo de la aerolínea más el número de vuelo (AMX123). Máximo 7.'],
    ['8', 'reglas', 'Reglas de vuelo', 'I = IFR, V = VFR, Y = primero IFR luego VFR, Z = primero VFR luego IFR.'],
    ['8', 'tipo', 'Tipo de vuelo', 'G = aviación general, S = regular, N = no regular, M = militar, X = otro.'],
    ['9', 'numero', 'Número de aeronaves', 'Solo si vuelan en formación más de una. Si es una, déjalo vacío.'],
    ['9', 'aeronave', 'Tipo de aeronave', 'Designador OACI (Doc 8643): C172, PA28, C208, B738. Si no tiene, ZZZZ y TYP/ en la casilla 18.'],
    ['9', 'estela', 'Estela turbulenta', 'L hasta 7,000 kg de peso máximo de despegue, M hasta 136,000, H más pesados, J súper (A380).'],
    ['10a', 'c10a', 'Equipo COM/NAV/aproximación', 'Letras de lo que llevas y funciona. S = VHF + VOR + ILS. G = GNSS, D = DME, B = LPV, R = aprobado PBN.'],
    ['10b', 'c10b', 'Equipo de vigilancia', 'N = sin transpondedor, C = modo A/C, S = modo S. Agrega ADS-B si lo llevas: B1 (sale en 1090 MHz).'],
    ['13', 'salida', 'Aeródromo de salida', 'Indicador OACI de 4 letras (Doc 7910). Toluca = MMTO.'],
    ['13', 'hora', 'Hora fuera de calzos (EOBT)', 'En hora UTC, 4 cifras. En el centro de México, UTC = hora local + 6 (09:00 local = 1500).'],
    ['15', 'velocidad', 'Velocidad de crucero', 'TAS: N + 4 cifras en nudos (N0105), K + 4 en km/h, o M + 3 en Mach (M078).'],
    ['15', 'nivel', 'Nivel de crucero', 'F + 3 (nivel de vuelo, F350), A + 3 (altitud en cientos de pies: A095 = 9,500 ft) o VFR.'],
    ['15', 'ruta', 'Ruta', 'Aerovías y puntos separados por espacios. DCT = directo. En IFR, la ruta sale de las aerovías y procedimientos del PIA (AIP).'],
    ['16', 'destino', 'Aeródromo de destino', 'Indicador OACI. Puebla = MMPB.'],
    ['16', 'eet', 'Duración total estimada (EET)', 'Horas y minutos hasta el destino: 0040 = 40 min.'],
    ['16', 'alterno1', 'Alterno 1', 'Indicador OACI (opcional en VFR; revisa lo que exige tu normativa en IFR).'],
    ['16', 'alterno2', 'Alterno 2', 'Opcional.'],
    ['18', 'pbn', 'PBN/', 'Solo si pusiste R: tus especificaciones aprobadas, máximo 8 (C2D2S1).'],
    ['18', 'nav', 'NAV/', 'Datos de navegación extra, por ejemplo SBAS si tu GNSS tiene WAAS.'],
    ['18', 'dof', 'DOF/', 'Fecha del vuelo AAMMDD: 261117 = 17 de noviembre de 2026.'],
    ['18', 'reg', 'REG/', 'Matrícula, solo si es distinta de la casilla 7 (por ejemplo, un vuelo de aerolínea).'],
    ['18', 'opr', 'OPR/', 'Operador, si no se ve en la casilla 7 (opcional).'],
    ['18', 'rmk', 'RMK/', 'Observaciones en texto libre. Sin guiones ni paréntesis.'],
    ['19', 'autonomia', 'E/ Autonomía', 'Combustible a bordo expresado en tiempo: 0400 = 4 h.'],
    ['19', 'personas', 'P/ Personas a bordo', 'Total, incluida la tripulación.'],
    ['19', 'radio', 'R/ Radio de emergencia', 'U = UHF 243.0, V = VHF 121.5, E = ELT. Escribe las que lleves (ej. VE).'],
    ['19', 'supervivencia', 'S/ Equipo de supervivencia', 'P polar, D desierto, M marítimo, J selva. Vacío si no llevas.'],
    ['19', 'chalecos', 'J/ Chalecos', 'L con luz, F fluoresceína, U o V con radio. Vacío si no llevas.'],
    ['19', 'botes', 'D/ Botes', 'Número, capacidad total, si tienen cubierta (C) y su color. Vacío si no llevas.'],
    ['19', 'color', 'A/ Color y marcas', 'Colores del avión y marcas notables.'],
    ['19', 'n19', 'N/ Observaciones', 'Datos extra para búsqueda y salvamento (distinto de RMK/). Vacío si no hay: en el formato se tacha la N.'],
    ['19', 'piloto', 'C/ Piloto al mando', 'Nombre del piloto al mando.'],
    ['19', 'licencia', 'No. de licencia (formato AFAC)', 'Lo pide el formato de la AFAC junto al nombre. No va en el mensaje FPL. Se guarda solo en tu dispositivo.'],
  ];
  const GUARDA = 'air_fpl';
  const leer = () => { try { return JSON.parse(localStorage.getItem(GUARDA) || 'null'); } catch (e) { return null; } };
  const guardar = (d) => { try { localStorage.setItem(GUARDA, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } };

  // Carga pdf-lib solo cuando hace falta (pesa ~500 KB) y queda en caché para usarse sin internet
  let cargaPDFLib = null;
  const cargarPDFLib = () => cargaPDFLib || (cargaPDFLib = new Promise((ok, mal) => {
    if (window.PDFLib) return ok(window.PDFLib);
    const sc = document.createElement('script'); sc.src = 'vendor/pdf-lib.min.js';
    sc.onload = () => ok(window.PDFLib); sc.onerror = () => { cargaPDFLib = null; mal(new Error('No se pudo cargar pdf-lib')); };
    document.head.appendChild(sc);
  }));
  async function descargarAFAC(d, r) {
    const estado = $('#estadoAFAC');
    try {
      estado.textContent = 'Preparando el PDF…';
      const [PDFLib, plantilla] = await Promise.all([cargarPDFLib(), fetch('plan_vuelo_afac.pdf').then((x) => { if (!x.ok) throw new Error('plantilla'); return x.arrayBuffer(); })]);
      const sen = (window.AIrRutasSENEAM || {})[(d.salida || '').toUpperCase()];
      const out = await window.AIrAFAC.llenarAFAC(PDFLib, plantilla, { ...d, casilla18: r.c18, destinatarios: sen ? sen.d : [] });
      const url = URL.createObjectURL(new Blob([out.bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `plan_de_vuelo_${(d.c7 || 'AFAC').toUpperCase()}_${d.dof || ''}.pdf`.replace(/_\.pdf$/, '.pdf');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      estado.textContent = (out.rutaLarga || out.otrosLargo)
        ? 'Listo, pero la ruta o la casilla 18 no cupieron completas en los renglones del formato: revisa el PDF.'
        : 'Listo: se descargó el formato AFAC lleno. Revísalo antes de imprimirlo.';
    } catch (e) {
      estado.textContent = 'No se pudo generar el PDF. Si estás sin internet, abre esta pantalla una vez con conexión para que se guarde.';
    }
  }

  const plan = {
    titulo: 'Plan de vuelo OACI',
    resumen: 'Casilla por casilla, con ejemplos, y un armador que revisa tus errores.',
    render() {
      const d = leer() || F.EJEMPLOS.vfr.datos;
      let casilla = '';
      const campos = CAMPOS.map(([c, id, label, ayuda]) => {
        const titulo = c !== casilla ? `<h3 class="casilla">Casilla ${c}</h3>` : '';
        casilla = c;
        return `${titulo}<div class="campo"><label for="f_${id}">${label}</label><input id="f_${id}" data-id="${id}" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(d[id] || '')}"><div class="ayuda">${ayuda}</div></div>`;
      }).join('');
      return `<section class="calc guia">
        <h1>Plan de vuelo OACI, casilla por casilla</h1>
        <p class="intro">Carga un ejemplo y cambia lo que quieras: el mensaje se arma solo y te dice qué está mal y por qué. El plan de vuelo usa las casillas 7, 8, 9, 10, 13, 15, 16, 18 y 19; los otros números de casilla son de otros mensajes ATS. Cada campo explica qué va y con qué formato.</p>
        <div class="ejemplos">${Object.entries(F.EJEMPLOS).map(([k, e]) => `<button type="button" class="boton" data-ejemplo="${k}">${e.nombre}</button>`).join('')}</div>
        <div class="cols">
          <form class="card" id="formPlan" onsubmit="return false">${campos}</form>
          <div class="card res" aria-live="polite"><h2>Mensaje FPL</h2><div id="salidaPlan"></div></div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Rutas y destinatarios publicados por SENEAM</h2><div id="rutasSENEAM"></div></div>
        <h2 style="margin-top:22px">Reglas que más se olvidan</h2>
        <ul>
          <li>La <b>hora</b> siempre va en <b>UTC</b>. En el centro de México, suma 6 horas a la hora local.</li>
          <li>La <b>velocidad</b> de la casilla 15 es la <b>TAS</b> de crucero, no la IAS.</li>
          <li><b>R</b> en 10a y <b>PBN/</b> en 18 van juntos, siempre.</li>
          <li><b>S</b> ya incluye VHF, VOR e ILS: no repitas V, O ni L.</li>
          <li>En la casilla 10b va <b>una sola letra de transpondedor</b>, más los códigos de ADS-B si los tienes.</li>
          <li>La casilla 19 no se transmite en el mensaje: se queda en la oficina ATS para búsqueda y salvamento.</li>
        </ul>
        <div class="aviso">El ejemplo IFR es ilustrativo: la ruta (DCT) y la altitud no son una ruta real. En un vuelo real, la ruta y los niveles salen del PIA (AIP) de México. Revisa también ENR 1.10 del PIA y lo que pida SENEAM para presentar tu plan.</div>
        <p class="fuente">[OACI] PANS-ATM, Doc 4444, Apéndice 2, con la enmienda 1 (formato vigente desde el 15 de noviembre de 2012). [MX-AFAC] Formato de plan de vuelo F-1-1407 y "Manual de apoyo con rutas para el FPL" de SENEAM, ambos publicados en gob.mx.</p>
      </section>`;
    },
    activar() {
      const form = $('#formPlan');
      const leerForm = () => Object.fromEntries([...form.querySelectorAll('input')].map((i) => [i.dataset.id, i.value]));
      const pintar = () => {
        const d = leerForm();
        guardar(d);
        const r = F.armarFPL(d);
        const tabla = (titulo, filas) => (filas.length ? `<h3>${titulo}</h3><table class="codigos">${filas.map(([c, t]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(t)}</td></tr>`).join('')}</table>` : '');
        $('#salidaPlan').innerHTML = `
          <pre class="msg" id="msgFPL">${esc(r.mensaje)}</pre>
          <div class="ejemplos"><button type="button" class="boton" id="btnCopiar">Copiar mensaje</button>
          <button type="button" class="boton oro" id="btnAFAC" ${r.errores.length ? 'disabled' : ''}>Descargar formato AFAC (PDF)</button></div>
          ${r.errores.length ? '<p class="nota">Para descargar el formato AFAC, primero corrige los errores.</p>' : '<p class="nota">Sale el formato oficial de la AFAC ya lleno, listo para imprimir y firmar. Domicilio y firma van a mano; prioridad, destinatarios, remitente y hora de depósito los pone la oficina ATS.</p>'}
          <p class="nota" id="estadoAFAC" aria-live="polite"></p>
          ${r.errores.length ? `<div class="error"><b>Por corregir:</b><ul>${r.errores.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '<div class="ok">Sin errores de formato.</div>'}
          ${r.avisos.map((a) => `<div class="aviso">${esc(a)}</div>`).join('')}
          <h3>Casilla 19 (se queda en la oficina ATS)</h3><pre class="msg">${esc(r.item19 || '—')}</pre>
          ${tabla('Tu equipo (10a)', r.equipo)}${tabla('Tu vigilancia (10b)', r.vigilancia)}${tabla('Tus especificaciones PBN', r.pbnLista)}`;
        $('#btnAFAC').addEventListener('click', () => descargarAFAC(d, r));
        $('#btnCopiar').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(r.mensaje); $('#btnCopiar').textContent = 'Copiado'; } catch (e) { $('#btnCopiar').textContent = 'No se pudo copiar'; }
        });
      };
      // Panel de rutas del manual de SENEAM para el aeródromo de salida que escribiste
      const pintarRutas = () => {
        const cod = form.querySelector('[data-id="salida"]').value.toUpperCase();
        const tabla = window.AIrRutasSENEAM || {};
        const a = tabla[cod];
        const caja = $('#rutasSENEAM');
        if (!a) {
          caja.innerHTML = `<p>${cod ? `<b>${esc(cod)}</b> no aparece en el manual.` : 'Escribe el aeródromo de salida.'} El manual trae ${Object.keys(tabla).length} aeródromos; algunos grandes (como MMMX, MMGL o MMTO) no vienen en él.</p>
            <details><summary>Ver los aeródromos incluidos</summary><p class="nota">${Object.entries(tabla).map(([k, v]) => `<b>${k}</b> ${esc(v.l)}`).join(' · ')}</p></details>`;
          return;
        }
        caja.innerHTML = `<p><b>${esc(cod)}</b> · ${esc(a.n)} (${esc(a.l)})</p>
          <p class="nota">Destinatarios AFTN (se ponen en el formato AFAC al descargarlo): <code>${a.d.map(esc).join(' ')}</code></p>
          <p>Rutas de salida publicadas (VOR, aerovía y primer punto). Toca una para ponerla al inicio de tu ruta:</p>
          <div class="chips">${a.r.map((x) => `<button type="button" class="chip" data-ruta="${esc(x)}">${esc(x)}</button>`).join('')}</div>
          <div class="aviso">El manual es de 2012: algunas aerovías y puntos pudieron cambiar (México ha ido pasando a rutas RNAV). Antes de volar, confirma la ruta en el PIA (AIP) vigente y con la oficina ATS.</div>`;
        caja.querySelectorAll('[data-ruta]').forEach((b) => b.addEventListener('click', () => {
          const i = form.querySelector('[data-id="ruta"]');
          i.value = b.dataset.ruta; pintar(); i.focus();
        }));
      };
      form.addEventListener('input', (e) => { if (e.target.dataset.id === 'salida') pintarRutas(); });
      document.querySelectorAll('[data-ejemplo]').forEach((b) => b.addEventListener('click', pintarRutas));
      form.addEventListener('input', (e) => { const i = e.target; const p = i.selectionStart; i.value = i.value.toUpperCase(); try { i.setSelectionRange(p, p); } catch (x) { /* nada */ } pintar(); });
      document.querySelectorAll('[data-ejemplo]').forEach((b) => b.addEventListener('click', () => {
        const e = F.EJEMPLOS[b.dataset.ejemplo].datos;
        form.querySelectorAll('input').forEach((i) => { i.value = e[i.dataset.id] || ''; });
        pintar();
      }));
      pintar();
      pintarRutas();
    },
  };

  window.AIrGuias = { pbn, plan };
})();
