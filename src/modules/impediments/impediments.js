// EP-08: HU-39, HU-40, HU-41. Reutiliza Layout, Api y UI del proyecto.
(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const $ = id => document.getElementById(id);
  const vistas = {
    impedimentos: $('vista-listado'),
    nuevoImpedimento: $('vista-formulario'),
    seguimiento: $('vista-seguimiento'),
    riesgos: $('vista-riesgos'),
    nuevoRiesgo: $('vista-riesgo-formulario')
  };
  const tabImpedimentos = $('tab-impedimentos');
  const tabRiesgos = $('tab-riesgos');
  const formImpedimento = $('form-impedimento');
  const formSeguimiento = $('form-seguimiento');
  const formRiesgo = $('form-riesgo');

  let impedimentos = [];
  let riesgos = [];
  let seleccionado = null;
  let opciones = { proyectos: [], sprints: [], historias: [], tareas: [], participantes: [] };

  function mostrarVista(nombre) {
    Object.entries(vistas).forEach(([clave, elemento]) => { elemento.hidden = clave !== nombre; });
    const enRiesgos = nombre === 'riesgos' || nombre === 'nuevoRiesgo';
    tabImpedimentos.classList.toggle('boton--primario', !enRiesgos);
    tabRiesgos.classList.toggle('boton--primario', enRiesgos);
  }

  function establecerOpciones(select, elementos, textoInicial, valor = '') {
    select.replaceChildren();
    const inicial = document.createElement('option');
    inicial.value = '';
    inicial.textContent = textoInicial;
    select.appendChild(inicial);

    for (const item of elementos) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.nombre;
      select.appendChild(option);
    }
    select.disabled = elementos.length === 0;
    select.value = valor && elementos.some(x => x.id === valor) ? valor : '';
  }

  function mensaje(elemento, texto) {
    elemento.hidden = !texto;
    elemento.textContent = texto || '';
  }

  async function enviar(url, method, datos) {
    const respuesta = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const contenido = await respuesta.json().catch(() => ({}));
    return { ok: respuesta.ok, datos: contenido };
  }

  async function cargarOpciones() {
    const r = await Api.get('/api/impediments/opciones');
    if (!r.ok) {
      UI.toast(r.datos?.mensaje || 'No se pudieron cargar las opciones del formulario.', 'error');
      return false;
    }
    opciones = r.datos;
    return true;
  }

  function actualizarRelacion() {
    const tipo = $('tipo-relacion').value;
    const coleccion = {
      proyecto: 'proyectos', sprint: 'sprints', historia: 'historias', tarea: 'tareas'
    }[tipo];
    const elementos = coleccion ? (opciones[coleccion] || []) : [];
    establecerOpciones(
      $('elemento-relacionado'),
      elementos.map(e => ({ id: e.id, nombre: `${e.id} - ${e.nombre}` })),
      tipo ? 'Selecciona un elemento' : 'Primero selecciona un tipo'
    );
  }

  function proyectoDeRelacionado(tipo, id) {
    if (tipo === 'proyecto') return id;
    const coleccion = {
      sprint: 'sprints', historia: 'historias', tarea: 'tareas'
    }[tipo];
    return (opciones[coleccion] || []).find(e => e.id === id)?.idProyecto || null;
  }

  function dibujarImpedimentos() {
    const busqueda = $('buscar').value.trim().toLowerCase();
    const filtro = $('filtro-estado').value;
    const filtrados = impedimentos.filter(i => {
      const texto = `${i.id} ${i.descripcion} ${i.idProyecto} ${i.idRelacionado} ${i.nombreRelacionado} ${i.estado} ${i.nombreResponsable}`.toLowerCase();
      return (!filtro || i.estado === filtro) && (!busqueda || texto.includes(busqueda));
    });
    $('contenedor-tabla').hidden = filtrados.length === 0;
    $('sin-resultados').hidden = filtrados.length > 0;
    $('tabla-impedimentos').innerHTML = filtrados.map(i => `
      <tr>
        <td><strong>${UI.escapar(i.id)}</strong></td>
        <td class="ep08-celda-descripcion">${UI.escapar(i.descripcion)}</td>
        <td>${UI.escapar(i.tipoRelacion)}<br><small>${UI.escapar(i.idRelacionado)}</small></td>
        <td>${UI.escapar(i.nombreResponsable)}</td>
        <td><span class="ep08-estado">${UI.escapar(i.estado)}</span></td>
        <td><button type="button" class="boton" data-seguimiento="${UI.escapar(i.id)}">Ver detalles</button></td>
      </tr>
    `).join('');
  }

  async function cargarImpedimentos() {
    const r = await Api.get('/api/impediments');
    if (!r.ok) {
      UI.toast(r.datos?.mensaje || 'No se pudieron consultar los impedimentos.', 'error');
      return;
    }
    impedimentos = r.datos.impedimentos || [];
    dibujarImpedimentos();
  }

  function abrirAltaImpedimento() {
    formImpedimento.reset();
    actualizarRelacion();
    mensaje($('mensaje-formulario'), '');
    mostrarVista('nuevoImpedimento');
    $('descripcion').focus();
  }

  function volverAImpedimentos() {
    seleccionado = null;
    formImpedimento.reset();
    formSeguimiento.reset();
    mostrarVista('impedimentos');
  }

  async function guardarImpedimento(evento) {
    evento.preventDefault();
    const tipoRelacion = $('tipo-relacion').value;
    const idRelacionado = $('elemento-relacionado').value;
    const idProyecto = proyectoDeRelacionado(tipoRelacion, idRelacionado);
    const descripcion = $('descripcion').value.trim();
    if (!idProyecto || !idRelacionado || !descripcion) {
      mensaje($('mensaje-formulario'), 'Completa los campos obligatorios.');
      return;
    }
    const boton = formImpedimento.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      const r = await enviar('/api/impediments', 'POST', { descripcion, idProyecto, tipoRelacion, idRelacionado });
      if (!r.ok) {
        mensaje($('mensaje-formulario'), r.datos?.mensaje || 'No fue posible registrar el impedimento.');
        return;
      }
      UI.toast('Impedimento registrado correctamente.', 'success');
      volverAImpedimentos();
      await cargarImpedimentos();
    } catch (err) {
      console.error(err);
      mensaje($('mensaje-formulario'), 'Error de conexión con el servidor.');
    } finally {
      boton.disabled = false;
    }
  }

  function responsablesDelProyecto(idProyecto) {
    return (opciones.participantes || [])
      .filter(p => p.idProyecto === idProyecto)
      .map(p => ({ id: p.idUsuario, nombre: `${p.nombre} (${p.rol})` }));
  }

  function fechaLocal(raw) {
    if (!raw) return '';
    const fecha = new Date(raw);
    return Number.isNaN(fecha.getTime()) ? String(raw) : fecha.toLocaleString('es-MX');
  }

  function dibujarAcciones(acciones) {
    const contenedor = $('historial-acciones');
    if (!acciones || acciones.length === 0) {
      contenedor.textContent = 'Todavía no hay acciones registradas.';
      return;
    }
    contenedor.innerHTML = acciones.map(a => `
      <div class="ep08-accion">
        <div>${UI.escapar(a.descripcion)}</div>
        <small>${UI.escapar(fechaLocal(a.fecha))} · Usuario: ${UI.escapar(a.idUsuario || 'Sistema')}</small>
      </div>
    `).join('');
  }

  function abrirSeguimiento(id) {
    const i = impedimentos.find(item => item.id === id);
    if (!i) return UI.toast('Impedimento no encontrado.', 'error');
    seleccionado = i;
    $('seguimiento-id').textContent = `${i.id} · ${i.idProyecto}`;
    $('seguimiento-descripcion').value = i.descripcion;
    $('seguimiento-estado').value = i.estado;
    $('seguimiento-accion').value = '';
    establecerOpciones($('seguimiento-responsable'), responsablesDelProyecto(i.idProyecto), 'Selecciona responsable', i.idResponsable);
    dibujarAcciones(i.acciones);
    mensaje($('mensaje-seguimiento'), '');
    mostrarVista('seguimiento');
  }

  async function guardarSeguimiento(evento) {
    evento.preventDefault();
    if (!seleccionado) return;
    const datos = {
      idResponsable: $('seguimiento-responsable').value,
      estado: $('seguimiento-estado').value,
      accion: $('seguimiento-accion').value.trim()
    };
    if (!datos.idResponsable) {
      mensaje($('mensaje-seguimiento'), 'Selecciona un responsable.');
      return;
    }
    const boton = formSeguimiento.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      const r = await enviar(`/api/impediments/${encodeURIComponent(seleccionado.id)}/seguimiento`, 'PUT', datos);
      if (!r.ok) {
        mensaje($('mensaje-seguimiento'), r.datos?.mensaje || 'No se pudo guardar el seguimiento.');
        return;
      }
      UI.toast('Seguimiento actualizado correctamente.', 'success');
      volverAImpedimentos();
      await cargarImpedimentos();
    } catch (err) {
      console.error(err);
      mensaje($('mensaje-seguimiento'), 'Error de conexión con el servidor.');
    } finally {
      boton.disabled = false;
    }
  }

  function dibujarRiesgos() {
    const busqueda = $('buscar-riesgos').value.trim().toLowerCase();
    const filtrados = riesgos.filter(r =>
      `${r.id} ${r.descripcion} ${r.idProyecto} ${r.probabilidad} ${r.nombreResponsable} ${r.estado}`
        .toLowerCase().includes(busqueda)
    );
    $('contenedor-riesgos').hidden = filtrados.length === 0;
    $('sin-riesgos').hidden = filtrados.length > 0;
    $('tabla-riesgos').innerHTML = filtrados.map(r => `
      <tr>
        <td><strong>${UI.escapar(r.id)}</strong></td>
        <td class="ep08-celda-descripcion">${UI.escapar(r.descripcion)}</td>
        <td>${UI.escapar(r.idProyecto)}</td>
        <td>${UI.escapar(r.probabilidad)}</td>
        <td>${UI.escapar(r.nombreResponsable)}</td>
        <td>${UI.escapar(r.estado)}</td>
      </tr>
    `).join('');
  }

  async function cargarRiesgos() {
    const r = await Api.get('/api/impediments/riesgos');
    if (!r.ok) {
      UI.toast(r.datos?.mensaje || 'No se pudieron consultar los riesgos.', 'error');
      return;
    }
    riesgos = r.datos.riesgos || [];
    dibujarRiesgos();
  }

  function actualizarResponsablesRiesgo() {
    const idProyecto = $('riesgo-proyecto').value;
    establecerOpciones($('riesgo-responsable'), responsablesDelProyecto(idProyecto),
      idProyecto ? 'Selecciona responsable' : 'Primero selecciona un proyecto');
  }

  function abrirAltaRiesgo() {
    formRiesgo.reset();
    establecerOpciones($('riesgo-proyecto'), opciones.proyectos || [], 'Selecciona un proyecto');
    actualizarResponsablesRiesgo();
    mensaje($('mensaje-riesgo'), '');
    mostrarVista('nuevoRiesgo');
  }

  async function guardarRiesgo(evento) {
    evento.preventDefault();
    const datos = {
      idProyecto: $('riesgo-proyecto').value,
      descripcion: $('riesgo-descripcion').value.trim(),
      probabilidad: $('riesgo-probabilidad').value,
      idResponsable: $('riesgo-responsable').value,
      accionesRespuesta: $('riesgo-acciones').value.trim(),
      fechaRevision: $('riesgo-fecha').value
    };
    if (!datos.idProyecto || !datos.descripcion || !datos.probabilidad || !datos.idResponsable || !datos.fechaRevision) {
      mensaje($('mensaje-riesgo'), 'Completa todos los campos obligatorios.');
      return;
    }
    const boton = formRiesgo.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      const r = await enviar('/api/impediments/riesgos', 'POST', datos);
      if (!r.ok) {
        mensaje($('mensaje-riesgo'), r.datos?.mensaje || 'No se pudo guardar el riesgo.');
        return;
      }
      UI.toast('Riesgo registrado correctamente.', 'success');
      mostrarVista('riesgos');
      await cargarRiesgos();
    } catch (err) {
      console.error(err);
      mensaje($('mensaje-riesgo'), 'Error de conexión con el servidor.');
    } finally {
      boton.disabled = false;
    }
  }

  tabImpedimentos.addEventListener('click', () => mostrarVista('impedimentos'));
  tabRiesgos.addEventListener('click', () => mostrarVista('riesgos'));
  $('btn-nuevo').addEventListener('click', abrirAltaImpedimento);
  $('btn-cancelar').addEventListener('click', volverAImpedimentos);
  $('tipo-relacion').addEventListener('change', actualizarRelacion);
  formImpedimento.addEventListener('submit', guardarImpedimento);
  $('buscar').addEventListener('input', dibujarImpedimentos);
  $('filtro-estado').addEventListener('change', dibujarImpedimentos);
  $('tabla-impedimentos').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-seguimiento]');
    if (boton) abrirSeguimiento(boton.dataset.seguimiento);
  });
  $('btn-cancelar-seguimiento').addEventListener('click', volverAImpedimentos);
  formSeguimiento.addEventListener('submit', guardarSeguimiento);
  $('btn-nuevo-riesgo').addEventListener('click', abrirAltaRiesgo);
  $('btn-cancelar-riesgo').addEventListener('click', () => mostrarVista('riesgos'));
  $('riesgo-proyecto').addEventListener('change', actualizarResponsablesRiesgo);
  formRiesgo.addEventListener('submit', guardarRiesgo);
  $('buscar-riesgos').addEventListener('input', dibujarRiesgos);

  mostrarVista('impedimentos');
  await cargarOpciones();
  await cargarImpedimentos();
  await cargarRiesgos();
})();