/*
 * bitacora.js — Bitácora personal de horas del alumno (#/bitacora).
 *
 * Para qué: que el alumno lleve SU propio registro, vuelo por vuelo y en orden cronológico, y compare
 *   - el tiempo de vuelo legal (calzo a calzo: desde que el avión se mueve para despegar hasta que se detiene),
 *   - el tiempo en el aire (despegue a aterrizaje),
 *   - el tiempo de motor (encendido a apagado),
 *   - el horómetro (Hobbs) y
 *   - las horas que le COBRÓ la escuela.
 * Todo se guarda solo en el teléfono o computadora del alumno (localStorage); se puede exportar a CSV.
 *
 * La parte de cálculo (sin pantalla) se exporta para Node: pruebas_bitacora.js.
 */
(function (raiz) {
  /* ---------- 1. CÁLCULOS ---------- */
  // "HH:MM" → minutos del día; '' → null
  function min(hhmm) {
    const m = /^(\d{1,2}):?(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    return h < 24 && mi < 60 ? h * 60 + mi : null;
  }
  // diferencia en minutos entre dos horas; si cruza la medianoche, suma 24 h
  function dif(a, b) {
    const x = min(a), y = min(b);
    if (x == null || y == null) return null;
    let d = y - x; if (d < 0) d += 1440;
    return d;
  }
  // un vuelo → sus tiempos en minutos
  function calcularVuelo(v) {
    const bloque = dif(v.calzosFuera, v.calzosDentro);        // tiempo de vuelo legal
    const aire = dif(v.despegue, v.aterrizaje);
    const motor = dif(v.encendido, v.apagado);
    const hobbs = isFinite(parseFloat(v.hobbsFin)) && isFinite(parseFloat(v.hobbsInicio)) ? Math.round((parseFloat(v.hobbsFin) - parseFloat(v.hobbsInicio)) * 60) : null;
    const cobrado = isFinite(parseFloat(v.horasCobradas)) ? Math.round(parseFloat(v.horasCobradas) * 60) : null;
    const plan = min(v.eetPlan);                              // EET del plan de vuelo (HHMM)
    const extra = cobrado != null && bloque != null ? cobrado - bloque : null;   // + = te cobraron de más
    const costoHora = parseFloat(v.costoHora);
    const costoExtra = extra != null && isFinite(costoHora) ? (extra / 60) * costoHora : null;
    const avisos = [];
    if (bloque != null && aire != null && aire > bloque) avisos.push('El tiempo en el aire no puede ser mayor que el de calzo a calzo: revisa las horas.');
    if (motor != null && bloque != null && bloque > motor) avisos.push('El tiempo de calzo a calzo no puede ser mayor que el de motor: revisa las horas.');
    return { bloque, aire, motor, hobbs, cobrado, plan, extra, costoExtra, avisos };
  }
  // orden cronológico (fecha y luego calzos fuera) y totales
  function ordenar(lista) {
    return [...lista].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (min(a.calzosFuera) ?? 0) - (min(b.calzosFuera) ?? 0));
  }
  function totales(lista) {
    const t = { vuelos: 0, bloque: 0, aire: 0, motor: 0, hobbs: 0, cobrado: 0, plan: 0, extra: 0, costoExtra: 0, aterrizajes: 0, porTipo: {} };
    lista.forEach((v) => {
      const c = calcularVuelo(v); t.vuelos++;
      ['bloque', 'aire', 'motor', 'hobbs', 'cobrado', 'plan', 'extra', 'costoExtra'].forEach((k) => { if (c[k] != null) t[k] += c[k]; });
      t.aterrizajes += parseInt(v.aterrizajes, 10) || 0;
      const tipo = v.tipoVuelo || 'Sin tipo'; t.porTipo[tipo] = (t.porTipo[tipo] || 0) + (c.bloque || 0);
    });
    return t;
  }
  const hm = (m) => (m == null ? '—' : `${m < 0 ? '−' : ''}${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}`);
  const dec = (m) => (m == null ? '—' : (m / 60).toFixed(1));
  // CSV (Excel en español abre bien con ; como separador)
  const COLS = ['fecha', 'matricula', 'aeronave', 'origen', 'destino', 'tipoVuelo', 'instructor', 'encendido', 'calzosFuera', 'despegue', 'aterrizaje', 'calzosDentro', 'apagado', 'hobbsInicio', 'hobbsFin', 'horasCobradas', 'costoHora', 'eetPlan', 'aterrizajes', 'notas'];
  function aCSV(lista) {
    const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const enc = [...COLS, 'calzo_a_calzo_h', 'aire_h', 'motor_h', 'hobbs_h', 'cobrado_h', 'diferencia_cobro_h'];
    const filas = ordenar(lista).map((v) => { const c = calcularVuelo(v); return [...COLS.map((k) => q(v[k])), dec(c.bloque), dec(c.aire), dec(c.motor), dec(c.hobbs), dec(c.cobrado), dec(c.extra)].join(';'); });
    return '﻿' + enc.join(';') + '\n' + filas.join('\n');
  }

  const logica = { min, dif, calcularVuelo, ordenar, totales, hm, dec, aCSV, COLS };
  if (typeof module !== 'undefined') module.exports = logica;
  if (typeof window === 'undefined') return;

  /* ---------- 2. PANTALLA ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GUARDA = 'air_bitacora', BORRADOR = 'air_bitacora_borrador';
  const leer = () => { try { return JSON.parse(localStorage.getItem(GUARDA) || '[]'); } catch (e) { return []; } };
  const guardar = (l) => { try { localStorage.setItem(GUARDA, JSON.stringify(l)); return true; } catch (e) { return false; } };
  const CAMPOS = [
    ['fecha', 'Fecha', 'date'], ['matricula', 'Matrícula', 'text', 'XB-ABC'], ['aeronave', 'Tipo de aeronave', 'text', 'C172'],
    ['origen', 'Origen', 'text', 'MMTO'], ['destino', 'Destino', 'text', 'MMTO'],
    ['tipoVuelo', 'Tipo de vuelo', 'select', ['Doble mando (con instructor)', 'Solo', 'Piloto al mando', 'Travesía', 'Nocturno', 'Instrumentos (IFR)', 'Simulador']],
    ['instructor', 'Instructor', 'text', ''],
    ['encendido', 'Encendido de motor', 'time'], ['calzosFuera', 'Calzos fuera (empieza a moverse)', 'time'], ['despegue', 'Despegue', 'time'],
    ['aterrizaje', 'Aterrizaje', 'time'], ['calzosDentro', 'Calzos dentro (se detiene)', 'time'], ['apagado', 'Apagado de motor', 'time'],
    ['hobbsInicio', 'Horómetro (Hobbs) al inicio', 'num'], ['hobbsFin', 'Horómetro (Hobbs) al final', 'num'],
    ['horasCobradas', 'Horas que te cobró la escuela', 'num'], ['costoHora', 'Precio por hora (opcional)', 'num'],
    ['eetPlan', 'EET del plan de vuelo (HHMM)', 'text', '0040'], ['aterrizajes', 'Número de aterrizajes', 'num'], ['notas', 'Notas', 'text', ''],
  ];
  const bitacora = {
    titulo: 'Mi bitácora de horas',
    resumen: 'Registra cada vuelo: calzo a calzo, aire, motor, horómetro y lo que te cobraron.',
    render() {
      return `<section class="calc guia">
        <h1>Mi bitácora de horas</h1>
        <p class="intro">Tu registro personal, en orden cronológico. Compara el <b>tiempo de vuelo legal</b> (calzo a calzo) con lo que marca el horómetro y con lo que te cobran. Se guarda solo en este dispositivo: exporta tu copia seguido.</p>
        <details class="repaso" open><summary><b>¿Cómo se cuentan legalmente las horas? Lo que sí y lo que no</b></summary>
          <ul>
            <li><b>Tiempo de vuelo</b> en la norma mexicana: «tiempo total transcurrido desde que la aeronave comienza a moverse por su propia fuerza para despegar, hasta que se detiene al finalizar el vuelo» (NOM-022-SCT3-2001, numeral 2.20). Es el <b>calzo a calzo</b> y es lo que va en tu bitácora de vuelo para la licencia.</li>
            <li>La Ley Federal del Trabajo (art. 222) usa la misma idea para tripulantes: «desde que una aeronave comienza a moverse por su propio impulso, o es remolcada para tomar posición de despegue, hasta que se detiene al terminar el vuelo».</li>
            <li>Por lo tanto, <b>el tiempo en plataforma antes de moverte</b> (que suba el instructor, el arranque, esperar con motor encendido) <b>no es tiempo de vuelo</b> para tu bitácora.</li>
            <li><b>Cómo te cobran es otra cosa: es un contrato.</b> No encontramos una norma de la AFAC que obligue a las escuelas a cobrar calzo a calzo. Muchas cobran por <b>horómetro (Hobbs)</b>, que corre desde que arranca el motor. Eso es legal <b>si te lo informaron antes</b> y lo aceptaste.</li>
            <li>La Ley Federal de Protección al Consumidor obliga a todo proveedor a <b>informar y respetar</b> los precios, tarifas, cargos y condiciones con que ofreció el servicio (art. 7) y a mostrar el <b>monto total</b> (art. 7 Bis). Si te vendieron «hora de vuelo» y te cobran tiempo que no es de vuelo, o te cobran algo distinto de lo pactado, puedes reclamar a la escuela por escrito y, si no se arregla, presentar una queja ante <b>PROFECO</b>.</li>
            <li><b>Qué hacer:</b> pide por escrito cómo se mide la hora que pagas (calzo a calzo, Hobbs o tacómetro), anota tus horas en cada vuelo y conserva tus recibos. Esta bitácora te da la evidencia.</li>
            <li>La CO AV-08.4/07 de la AFAC establece el contenido del libro de bitácora del avión y de la bitácora de vuelo: tu registro aquí <b>no sustituye</b> tu bitácora oficial certificada.</li>
          </ul>
          <p class="nota">Esto es información para que conozcas tus derechos, no asesoría legal. Para un caso concreto, consulta a un abogado o a PROFECO.</p>
        </details>
        <div class="cols">
          <form class="card" id="formBit" onsubmit="return false"><h2>Agregar vuelo</h2><div id="bitCampos"></div>
            <div class="ejemplos"><button type="button" class="boton oro" id="bitGuardar">Guardar vuelo</button><button type="button" class="boton" id="bitLimpiar">Limpiar</button></div>
            <div id="bitPrevia" aria-live="polite"></div></form>
          <div class="card res"><h2>Totales</h2><div id="bitTotales"></div>
            <div class="ejemplos"><button type="button" class="boton" id="bitCSV">Exportar a Excel (CSV)</button><button type="button" class="boton" id="bitRespaldo">Respaldo (JSON)</button>
            <label class="boton" style="cursor:pointer">Restaurar respaldo<input type="file" id="bitImportar" accept=".json,application/json" hidden></label></div>
            <p class="nota" id="bitEstado" aria-live="polite"></p></div>
        </div>
        <h2 style="margin-top:22px">Vuelos</h2><div id="bitLista"></div>
        <p class="fuente">[MX] NOM-022-SCT3-2001, num. 2.20 (tiempo de vuelo); Ley Federal del Trabajo, art. 222; Ley Federal de Protección al Consumidor, arts. 7 y 7 Bis; [MX-AFAC] CO AV-08.4/07 (libro de bitácora y bitácora de vuelo). [OACI] Anexo 1: definición de tiempo de vuelo para aviones.</p>
      </section>`;
    },
    activar() {
      let editando = null;
      const pintarCampos = (v = {}) => {
        $('#bitCampos').innerHTML = CAMPOS.map(([k, l, t, x]) => {
          if (t === 'select') return `<div class="campo"><label for="b_${k}">${l}</label><select id="b_${k}" data-k="${k}">${x.map((o) => `<option ${v[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
          const tipo = t === 'num' ? 'text" inputmode="decimal' : t;
          return `<div class="campo"><label for="b_${k}">${l}</label><input id="b_${k}" data-k="${k}" type="${tipo}" placeholder="${esc(x || '')}" value="${esc(v[k] ?? '')}"></div>`;
        }).join('');
        $('#bitCampos').querySelectorAll('[data-k]').forEach((i) => i.addEventListener('input', previa));
        previa();
      };
      const leerForm = () => Object.fromEntries([...$('#bitCampos').querySelectorAll('[data-k]')].map((i) => [i.dataset.k, i.value.trim()]));
      function previa() {
        const c = logica.calcularVuelo(leerForm());
        $('#bitPrevia').innerHTML = `<div class="big">
          <div class="dato"><div class="k">Tiempo de vuelo (calzo a calzo)</div><div class="v">${hm(c.bloque)}</div></div>
          <div class="dato"><div class="k">En el aire</div><div class="v">${hm(c.aire)}</div></div>
          <div class="dato"><div class="k">Motor encendido</div><div class="v">${hm(c.motor)}</div></div>
          <div class="dato"><div class="k">Horómetro</div><div class="v">${hm(c.hobbs)}</div></div></div>
          ${c.extra != null ? `<div class="${c.extra > 0 ? 'aviso' : 'ok'}">Te cobraron ${hm(c.cobrado)} contra ${hm(c.bloque)} de tiempo de vuelo: ${c.extra > 0 ? `<b>${hm(c.extra)} de más</b>${c.costoExtra != null ? ` (≈ $${c.costoExtra.toFixed(0)})` : ''}` : 'sin diferencia en tu contra'}.</div>` : ''}
          ${c.avisos.map((a) => `<div class="error">${esc(a)}</div>`).join('')}`;
      }
      function pintarLista() {
        const lista = logica.ordenar(leer());
        const t = logica.totales(lista);
        $('#bitTotales').innerHTML = lista.length ? `<div class="big">
          <div class="dato"><div class="k">Vuelos</div><div class="v">${t.vuelos}</div></div>
          <div class="dato"><div class="k">Tiempo de vuelo total</div><div class="v">${hm(t.bloque)}</div></div>
          <div class="dato"><div class="k">En el aire</div><div class="v">${hm(t.aire)}</div></div>
          <div class="dato"><div class="k">Motor</div><div class="v">${hm(t.motor)}</div></div>
          <div class="dato"><div class="k">Horómetro</div><div class="v">${hm(t.hobbs)}</div></div>
          <div class="dato"><div class="k">Cobrado</div><div class="v">${hm(t.cobrado)}</div></div></div>
          ${t.extra > 0 ? `<div class="aviso">En total te han cobrado <b>${hm(t.extra)}</b> más que tu tiempo de vuelo${t.costoExtra ? ` (≈ $${t.costoExtra.toFixed(0)})` : ''}.</div>` : ''}
          <p class="nota">Por tipo: ${Object.entries(t.porTipo).map(([k, m]) => `${esc(k)} ${hm(m)}`).join(' · ')} · Aterrizajes: ${t.aterrizajes}</p>` : '<p class="nota">Aún no hay vuelos.</p>';
        $('#bitLista').innerHTML = lista.length ? `<div class="tabla"><table><thead><tr><th>Fecha</th><th>Avión</th><th>Ruta</th><th>Tipo</th><th>Calzo a calzo</th><th>Aire</th><th>Motor</th><th>Hobbs</th><th>Cobrado</th><th>Diferencia</th><th></th></tr></thead><tbody>
          ${lista.map((v) => { const c = logica.calcularVuelo(v); const i = leer().findIndex((x) => x.id === v.id);
            return `<tr><td>${esc(v.fecha)}</td><td>${esc(v.matricula)} ${esc(v.aeronave)}</td><td>${esc(v.origen)}–${esc(v.destino)}</td><td>${esc(v.tipoVuelo)}</td><td>${hm(c.bloque)}</td><td>${hm(c.aire)}</td><td>${hm(c.motor)}</td><td>${hm(c.hobbs)}</td><td>${hm(c.cobrado)}</td><td>${c.extra > 0 ? `<b>+${hm(c.extra)}</b>` : hm(c.extra)}</td>
            <td><button type="button" class="chip" data-editar="${i}">Editar</button> <button type="button" class="chip" data-borrar="${i}">Borrar</button></td></tr>`; }).join('')}
          </tbody></table></div>` : '';
        $('#bitLista').querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => { editando = +b.dataset.editar; pintarCampos(leer()[editando]); $('#bitGuardar').textContent = 'Guardar cambios'; $('#formBit').scrollIntoView({ behavior: 'smooth' }); }));
        $('#bitLista').querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => {
          // borrar pide un segundo toque (sin ventanas emergentes)
          if (b.dataset.seguro) { const l = leer(); l.splice(+b.dataset.borrar, 1); guardar(l); pintarLista(); }
          else { b.dataset.seguro = '1'; b.textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { if (b.isConnected) { delete b.dataset.seguro; b.textContent = 'Borrar'; } }, 4000); }
        }));
      }
      $('#bitGuardar').addEventListener('click', () => {
        const v = leerForm();
        if (!v.fecha || !v.calzosFuera || !v.calzosDentro) { $('#bitEstado').textContent = 'Para guardar necesitas al menos fecha, calzos fuera y calzos dentro.'; return; }
        const l = leer();
        if (editando != null) { v.id = l[editando].id; l[editando] = v; editando = null; $('#bitGuardar').textContent = 'Guardar vuelo'; }
        else { v.id = Date.now().toString(36); l.push(v); }
        $('#bitEstado').textContent = guardar(l) ? 'Vuelo guardado en este dispositivo.' : 'No se pudo guardar (almacenamiento bloqueado en este navegador).';
        pintarCampos({ fecha: v.fecha, matricula: v.matricula, aeronave: v.aeronave, origen: v.destino, tipoVuelo: v.tipoVuelo, instructor: v.instructor, costoHora: v.costoHora });
        pintarLista();
      });
      $('#bitLimpiar').addEventListener('click', () => { editando = null; $('#bitGuardar').textContent = 'Guardar vuelo'; pintarCampos(); });
      const bajar = (nombre, tipo, texto) => { const url = URL.createObjectURL(new Blob([texto], { type: tipo })); const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); };
      $('#bitCSV').addEventListener('click', () => bajar('mi_bitacora_airborne.csv', 'text/csv;charset=utf-8', logica.aCSV(leer())));
      $('#bitRespaldo').addEventListener('click', () => bajar('respaldo_bitacora_airborne.json', 'application/json', JSON.stringify(leer(), null, 1)));
      $('#bitImportar').addEventListener('change', async (e) => {
        try {
          const datos = JSON.parse(await e.target.files[0].text());
          if (!Array.isArray(datos)) throw new Error('formato');
          const l = leer(); const ids = new Set(l.map((x) => x.id));
          datos.forEach((v) => { if (v && typeof v === 'object' && !ids.has(v.id)) l.push(v); });
          guardar(l); pintarLista(); $('#bitEstado').textContent = `Respaldo restaurado: ${datos.length} vuelos revisados (no se duplican).`;
        } catch (err) { $('#bitEstado').textContent = 'Ese archivo no es un respaldo válido de la bitácora.'; }
      });
      // ¿Viene un vuelo realizado desde el plan de vuelo?
      let borrador = null; try { borrador = JSON.parse(localStorage.getItem(BORRADOR) || 'null'); localStorage.removeItem(BORRADOR); } catch (e) { /* nada */ }
      pintarCampos(borrador || {});
      if (borrador) $('#bitEstado').textContent = 'Datos traídos de tu plan de vuelo: completa las horas reales del vuelo y guárdalo.';
      pintarLista();
    },
  };
  raiz.AIrGuias = raiz.AIrGuias || {};
  raiz.AIrGuias.bitacora = bitacora;
  raiz.AIrBitacora = logica;
})(typeof window !== 'undefined' ? window : globalThis);
