(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const $ = id => document.getElementById(id);
  const seguro = valor => UI.escapar(String(valor ?? ''));
  const vistas = {
    lista: $('vista-reuniones'),
    nueva: $('vista-nueva-reunion'),
    detalle: $('vista-detalle')
  };
  const formularioReunion = $('form-reunion');
  const formularioAcuerdo = $('form-acuerdo');
  const formularioSeguimiento = $('form-seguimiento-acuerdo');

  let opciones = { proyectos: [], sprints: [], participantes: [] };
  let reuniones = [];
  let reunionActual = null;
  let acuerdoActual = null;

  function vista(nombre) {
    Object.entries(vistas).forEach(([key, elemento]) => {
      elemento.hidden = nombre !== key;
    });
  }
  function aviso(id, texto) {
    const elemento = $(id);
    elemento.hidden = !texto;
    elemento.textContent = texto || '';
  }
  function cargarSelect(elemento, lista, etiqueta, seleccionado = '') {
    elemento.replaceChildren();
    const inicial = document.createElement('option');
    inicial.value = '';
    inicial.textContent = etiqueta;
    elemento.appendChild(inicial);
    for (const item of lista) {
      const opcion = document.createElement('option');
      opcion.value = item.id;
      opcion.textContent = item.nombre;
      elemento.appendChild(opcion);
    }
    elemento.value = seleccionado && lista.some(x => x.id === seleccionado) ? seleccionado : '';
    elemento.disabled = !lista.length;
  }
  function hoyLocal() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }
  function participantesProyecto(idProyecto, { responsables = false } = {}) {
    return (opciones.participantes || []).filter(p =>
      p.idProyecto === idProyecto && (!responsables || p.rol !== 'Interesado')
    );
  }
  function ponerResponsables(select, idProyecto, seleccionado = '') {
    cargarSelect(select, participantesProyecto(idProyecto, { responsables: true }).map(p => ({
      id: p.idUsuario, nombre: `${p.nombre} (${p.rol})`
    })), 'Seleccionar responsable', seleccionado);
  }
  async function pedir(url, method = 'GET', body = null) {
    const respuesta = await fetch(url, {
      method,
      credentials: 'same-origin',
      ...(body === null ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    });
    const datos = await respuesta.json().catch(() => ({}));
    return { ok: respuesta.ok, datos, status: respuesta.status };
  }
  function mostrarError(id, respuesta, predeterminado) {
    aviso(id, respuesta?.datos?.mensaje || predeterminado);
  }

  async function cargarOpciones() {
    const r = await Api.get('/api/reuniones/opciones');
    if (!r.ok) {
      UI.toast(r.datos?.mensaje || 'No se pudieron cargar proyectos y participantes.', 'error');
      return false;
    }
    opciones = r.datos || opciones;
    $('btn-nueva-reunion').hidden = !(opciones.proyectos || []).length;
    return true;
  }

  function tablaReuniones() {
    const texto = $('buscar-reuniones').value.trim().toLowerCase();
    const tipo = $('filtro-tipo').value;
    const filtradas = reuniones.filter(r => {
      const enTexto = `${r.id} ${r.tipo} ${r.fecha} ${r.nombreProyecto} ${r.nombreSprint} ${(r.nombresParticipantes || []).join(' ')} ${r.estadoAcuerdos}`.toLowerCase();
      return (!tipo || r.tipo === tipo) && (!texto || enTexto.includes(texto));
    });
    $('contenedor-reuniones').hidden = !filtradas.length;
    $('sin-reuniones').hidden = !!filtradas.length;
    $('tabla-reuniones').innerHTML = filtradas.map(r => `
      <tr>
        <td><strong>${seguro(r.id)}</strong></td>
        <td>${seguro(r.tipo)}</td>
        <td>${seguro(r.fecha)}</td>
        <td>${seguro(r.nombreProyecto)}<br><small>${seguro(r.nombreSprint)}</small></td>
        <td>${seguro((r.nombresParticipantes || []).join(', '))}</td>
        <td><span class="ep09-estado">${seguro(r.estadoAcuerdos)}</span></td>
        <td class="ep09-acciones-celda"><button class="btn btn-secundario btn-chico" type="button" data-reunion="${seguro(r.id)}">Ver detalles</button></td>
      </tr>
    `).join('');
  }
  async function cargarReuniones() {
    const r = await Api.get('/api/reuniones');
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudieron cargar las reuniones.', 'error');
    reuniones = r.datos?.reuniones || [];
    tablaReuniones();
  }

  function actualizarDependenciasReunion() {
    const idProyecto = $('reunion-proyecto').value;
    const sprints = (opciones.sprints || [])
      .filter(s => s.idProyecto === idProyecto)
      .map(s => ({ id: s.id, nombre: `${s.id} - ${s.nombre}` }));
    cargarSelect($('reunion-sprint'), sprints, 'Sin Sprint (opcional)');
    $('reunion-sprint').disabled = false;
    const miembros = participantesProyecto(idProyecto);
    $('reunion-participantes').replaceChildren();
    if (!miembros.length) {
      $('reunion-participantes').textContent = 'Este proyecto no tiene integrantes activos disponibles.';
      return;
    }
    for (const p of miembros) {
      const etiqueta = document.createElement('label');
      etiqueta.className = 'ep09-participante';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.name = 'participantes';
      check.value = p.idUsuario;
      const texto = document.createElement('span');
      texto.textContent = `${p.nombre} (${p.rol})`;
      etiqueta.append(check, texto);
      $('reunion-participantes').appendChild(etiqueta);
    }
  }
  function abrirNueva() {
    formularioReunion.reset();
    cargarSelect($('reunion-proyecto'), opciones.proyectos || [], 'Selecciona un proyecto');
    $('reunion-fecha').value = hoyLocal();
    actualizarDependenciasReunion();
    aviso('mensaje-reunion', '');
    vista('nueva');
  }
  async function guardarReunion(evento) {
    evento.preventDefault();
    const datos = {
      idProyecto: $('reunion-proyecto').value,
      idSprint: $('reunion-sprint').value || null,
      tipo: $('reunion-tipo').value,
      fecha: $('reunion-fecha').value,
      participantes: [...$('reunion-participantes').querySelectorAll('input:checked')].map(x => x.value),
      observaciones: $('reunion-observaciones').value.trim()
    };
    if (!datos.idProyecto || !datos.tipo || !datos.fecha || !datos.participantes.length) {
      aviso('mensaje-reunion', 'Selecciona proyecto, tipo, fecha y al menos un participante.');
      return;
    }
    const boton = formularioReunion.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      const r = await pedir('/api/reuniones', 'POST', datos);
      if (!r.ok) return mostrarError('mensaje-reunion', r, 'No se pudo guardar la reunión.');
      UI.toast('Reunión registrada correctamente.', 'success');
      await cargarReuniones();
      await abrirDetalle(r.datos.reunion.id);
    } catch (error) {
      console.error(error);
      aviso('mensaje-reunion', 'Error de conexión con el servidor.');
    } finally {
      boton.disabled = false;
    }
  }

  function tablaAcuerdos() {
    if (!reunionActual) return;
    const acuerdos = reunionActual.acuerdos || [];
    $('contenedor-acuerdos').hidden = !acuerdos.length;
    $('sin-acuerdos').hidden = !!acuerdos.length;
    $('resumen-acuerdos').textContent = `${acuerdos.length} registrado(s) · ${reunionActual.estadoAcuerdos}`;
    $('tabla-acuerdos').innerHTML = acuerdos.map(a => `
      <tr>
        <td><strong>${seguro(a.id)}</strong></td>
        <td class="ep09-celda-detalle">${seguro(a.descripcion)}</td>
        <td>${seguro(a.nombreResponsable)}</td>
        <td>${seguro(a.fechaCompromiso || 'Sin fecha')}</td>
        <td><span class="ep09-estado">${seguro(a.estado)}</span></td>
        <td class="ep09-acciones-celda">${reunionActual.puedeGestionar ?
          `<button type="button" class="btn btn-secundario btn-chico" data-acuerdo="${seguro(a.id)}">Seguimiento</button>` :
          'Solo consulta'}</td>
      </tr>
    `).join('');
  }
  async function abrirDetalle(idReunion) {
    const r = await Api.get(`/api/reuniones/${encodeURIComponent(idReunion)}`);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo consultar la reunión.', 'error');
    reunionActual = r.datos.reunion;
    acuerdoActual = null;
    $('detalle-reunion-titulo').textContent = reunionActual.tipo;
    $('detalle-reunion-id').textContent = reunionActual.id;
    $('detalle-proyecto').textContent = reunionActual.nombreProyecto;
    $('detalle-sprint').textContent = reunionActual.nombreSprint;
    $('detalle-fecha').textContent = reunionActual.fecha;
    $('detalle-participantes').textContent = reunionActual.nombresParticipantes.join(', ') || 'No registrados';
    $('detalle-observaciones').textContent = reunionActual.observaciones || 'Sin observaciones';
    formularioSeguimiento.hidden = true;
    formularioAcuerdo.hidden = !reunionActual.puedeGestionar;
    formularioAcuerdo.reset();
    aviso('mensaje-acuerdo', '');
    ponerResponsables($('acuerdo-responsable'), reunionActual.idProyecto);
    tablaAcuerdos();
    vista('detalle');
  }

  async function guardarAcuerdo(evento) {
    evento.preventDefault();
    if (!reunionActual) return;
    const datos = {
      descripcion: $('acuerdo-descripcion').value.trim(),
      idResponsable: $('acuerdo-responsable').value,
      fechaCompromiso: $('acuerdo-fecha').value || null
    };
    const boton = formularioAcuerdo.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      const r = await pedir(`/api/reuniones/${encodeURIComponent(reunionActual.id)}/acuerdos`, 'POST', datos);
      if (!r.ok) return mostrarError('mensaje-acuerdo', r, 'No se pudo guardar el acuerdo.');
      UI.toast('Acuerdo agregado correctamente.', 'success');
      await abrirDetalle(reunionActual.id);
    } catch (error) {
      console.error(error);
      aviso('mensaje-acuerdo', 'Error de conexión con el servidor.');
    } finally {
      boton.disabled = false;
    }
  }
  function mostrarHistorial(historial = []) {
    const contenedor = $('historial-acuerdo');
    if (!historial.length) {
      contenedor.textContent = 'Todavía no hay actualizaciones registradas.';
      return;
    }
    contenedor.innerHTML = [...historial].reverse().map(h => `
      <div class="ep09-historial-item">
        <strong>${seguro(h.valorNuevo?.estado || 'Actualización')}</strong>
        <div>${seguro(h.nota || 'Se modificó el estado, responsable o fecha del compromiso.')}</div>
        <small>${seguro(h.fecha)} · ${seguro(h.nombreUsuario)}</small>
      </div>
    `).join('');
  }
  function abrirSeguimiento(id) {
    if (!reunionActual || !reunionActual.puedeGestionar) return;
    acuerdoActual = (reunionActual.acuerdos || []).find(a => a.id === id);
    if (!acuerdoActual) return UI.toast('No se encontró el acuerdo.', 'error');
    formularioSeguimiento.reset();
    $('titulo-seguimiento-acuerdo').textContent = `Seguimiento ${acuerdoActual.id}`;
    $('texto-acuerdo').textContent = acuerdoActual.descripcion;
    ponerResponsables($('editar-acuerdo-responsable'), reunionActual.idProyecto, acuerdoActual.idResponsable);
    $('editar-acuerdo-estado').value = acuerdoActual.estado;
    $('editar-acuerdo-fecha').value = acuerdoActual.fechaCompromiso || '';
    mostrarHistorial(acuerdoActual.historial || []);
    aviso('mensaje-seguimiento-acuerdo', '');
    formularioSeguimiento.hidden = false;
    formularioAcuerdo.hidden = true;
  }
  async function guardarSeguimiento(evento) {
    evento.preventDefault();
    if (!reunionActual || !acuerdoActual) return;
    const datos = {
      estado: $('editar-acuerdo-estado').value,
      idResponsable: $('editar-acuerdo-responsable').value,
      fechaCompromiso: $('editar-acuerdo-fecha').value || null,
      notaSeguimiento: $('editar-acuerdo-nota').value.trim()
    };
    const boton = formularioSeguimiento.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      const r = await pedir(`/api/reuniones/${encodeURIComponent(reunionActual.id)}/acuerdos/${encodeURIComponent(acuerdoActual.id)}`, 'PUT', datos);
      if (!r.ok) return mostrarError('mensaje-seguimiento-acuerdo', r, 'No se pudo actualizar el acuerdo.');
      const id = reunionActual.id;
      UI.toast('Seguimiento actualizado.', 'success');
      await abrirDetalle(id);
    } catch (error) {
      console.error(error);
      aviso('mensaje-seguimiento-acuerdo', 'Error de conexión con el servidor.');
    } finally {
      boton.disabled = false;
    }
  }

  $('btn-nueva-reunion').addEventListener('click', abrirNueva);
  $('btn-cancelar-reunion').addEventListener('click', () => vista('lista'));
  $('btn-volver-reuniones').addEventListener('click', async () => {
    await cargarReuniones();
    vista('lista');
  });
  $('reunion-proyecto').addEventListener('change', actualizarDependenciasReunion);
  $('buscar-reuniones').addEventListener('input', tablaReuniones);
  $('filtro-tipo').addEventListener('change', tablaReuniones);
  $('tabla-reuniones').addEventListener('click', e => {
    const boton = e.target.closest('[data-reunion]');
    if (boton) abrirDetalle(boton.dataset.reunion);
  });
  $('tabla-acuerdos').addEventListener('click', e => {
    const boton = e.target.closest('[data-acuerdo]');
    if (boton) abrirSeguimiento(boton.dataset.acuerdo);
  });
  $('btn-cancelar-edicion').addEventListener('click', () => {
    formularioSeguimiento.hidden = true;
    formularioAcuerdo.hidden = !reunionActual?.puedeGestionar;
    acuerdoActual = null;
  });
  formularioReunion.addEventListener('submit', guardarReunion);
  formularioAcuerdo.addEventListener('submit', guardarAcuerdo);
  formularioSeguimiento.addEventListener('submit', guardarSeguimiento);

  vista('lista');
  await cargarOpciones();
  await cargarReuniones();
})();
