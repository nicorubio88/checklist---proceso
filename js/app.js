const ESTADO = {
  sector: null,
  operario: null,
  supervisor: null,
  personalActual: [],
  rondaActual: null,
  checklistCache: {},
  respuestasRonda: {}
};

// ---------- INICIALIZACIÓN ----------

window.addEventListener('DOMContentLoaded', () => {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  cargarSectores();

  document.getElementById('btnIngresar').onclick = async () => {
    ESTADO.sector = document.getElementById('selSector').value;
    ESTADO.operario = document.getElementById('selOperario').value;
    ESTADO.supervisor = document.getElementById('selSupervisor').value;
    ESTADO.checklistCache = {};
    document.getElementById('lblOperario').textContent = ESTADO.operario;
    document.getElementById('lblSupervisor').textContent = ESTADO.supervisor && ESTADO.supervisor !== '(No especifica)'
      ? 'Supervisor: ' + ESTADO.supervisor : '';
    document.getElementById('lblSectorActual').textContent = 'Sector: ' + ESTADO.sector;
    document.getElementById('pantallaLogin').classList.add('oculto');
    document.getElementById('pantallaInicio').classList.remove('oculto');

    apiPost('turno_datos', { sector: ESTADO.sector, operario: ESTADO.operario, supervisor: ESTADO.supervisor }).catch(() => {});

    refrescarSemaforo();
    refrescarDisciplina();
    refrescarDesvios();
    setInterval(refrescarSemaforo, 30000);
    setInterval(refrescarDisciplina, 30000);
    setInterval(refrescarDesvios, 30000);
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
  const selSup = document.getElementById('selSupervisor');
  selOp.disabled = true;
  selSup.disabled = true;
  selOp.innerHTML = '<option value="">Cargando personal...</option>';
  selSup.innerHTML = '<option value="">Cargando personal...</option>';

  const lista = await apiGet('personal', { sector });
  ESTADO.personalActual = lista.map(p => p.nombre);

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

  selSup.innerHTML = '<option value="(No especifica)">(No especifica)</option>';
  lista.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nombre; opt.textContent = p.nombre;
    selSup.appendChild(opt);
  });
  selSup.disabled = false;
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

function mostrarAyuda() {
  document.getElementById('pantallaLogin').classList.add('oculto');
  document.getElementById('pantallaAyuda').classList.remove('oculto');
}

function volverDesdeAyuda() {
  document.getElementById('pantallaAyuda').classList.add('oculto');
  document.getElementById('pantallaLogin').classList.remove('oculto');
}

// ---------- NAVEGACIÓN ----------

function ocultarTodasMenosInicio() {
  ['pantallaRonda', 'pantallaDashboard'].forEach(id => {
    document.getElementById(id).classList.add('oculto');
  });
}

function volverInicio() {
  ocultarTodasMenosInicio();
  document.getElementById('pantallaInicio').classList.remove('oculto');
  refrescarSemaforo();
  refrescarDisciplina();
  refrescarDesvios();
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

// ---------- DISCIPLINA OPERATIVA EN VIVO (turno vigente) ----------

async function refrescarDisciplina() {
  if (!ESTADO.sector) return;
  const d = await apiGet('disciplina_turno', { sector: ESTADO.sector });
  document.getElementById('disciplinaPct').textContent = d.pctCumplimiento + '%';
  document.getElementById('disciplinaTexto').textContent =
    d.rondasATiempo + ' de ' + d.rondasEsperadas + ' recorridas cumplidas a tiempo hasta ahora';

  const card = document.getElementById('disciplinaTurno');
  card.classList.remove('disciplina-alta', 'disciplina-media', 'disciplina-baja');
  if (d.pctCumplimiento >= 90) card.classList.add('disciplina-alta');
  else if (d.pctCumplimiento >= 70) card.classList.add('disciplina-media');
  else card.classList.add('disciplina-baja');
}

// ---------- DESVÍOS DEL TURNO (persisten hasta que se cierran) ----------

async function refrescarDesvios() {
  if (!ESTADO.sector) return;
  const desvios = await apiGet('desvios_abiertos', { sector: ESTADO.sector });
  actualizarBadgeDesvios(desvios.length);
  pintarListaDesvios(desvios);
}

function actualizarBadgeDesvios(cantidad) {
  const badge = document.getElementById('badgeDesvios');
  if (cantidad > 0) {
    badge.textContent = cantidad;
    badge.classList.remove('oculto');
  } else {
    badge.classList.add('oculto');
  }
}

function pintarListaDesvios(desvios) {
  const cont = document.getElementById('listaDesvios');
  if (!desvios || desvios.length === 0) {
    cont.innerHTML = '<p class="sin-desvios">No hay desvíos abiertos.</p>';
    return;
  }
  cont.innerHTML = '';
  desvios.forEach(d => cont.appendChild(crearFilaDesvio(d)));
}

function crearFilaDesvio(d) {
  const row = document.createElement('div');
  row.className = 'desvio-row';

  const cab = document.createElement('div');
  cab.className = 'desvio-cab';
  cab.innerHTML = '<span class="desvio-hora">Ronda ' + d.rondaNum + '° · ' + d.horaDetectado + ' · ' + d.turno + '</span>' +
    '<span class="desvio-badge">Abierto</span>';
  row.appendChild(cab);

  const item = document.createElement('div');
  item.className = 'desvio-item';
  item.textContent = '[' + d.bloque + (d.grupo ? ' / ' + d.grupo : '') + '] ' + d.item;
  row.appendChild(item);

  const obs = document.createElement('div');
  obs.className = 'desvio-obs';
  obs.textContent = 'Observación: ' + (d.observacion || '(sin observación)');
  row.appendChild(obs);

  const declaro = document.createElement('div');
  declaro.className = 'desvio-declaro';
  declaro.textContent = 'Declarado por: ' + d.operario + ' · ' + d.fecha;
  row.appendChild(declaro);

  const btnAbrirCierre = document.createElement('button');
  btnAbrirCierre.className = 'btn btn-secundario btn-cerrar-desvio';
  btnAbrirCierre.textContent = 'Cerrar desvío';

  const formCierre = document.createElement('div');
  formCierre.className = 'form-cierre oculto';
  const taAccion = document.createElement('textarea');
  taAccion.className = 'item-obs visible';
  taAccion.rows = 2;
  taAccion.placeholder = 'Acción tomada para resolver el desvío (obligatorio)';
  const selQuienCierra = document.createElement('select');
  selQuienCierra.className = 'sel-cierra';
  ESTADO.personalActual.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    selQuienCierra.appendChild(opt);
  });
  const btnConfirmarCierre = document.createElement('button');
  btnConfirmarCierre.className = 'btn btn-primary';
  btnConfirmarCierre.textContent = 'Confirmar cierre';
  btnConfirmarCierre.onclick = async () => {
    if (!taAccion.value.trim()) { alert('Falta describir la acción tomada.'); return; }
    btnConfirmarCierre.disabled = true;
    try {
      await apiPost('cerrar_desvio', { desvioId: d.id, accionCierre: taAccion.value, cerradoPor: selQuienCierra.value || ESTADO.operario });
      await refrescarDesvios();
    } catch (err) {
      alert('Error al cerrar el desvío: ' + err.message);
      btnConfirmarCierre.disabled = false;
    }
  };

  const lblQuienCierra = document.createElement('label');
  lblQuienCierra.textContent = 'Quién cierra';
  formCierre.appendChild(taAccion);
  formCierre.appendChild(lblQuienCierra);
  formCierre.appendChild(selQuienCierra);
  formCierre.appendChild(btnConfirmarCierre);

  btnAbrirCierre.onclick = () => formCierre.classList.toggle('oculto');

  row.appendChild(btnAbrirCierre);
  row.appendChild(formCierre);
  return row;
}

// ---------- DASHBOARD ----------

async function mostrarDashboard() {
  ocultarTodasMenosInicio();
  document.getElementById('pantallaInicio').classList.add('oculto');
  document.getElementById('pantallaDashboard').classList.remove('oculto');

  // Por defecto: turno vigente (misma fecha operativa que usa el semáforo,
  // no la fecha del navegador, para que el turno Noche no se corte a medianoche).
  const infoTurno = await apiGet('estado_turno', { sector: ESTADO.sector });
  document.getElementById('dashDesde').value = infoTurno.fecha;
  document.getElementById('dashHasta').value = infoTurno.fecha;
  document.getElementById('dashTurno').value = infoTurno.turno;

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
