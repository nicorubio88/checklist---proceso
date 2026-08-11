const ESTADO = {
  sector: null,
  operario: null,
  rondaActual: null,
  checklistCache: {},
  respuestasRonda: {}
};

// ---------- INICIALIZACIÓN ----------

window.addEventListener('DOMContentLoaded', () => {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  cargarSectores();

  document.getElementById('btnIngresar').onclick = () => {
    ESTADO.sector = document.getElementById('selSector').value;
    ESTADO.operario = document.getElementById('selOperario').value;
    ESTADO.checklistCache = {};
    document.getElementById('lblOperario').textContent = ESTADO.operario;
    document.getElementById('lblSectorActual').textContent = 'Sector: ' + ESTADO.sector;
    document.getElementById('pantallaLogin').classList.add('oculto');
    document.getElementById('pantallaInicio').classList.remove('oculto');
    refrescarSemaforo();
    setInterval(refrescarSemaforo, 30000);
  };
});

function actualizarReloj() {
  document.getElementById('reloj').textContent =
    new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function cargarSectores() {
  const sectores = await apiGet('sectores');
  const sel = document.getElementById('selSector');
  sel.innerHTML = '<option value="">Seleccionar...</option>';
  sectores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  });
  sel.onchange = () => {
    if (sel.value) {
      cargarPersonalDeSector(sel.value);
    } else {
      const selOp = document.getElementById('selOperario');
      selOp.disabled = true;
      selOp.innerHTML = '<option value="">Elegí primero el sector</option>';
      document.getElementById('btnIngresar').disabled = true;
    }
  };
}

async function cargarPersonalDeSector(sector) {
  const selOp = document.getElementById('selOperario');
  selOp.disabled = true;
  selOp.innerHTML = '<option value="">Cargando personal...</option>';
  const lista = await apiGet('personal', { sector });
  selOp.innerHTML = '<option value="">Seleccionar...</option>';
  lista.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nombre; opt.textContent = p.nombre;
    selOp.appendChild(opt);
  });
  selOp.disabled = false;
  selOp.onchange = () => {
    document.getElementById('btnIngresar').disabled = !selOp.value;
  };
}

function cambiarSector() {
  ESTADO.sector = null;
  ESTADO.operario = null;
  ESTADO.checklistCache = {};
  document.getElementById('selOperario').value = '';
  document.getElementById('selSector').value = '';
  document.getElementById('btnIngresar').disabled = true;
  ocultarTodasMenosInicio();
  document.getElementById('pantallaInicio').classList.add('oculto');
  document.getElementById('pantallaLogin').classList.remove('oculto');
}

// ---------- NAVEGACIÓN ----------

function ocultarTodasMenosInicio() {
  ['pantallaRonda', 'pantallaDatosTurno', 'pantallaDashboard'].forEach(id => {
    document.getElementById(id).classList.add('oculto');
  });
}

function volverInicio() {
  ocultarTodasMenosInicio();
  document.getElementById('pantallaInicio').classList.remove('oculto');
  refrescarSemaforo();
}

// ---------- SEMÁFORO DE RONDAS ----------

async function refrescarSemaforo() {
  if (!ESTADO.sector) return;
  const info = await apiGet('estado_turno', { sector: ESTADO.sector });
  document.getElementById('lblTurnoFecha').textContent = 'Turno ' + info.turno + ' · ' + info.fecha;
  const grilla = document.getElementById('grillaRondas');
  grilla.innerHTML = '';
  info.rondas.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'ronda-btn ronda-' + r.estado.toLowerCase();
    btn.disabled = !r.habilitada;
    btn.innerHTML = r.numero + '°<small>' + r.horaProgramada + '</small>';
    btn.onclick = () => abrirRonda(r.numero, r.horaProgramada);
    grilla.appendChild(btn);
  });
}

// ---------- CHECKLIST DE RONDA ----------

async function abrirRonda(numero, horaProgramada) {
  ESTADO.rondaActual = numero;
  ESTADO.respuestasRonda = {};
  document.getElementById('lblRondaTitulo').textContent = 'Recorrida ' + numero + '°';
  document.getElementById('lblRondaHora').textContent = 'Programada ' + horaProgramada + ' · Registrada con hora real del servidor';
  ocultarTodasMenosInicio();
  document.getElementById('pantallaInicio').classList.add('oculto');
  document.getElementById('pantallaRonda').classList.remove('oculto');

  const cont = document.getElementById('contenedorItemsRonda');
  cont.innerHTML = '<p>Cargando checklist de esta hora...</p>';

  const cacheKey = ESTADO.sector + '-' + numero;
  let bloques = ESTADO.checklistCache[cacheKey];
  if (!bloques) {
    bloques = await apiGet('checklist', { sector: ESTADO.sector, ronda: numero });
    ESTADO.checklistCache[cacheKey] = bloques;
  }
  pintarChecklistRonda(bloques);
}

function pintarChecklistRonda(bloques) {
  const cont = document.getElementById('contenedorItemsRonda');
  cont.innerHTML = '';

  if (!bloques || bloques.length === 0) {
    cont.innerHTML = '<p>No hay actividades configuradas para esta hora en este sector.</p>';
    actualizarProgreso(0);
    return;
  }

  let totalItems = 0;
  bloques.forEach(b => {
    const bloqueDiv = document.createElement('div');
    bloqueDiv.className = 'seccion-block';
    const titulo = document.createElement('div');
    titulo.className = 'seccion-titulo';
    titulo.textContent = b.bloque;
    bloqueDiv.appendChild(titulo);

    const grupos = {};
    const ordenGrupos = [];
    b.items.forEach(it => {
      const g = it.grupo || '';
      if (!grupos[g]) { grupos[g] = []; ordenGrupos.push(g); }
      grupos[g].push(it);
    });

    ordenGrupos.forEach(g => {
      if (g) {
        const subt = document.createElement('div');
        subt.style.cssText = 'font-size:12px;font-weight:700;color:#666;margin:6px 0 4px;';
        subt.textContent = g;
        bloqueDiv.appendChild(subt);
      }
      grupos[g].forEach(it => {
        totalItems++;
        bloqueDiv.appendChild(crearFilaItem(it, b.bloque));
      });
    });

    cont.appendChild(bloqueDiv);
  });
  actualizarProgreso(totalItems);
  document.getElementById('btnGuardarRonda').onclick = guardarRonda;
}

function crearFilaItem(it, bloque) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.id = 'item-' + it.id;

  const texto = document.createElement('div');
  texto.className = 'item-texto';
  texto.textContent = it.texto;
  row.appendChild(texto);

  if (it.valorRef) {
    const ref = document.createElement('div');
    ref.className = 'item-ref';
    ref.textContent = 'Valor de referencia: ' + it.valorRef;
    row.appendChild(ref);
  }

  const estados = document.createElement('div');
  estados.className = 'item-estados';
  ['OK', 'DESVIO', 'NA'].forEach(e => {
    const b = document.createElement('button');
    b.className = 'estado-btn';
    b.textContent = e === 'OK' ? 'OK' : (e === 'DESVIO' ? 'Desvío' : 'N/A');
    b.onclick = () => seleccionarEstado(it, bloque, e, row);
    estados.appendChild(b);
  });
  row.appendChild(estados);

  const obs = document.createElement('textarea');
  obs.className = 'item-obs';
  obs.rows = 2;
  obs.placeholder = 'Observación (obligatoria si es Desvío)';
  obs.oninput = () => {
    if (ESTADO.respuestasRonda[it.id]) ESTADO.respuestasRonda[it.id].observacion = obs.value;
  };
  row.appendChild(obs);

  return row;
}

function seleccionarEstado(it, bloque, estado, row) {
  row.querySelectorAll('.estado-btn').forEach(b => { b.className = 'estado-btn'; });
  const idx = { OK: 0, DESVIO: 1, NA: 2 }[estado];
  row.querySelectorAll('.estado-btn')[idx].className = 'estado-btn sel-' + estado;

  const obsField = row.querySelector('.item-obs');
  if (estado === 'DESVIO') obsField.classList.add('visible');
  else obsField.classList.remove('visible');

  ESTADO.respuestasRonda[it.id] = {
    itemId: it.id, bloque, grupo: it.grupo || '', texto: it.texto,
    estado, observacion: obsField.value
  };
  actualizarProgreso();
}

function actualizarProgreso(totalOverride) {
  const total = (totalOverride !== undefined) ? totalOverride : document.querySelectorAll('#contenedorItemsRonda .item-row').length;
  const completados = Object.keys(ESTADO.respuestasRonda).length;
  document.getElementById('progresoRonda').textContent = completados + ' / ' + total + ' ítems';
}

async function guardarRonda() {
  const respuestas = Object.values(ESTADO.respuestasRonda);
  if (respuestas.length === 0) { alert('Marcá al menos un ítem antes de guardar.'); return; }
  const faltaObs = respuestas.some(r => r.estado === 'DESVIO' && !r.observacion);
  if (faltaObs) { alert('Hay desvíos sin observación cargada.'); return; }

  const btn = document.getElementById('btnGuardarRonda');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    const res = await apiPost('respuesta', { sector: ESTADO.sector, operario: ESTADO.operario, rondaNum: ESTADO.rondaActual, respuestas });
    const tieneDesvios = respuestas.some(r => r.estado === 'DESVIO');
    let msg = 'Recorrida guardada (' + (res.estadoTiempo === 'A_TIEMPO' ? 'a tiempo' : 'fuera de término') + ') - ' + res.timestamp;
    if (tieneDesvios) msg += '\n\nSe envió aviso automático por email a los responsables configurados del sector.';
    alert(msg);
    volverInicio();
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar recorrida';
  }
}

// ---------- DATOS DE TURNO ----------

function mostrarDatosTurno() {
  ocultarTodasMenosInicio();
  document.getElementById('pantallaInicio').classList.add('oculto');
  document.getElementById('pantallaDatosTurno').classList.remove('oculto');
}

async function guardarDatosTurno() {
  await apiPost('turno_datos', {
    sector: ESTADO.sector, operario: ESTADO.operario,
    jefeTurno: document.getElementById('inJefeTurno').value,
    tipoGramaje: document.getElementById('inTipoGramaje').value,
    velocidad: document.getElementById('inVelocidad').value
  });
  alert('Datos del turno guardados.');
  volverInicio();
}

// ---------- DASHBOARD ----------

async function mostrarDashboard() {
  ocultarTodasMenosInicio();
  document.getElementById('pantallaInicio').classList.add('oculto');
  document.getElementById('pantallaDashboard').classList.remove('oculto');

  const hoy = new Date();
  const hace7 = new Date(hoy.getTime() - 7 * 86400000);
  document.getElementById('dashDesde').value = hace7.toISOString().slice(0, 10);
  document.getElementById('dashHasta').value = hoy.toISOString().slice(0, 10);

  const lista = await apiGet('operarios_filtro', { sector: ESTADO.sector });
  const sel = document.getElementById('dashOperario');
  sel.innerHTML = '';
  lista.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });
  cargarDashboard();
}

async function cargarDashboard() {
  const d = await apiGet('dashboard', {
    sector: ESTADO.sector,
    desde: document.getElementById('dashDesde').value,
    hasta: document.getElementById('dashHasta').value,
    operario: document.getElementById('dashOperario').value,
    turno: document.getElementById('dashTurno').value
  });
  pintarDashboard(d);
}

function pintarDashboard(d) {
  const r = d.resumen;
  document.getElementById('resumenDash').innerHTML =
    tarjetaResumen(r.pctCumplimiento + '%', 'Cumplimiento') +
    tarjetaResumen(r.rondasTotal, 'Rondas registradas') +
    tarjetaResumen(r.totalDesvios, 'Desvíos') +
    tarjetaResumen(r.totalOK, 'Ítems OK');

  document.getElementById('dashOperarioLista').innerHTML = d.porOperario.map(barraFila).join('') || '<p>Sin datos.</p>';
  document.getElementById('dashTurnoLista').innerHTML = d.porTurno.map(barraFila).join('') || '<p>Sin datos.</p>';
}

function tarjetaResumen(num, lbl) {
  return '<div class="resumen-card"><div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>';
}

function barraFila(x) {
  const color = x.pct >= 90 ? 'var(--verde)' : (x.pct >= 70 ? 'var(--amarillo)' : 'var(--rojo)');
  return '<div class="barra-fila"><div class="barra-cab"><span>' + x.nombre + '</span><span>' + x.pct + '% (' + x.aTiempo + '/' + x.total + ')</span></div>' +
    '<div class="barra-track"><div class="barra-fill" style="width:' + x.pct + '%;background:' + color + '"></div></div></div>';
}
