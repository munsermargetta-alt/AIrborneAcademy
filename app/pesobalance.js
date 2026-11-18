/*
 * pesobalance.js — Pantalla de peso y balance (#/pyb).
 * La lógica (momentos, CG, envolvente) está en calc.js: pesoBalance() y PERFILES_PYB, con pruebas.
 * Aquí solo va la pantalla: escoger avión, capturar pesos, ver la tabla, los límites y el dibujo de la envolvente.
 * Perfil "Personalizado": para cualquier otro avión (por ejemplo un Cessna 310), con datos de SU POH.
 */
(function () {
  const C = window.AIrCalc;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KG = 2.20462;
  const GUARDA = 'air_pyb';
  const leer = () => { try { return JSON.parse(localStorage.getItem(GUARDA) || '{}'); } catch (e) { return {}; } };
  const guardar = (d) => { try { localStorage.setItem(GUARDA, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } };
  const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');

  // Perfil personalizado: el alumno escribe estaciones y envolvente de su POH
  const PERS_EJEMPLO = {
    nombre: 'Personalizado', estaciones: 'Piloto y copiloto, 37\nAsientos traseros, 73\nEquipaje, 95, 120',
    brazoCombustible: 48, pesoMaxDespegue: 2550, pesoMaxRampa: 2558, pesoMaxAterrizaje: 2550, combustibleUtilGal: 53, rodajeGal: 1.4,
    envolvente: '35, 1500\n35, 1950\n41, 2550\n47.3, 2550\n47.3, 1500',
  };
  function perfilPersonalizado(p) {
    const est = String(p.estaciones || '').split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((x) => x[0] && isFinite(parseFloat(x[1])))
      .map((x, i) => ({ id: 'e' + i, nombre: x[0], brazo: parseFloat(x[1]), max: parseFloat(x[2]) || undefined }));
    const env = String(p.envolvente || '').split('\n').map((l) => l.split(',').map((x) => parseFloat(x))).filter((x) => isFinite(x[0]) && isFinite(x[1]));
    return { nombre: 'Personalizado', fuente: 'Datos que escribiste de tu POH', estaciones: est, brazoCombustible: +p.brazoCombustible, pesoMaxDespegue: +p.pesoMaxDespegue,
      pesoMaxRampa: +p.pesoMaxRampa, pesoMaxAterrizaje: +p.pesoMaxAterrizaje, combustibleUtilGal: +p.combustibleUtilGal, rodajeGal: +p.rodajeGal || 0, envolvente: env };
  }

  function dibujo(perfil, r) {
    const env = perfil.envolvente; if (env.length < 3) return '';
    const xs = env.map((p) => p[0]), ys = env.map((p) => p[1]);
    const pts = [r.zfw, r.despegue, r.aterrizaje];
    const x0 = Math.min(...xs, ...pts.map((p) => p.cg)) - 1, x1 = Math.max(...xs, ...pts.map((p) => p.cg)) + 1;
    const y0 = Math.min(...ys, ...pts.map((p) => p.peso)) - 100, y1 = Math.max(...ys, ...pts.map((p) => p.peso)) + 100;
    const W = 320, H = 260, m = 36;
    const X = (x) => m + (x - x0) / (x1 - x0) * (W - m - 10), Y = (y) => H - m - (y - y0) / (y1 - y0) * (H - m - 10);
    const pol = env.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
    const etq = [['ZFW', r.zfw, '#6b7280'], ['Despegue', r.despegue, '#2563eb'], ['Aterrizaje', r.aterrizaje, '#16a34a']];
    return `<svg class="dib" viewBox="0 0 ${W} ${H}" role="img" aria-label="Envolvente de centro de gravedad con tus puntos">
      <polygon points="${pol}" fill="#3b82f6" opacity=".12" stroke="#3b82f6" stroke-width="2"/>
      <polyline points="${pts.map((p) => `${X(p.cg).toFixed(1)},${Y(p.peso).toFixed(1)}`).join(' ')}" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="4 3"/>
      ${etq.map(([t, p, c]) => `<circle cx="${X(p.cg).toFixed(1)}" cy="${Y(p.peso).toFixed(1)}" r="6" fill="${p.dentro ? c : '#dc2626'}"/>`).join('')}
      <g font-size="11" fill="currentColor"><text x="${W / 2}" y="${H - 6}" text-anchor="middle">CG (pulgadas desde el datum)</text>
      <text x="10" y="${H / 2}" transform="rotate(-90 10 ${H / 2})" text-anchor="middle">Peso (lb)</text>
      <text x="${m}" y="${H - m + 14}" text-anchor="middle">${n1(x0)}</text><text x="${W - 10}" y="${H - m + 14}" text-anchor="end">${n1(x1)}</text>
      <text x="${m - 4}" y="${Y(y1) + 4}" text-anchor="end">${Math.round(y1)}</text><text x="${m - 4}" y="${Y(y0)}" text-anchor="end">${Math.round(y0)}</text></g>
      <g font-size="11">${etq.map(([t, , c], i) => `<circle cx="${50 + i * 95}" cy="12" r="5" fill="${c}"/><text x="${58 + i * 95}" y="16" fill="currentColor">${t}</text>`).join('')}</g>
    </svg>`;
  }

  const pyb = {
    titulo: 'Peso y balance',
    resumen: 'Cessna 172S, Piper PA-28-161 o tu propio avión con los datos de su POH.',
    render() {
      const d = leer();
      const op = (v, t) => `<button type="button" data-v="${v}" aria-pressed="${(d.avion || 'C172S') === v}">${t}</button>`;
      return `<section class="calc guia">
        <h1>Peso y balance</h1>
        <p class="intro">Se revisan dos cosas: que no pases el peso máximo y que el centro de gravedad (CG) quede dentro de la envolvente, sin combustible (ZFW), al despegar y al aterrizar.</p>
        <div class="aviso"><b>El peso vacío y su brazo son de TU avión</b>, no del modelo: salen de su registro de peso y balance (cambian con cada equipo instalado). Los brazos de los asientos, el combustible y la envolvente vienen del POH del modelo; confírmalos con el POH de tu avión.</div>
        <div class="cols">
          <form class="card" id="formPyb" onsubmit="return false">
            <div class="campo"><label>Avión</label><div class="seg" id="pybAvion">${op('C172S', 'C172S')}${op('PA28_161', 'PA-28-161')}${op('PERS', 'Otro')}</div></div>
            <div class="campo"><label>Pesos de personas y equipaje en</label><div class="seg" id="pybUnidad"><button type="button" data-v="lb" aria-pressed="${(d.unidad || 'lb') === 'lb'}">libras</button><button type="button" data-v="kg" aria-pressed="${d.unidad === 'kg'}">kilos</button></div></div>
            <div id="pybCampos"></div>
          </form>
          <div class="card res" aria-live="polite"><h2>Resultado</h2><div id="pybRes"></div></div>
        </div>
        <h2 style="margin-top:22px">Para oficial de operaciones: jets comerciales</h2>
        <p>En aviones de línea no se usan pulgadas y momentos sino <b>índices</b> y el CG en <b>% de la cuerda aerodinámica media (%MAC)</b>, con límites de ZFW, despegue y aterrizaje. Esa hoja de carga didáctica es la siguiente sección que vamos a construir.</p>
        <p class="fuente">[USA-FAA] Weight & Balance Handbook (FAA-H-8083-1B). POH Cessna 172S y Piper PA-28-161, sección 6. [MX-AFAC] El piloto al mando es responsable de verificar peso y balance antes de cada vuelo.</p>
      </section>`;
    },
    activar() {
      const d = leer();
      d.avion = d.avion || 'C172S'; d.unidad = d.unidad || 'lb'; d.pers = d.pers || PERS_EJEMPLO;
      const seg = (id, k) => document.querySelectorAll(`#${id} button`).forEach((b) => b.addEventListener('click', () => {
        d[k] = b.dataset.v; document.querySelectorAll(`#${id} button`).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); guardar(d); campos();
      }));
      const perfil = () => (d.avion === 'PERS' ? perfilPersonalizado(d.pers) : C.PERFILES_PYB[d.avion]);
      const v = (k, def = '') => (d.valores && d.valores[d.avion] && d.valores[d.avion][k] != null ? d.valores[d.avion][k] : def);
      const campo = (k, label, u, ayuda = '', def = '') => `<div class="campo"><label for="pb_${k}">${label}</label><div class="fila"><input id="pb_${k}" data-k="${k}" type="text" inputmode="decimal" value="${esc(v(k, def))}"><span class="u">${u}</span></div>${ayuda ? `<div class="ayuda">${ayuda}</div>` : ''}</div>`;
      function campos() {
        const p = perfil(); const u = d.unidad;
        let h = '';
        if (d.avion === 'PERS') {
          h += `<details class="repaso" open><summary>Datos de tu avión (del POH)</summary>
            <div class="campo"><label>Estaciones: nombre, brazo (in), máximo (lb, opcional) — una por renglón</label><textarea id="pers_estaciones" rows="4">${esc(d.pers.estaciones)}</textarea></div>
            <div class="campo"><label>Envolvente: brazo (in), peso (lb) — un punto por renglón, en orden alrededor</label><textarea id="pers_envolvente" rows="5">${esc(d.pers.envolvente)}</textarea></div>
            ${['brazoCombustible:Brazo del combustible:in', 'pesoMaxRampa:Peso máximo de rampa:lb', 'pesoMaxDespegue:Peso máximo de despegue:lb', 'pesoMaxAterrizaje:Peso máximo de aterrizaje:lb', 'combustibleUtilGal:Combustible utilizable:gal', 'rodajeGal:Combustible de arranque y rodaje:gal']
              .map((s) => { const [k, l, un] = s.split(':'); return `<div class="campo"><label>${l}</label><div class="fila"><input data-pers="${k}" type="text" inputmode="decimal" value="${esc(d.pers[k])}"><span class="u">${un}</span></div></div>`; }).join('')}
            <p class="nota">Bimotores como el Cessna 310: tanques en las puntas, auxiliares y lockers en las alas tienen brazos distintos; agrega cada uno como estación (en lb) y deja el combustible principal en "Combustible".</p></details>`;
        }
        h += campo('pesoVacio', 'Peso vacío básico (de tu avión)', 'lb', 'Del registro de peso y balance de tu avión.', d.avion === 'PA28_161' ? '1485.5' : '1680');
        h += campo('brazoVacio', 'Brazo del peso vacío', 'in', '', d.avion === 'PA28_161' ? '85.04' : '38.4');
        p.estaciones.forEach((e) => { h += campo(e.id, e.nombre, u, `Brazo ${e.brazo} in${e.max ? ` · máximo ${e.max} lb` : ''}`, '0'); });
        h += campo('combustibleGal', 'Combustible cargado', 'gal', `Utilizable: ${p.combustibleUtilGal} gal · 6 lb por galón de avgas · brazo ${p.brazoCombustible} in`, '30');
        h += campo('consumoGal', 'Combustible que vas a quemar en el vuelo', 'gal', 'Para el punto de aterrizaje.', '8');
        $('#pybCampos').innerHTML = h;
        $('#pybCampos').querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('input', () => { d.valores = d.valores || {}; d.valores[d.avion] = d.valores[d.avion] || {}; d.valores[d.avion][i.dataset.k] = i.value; guardar(d); calcular(); }));
        $('#pybCampos').querySelectorAll('[data-pers], textarea').forEach((i) => i.addEventListener('input', () => {
          if (i.dataset.pers) d.pers[i.dataset.pers] = i.value; else d.pers[i.id.replace('pers_', '')] = i.value; guardar(d); campos(); calcular();
        }));
        calcular();
      }
      function calcular() {
        const p = perfil(); const f = (k) => parseFloat(String(v(k, $(`#pb_${k}`) ? $(`#pb_${k}`).value : '')).replace(',', '.'));
        const factor = d.unidad === 'kg' ? KG : 1;
        const cargas = {}; p.estaciones.forEach((e) => { cargas[e.id] = (f(e.id) || 0) * factor; });
        const pesoVacio = f('pesoVacio'), brazoVacio = f('brazoVacio');
        if (!(pesoVacio > 0) || !(brazoVacio > 0) || p.envolvente.length < 3) { $('#pybRes').innerHTML = '<p class="nota">Escribe el peso vacío, su brazo y (si es "Otro") la envolvente.</p>'; return; }
        const r = C.pesoBalance(p, { pesoVacio, brazoVacio, cargas, combustibleGal: f('combustibleGal') || 0, consumoGal: f('consumoGal') || 0 });
        const fila = (t, x, max) => `<tr><td>${t}</td><td>${n1(x.peso)} lb<br><span class="nota">${n1(x.peso / KG)} kg</span></td><td>${x.cg.toFixed(2)} in</td><td>${max ? n1(max) + ' lb' : '—'}</td><td>${x.dentro === false || x.dentroPeso === false ? '❌' : '✅'}</td></tr>`;
        $('#pybRes').innerHTML = `<div class="${r.ok ? 'ok' : 'error'}">${r.ok ? 'Dentro de peso y de envolvente en todo el vuelo.' : '<b>Fuera de límites.</b> No se debe volar así: redistribuye la carga o baja peso.'}</div>
          ${r.avisos.map((a) => `<div class="aviso">${esc(a)}</div>`).join('')}
          <div class="tabla"><table><thead><tr><th></th><th>Peso</th><th>CG</th><th>Máximo</th><th></th></tr></thead><tbody>
          ${fila('Sin combustible (ZFW)', r.zfw)}${fila('Rampa', r.rampa, p.pesoMaxRampa)}${fila('Despegue', r.despegue, p.pesoMaxDespegue)}${fila('Aterrizaje', r.aterrizaje, p.pesoMaxAterrizaje)}
          </tbody></table></div>
          ${dibujo(p, r)}
          <details class="repaso"><summary>Ver la tabla de momentos</summary><div class="tabla"><table><thead><tr><th>Concepto</th><th>Peso (lb)</th><th>Brazo (in)</th><th>Momento (lb·in)</th></tr></thead><tbody>
          ${r.filas.map((x) => `<tr><td>${esc(x.nombre)}</td><td>${n1(x.peso)}</td><td>${x.brazo}</td><td>${n1(x.peso * x.brazo)}</td></tr>`).join('')}
          <tr><td>Combustible</td><td>${n1(r.lbComb)}</td><td>${p.brazoCombustible}</td><td>${n1(r.lbComb * p.brazoCombustible)}</td></tr>
          <tr><td>Arranque y rodaje</td><td>−${n1(r.lbRodaje)}</td><td>${p.brazoCombustible}</td><td>−${n1(r.lbRodaje * p.brazoCombustible)}</td></tr></tbody></table></div>
          <p class="formula">CG = suma de momentos ÷ peso total. Fuente de los datos del modelo: ${esc(p.fuente)}.</p></details>`;
      }
      seg('pybAvion', 'avion'); seg('pybUnidad', 'unidad');
      campos();
    },
  };

  window.AIrGuias = window.AIrGuias || {};
  window.AIrGuias.pyb = pyb;
})();
