(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;
  const flash = sessionStorage.getItem('flash');
  if (flash) { sessionStorage.removeItem('flash'); UI.toast(flash, 'exito'); }
  const id = new URLSearchParams(window.location.search).get('id');
  const ESTADOS = [
    ['preparacion', 'En preparación', 'reloj'], ['activo', 'Activo', 'rayo'],
    ['suspendido', 'Suspendido', 'pausa'], ['finalizado', 'Finalizado', 'check']
  ];
  const NOMBRES = { preparacion: 'En preparación', activo: 'Activo', suspendido: 'Suspendido', finalizado: 'Finalizado' };
  const SIGUIENTE = { preparacion: 'activo', activo: 'suspendido', suspendido: 'activo' };
  let actual = null; 
  let historiasActuales = [];
  let historialActual = []; // HU-38: Almacén de historial completo para filtrado dinámico
  let historiaEditando = null;
  let developersProyecto = [];
  const formularioHistoria = document.getElementById('formulario-historia');
  const formularioContenedor = document.getElementById('formulario-historia-contenedor');
  const criteriosFormulario = document.getElementById('criterios-formulario');
  const tareasFormulario = document.getElementById('tareas-formulario');
  const dependenciasFormulario = document.getElementById('historia-dependencias');
  const listaHistorias = document.getElementById('lista-historias');
  const formularioSprintContenedor = document.getElementById('formulario-sprint-contenedor');
  const formularioSprint = document.getElementById('formulario-sprint');
  const sprintNombreInput = document.getElementById('sprint-nombre');
  const sprintEstadoSelect = document.getElementById('sprint-estado');
  const sprintObjetivoInput = document.getElementById('sprint-objetivo');
  const sprintInicioInput = document.getElementById('sprint-inicio');
  const sprintFinInput = document.getElementById('sprint-fin');
  const sprintHistoriasLista = document.getElementById('sprint-historias-lista');
  const sprintHistoriasResumen = document.getElementById('sprint-historias-resumen');
  const botonGuardarSprint = document.getElementById('guardar-sprint');
  const botonCancelarSprint = document.getElementById('cancelar-edicion-sprint');
  const listaSprints = document.getElementById('lista-sprints');
  let sprintsActuales = [];
  let sprintEditando = null;
  let historiasAsignadasSprint = [];
  const divisionContenedor = document.getElementById('division-contenedor');
  const historiasDivision = document.getElementById('historias-division');
  let historiaParaDividir = null;

  // ---------- Gestión de Definition of Done (HU-36) ----------
  const tablaDod = document.getElementById('tabla-dod');
  const formDodContenedor = document.getElementById('contenedor-form-dod');
  const formDod = document.getElementById('form-dod');
  const dodIdInput = document.getElementById('dod-id');
  const dodDescripcionInput = document.getElementById('dod-descripcion');
  const dodTipoInput = document.getElementById('dod-tipo');
  let listaDod = [];

  async function cargarDod() {
    if (!actual) return;
    const r = await Api.get(`/api/projects/${encodeURIComponent(actual.id)}/dod`);
    if (r.ok) {
      listaDod = r.datos.dods || [];
      renderizarDod();
    }
  }

  function renderizarDod() {
    if (!listaDod.length) {
      tablaDod.innerHTML = '<tr><td colspan="3" class="texto-suave">No hay elementos configurados en la DoD.</td></tr>';
      return;
    }
    
    tablaDod.innerHTML = listaDod.map(dod => {
      const claseInsignia = dod.tipo === 'Obligatorio' ? 'insignia--activo' : 'insignia--suspendido';
      return `
        <tr>
          <td>${UI.escapar(dod.descripcion)}</td>
          <td><span class="insignia ${claseInsignia}">${UI.escapar(dod.tipo)}</span></td>
          <td>
            <div class="tabla__acciones">
              <button class="btn btn-texto btn-chico" data-editar-dod="${UI.escapar(dod.id)}">Editar</button>
              <button class="btn btn-texto btn-chico peligro" data-eliminar-dod="${UI.escapar(dod.id)}">Quitar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('btn-agregar-dod')?.addEventListener('click', () => {
    formDod.reset();
    dodIdInput.value = '';
    formDodContenedor.hidden = false;
  });

  document.getElementById('btn-cancelar-dod')?.addEventListener('click', () => {
    formDodContenedor.hidden = true;
  });

  formDod?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
      descripcion: dodDescripcionInput.value.trim(),
      tipo: dodTipoInput.value
    };
    
    const idDod = dodIdInput.value;
    const url = `/api/projects/${encodeURIComponent(actual.id)}/dod${idDod ? `/${encodeURIComponent(idDod)}` : ''}`;
    
    const boton = formDod.querySelector('[type="submit"]');
    UI.cargando(boton, true);
    const r = idDod ? await Api.put(url, datos) : await Api.post(url, datos);
    UI.cargando(boton, false);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error al guardar elemento DoD.', 'error');
    
    UI.toast(r.datos.mensaje, 'exito');
    formDodContenedor.hidden = true;
    await cargarDod();
  });

  tablaDod?.addEventListener('click', async (e) => {
    const btnEditar = e.target.closest('[data-editar-dod]');
    if (btnEditar) {
      const dod = listaDod.find(d => d.id === btnEditar.dataset.editarDod);
      if (dod) {
        dodIdInput.value = dod.id;
        dodDescripcionInput.value = dod.descripcion;
        dodTipoInput.value = dod.tipo;
        formDodContenedor.hidden = false;
      }
      return;
    }
    const btnEliminar = e.target.closest('[data-eliminar-dod]');
    if (btnEliminar) {
      const ok = await UI.confirmar({
        titulo: 'Quitar elemento DoD',
        mensaje: '¿Seguro que deseas eliminar este elemento de verificación?',
        textoOk: 'Quitar',
        peligro: true
      });
      if (!ok) return;
      const idDod = btnEliminar.dataset.eliminarDod;
      const r = await Api.delete(`/api/projects/${encodeURIComponent(actual.id)}/dod/${encodeURIComponent(idDod)}`);
      
      if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error al eliminar.', 'error');
      UI.toast('Elemento eliminado', 'exito');
      await cargarDod();
    }
  });

  // ---------- Tareas y Criterios ----------
  function agregarCriterio(criterio = {}) {
    const numero = criteriosFormulario.children.length + 1;
    const fila = document.createElement('div');
    fila.className = 'historia-criterio';
    fila.dataset.id = criterio.id || '';
    fila.innerHTML = `
      <div class="historia-criterio__encabezado">
        <div class="historia-criterio__titulo">Criterio ${numero}</div>
        ${criterio.id ? '' : '<button class="btn btn-texto btn-chico" type="button" data-quitar-criterio>Quitar criterio</button>'}
      </div>
      <div class="historia-criterio__campos">
        <div class="campo">
          <label for="criterio-${numero}-dado">Dado</label>
          <textarea class="control" id="criterio-${numero}-dado" data-campo="dado" required>${UI.escapar(criterio.dado || '')}</textarea>
        </div>
        <div class="campo">
          <label for="criterio-${numero}-cuando">Cuando</label>
          <textarea class="control" id="criterio-${numero}-cuando" data-campo="cuando" required>${UI.escapar(criterio.cuando || '')}</textarea>
        </div>
        <div class="campo">
          <label for="criterio-${numero}-entonces">Entonces</label>
          <textarea class="control" id="criterio-${numero}-entonces" data-campo="entonces" required>${UI.escapar(criterio.entonces || '')}</textarea>
        </div>
      </div>`;
    criteriosFormulario.appendChild(fila);
  }

  function agregarTarea(tarea = {}) {
    const numero = tareasFormulario.children.length + 1;
    const estadoActual = tarea.estado || 'Por hacer';
    const idRespActual = tarea.idResponsable || tarea.idUsuarioResponsable || '';
    const opcionesDev = developersProyecto.length
      ? developersProyecto.map((d) => `
          <option value="${UI.escapar(d.id)}" ${idRespActual === d.id ? 'selected' : ''}>
            ${UI.escapar(d.nombre)} (${UI.escapar(d.id)})
          </option>
        `).join('')
      : '<option value="" disabled>No hay developers en el equipo</option>';
    const fila = document.createElement('div');
    fila.className = 'historia-criterio historia-tarea';
    fila.dataset.id = tarea.id || '';
    fila.innerHTML = `
      <div class="historia-criterio__encabezado">
        <div class="historia-criterio__titulo">Tarea ${numero}${tarea.id ? ` (${UI.escapar(tarea.id)})` : ''}</div>
        ${tarea.id ? '' : '<button class="btn btn-texto btn-chico" type="button" data-quitar-tarea>Quitar tarea</button>'}
      </div>
      <div class="historia-criterio__campos">
        <div class="campo">
          <label for="tarea-${numero}-titulo">Título de la tarea</label>
          <input class="control" id="tarea-${numero}-titulo" data-campo-tarea="titulo" maxlength="160" placeholder="Ej.: Diseñar tabla" value="${UI.escapar(tarea.titulo || '')}" required>
        </div>
        <div class="campo">
          <label for="tarea-${numero}-responsable">Responsable (Developer)</label>
          <select class="control" id="tarea-${numero}-responsable" data-campo-tarea="idResponsable" required>
            <option value="">Selecciona un developer...</option>
            ${opcionesDev}
          </select>
        </div>
        <div class="campo">
          <label for="tarea-${numero}-horas">Horas estimadas</label>
          <input class="control" type="number" min="1" step="1" id="tarea-${numero}-horas" data-campo-tarea="horasEstimadas" placeholder="Ej.: 12" value="${tarea.horasEstimadas ? Number(tarea.horasEstimadas) : ''}" required>
        </div>
        <div class="campo" style="grid-column: 1 / -1;">
          <label for="tarea-${numero}-descripcion">Descripción</label>
          <textarea class="control" id="tarea-${numero}-descripcion" data-campo-tarea="descripcion" placeholder="Detalle de la tarea" required>${UI.escapar(tarea.descripcion || '')}</textarea>
        </div>
        <div class="campo">
          <label for="tarea-${numero}-estado">Estado</label>
          <select class="control" id="tarea-${numero}-estado" data-campo-tarea="estado">
            <option value="Por hacer" ${estadoActual === 'Por hacer' ? 'selected' : ''}>Por hacer</option>
            <option value="En progreso" ${estadoActual === 'En progreso' ? 'selected' : ''}>En progreso</option>
            <option value="En revisión" ${estadoActual === 'En revisión' ? 'selected' : ''}>En revisión</option>
            <option value="Terminado" ${estadoActual === 'Terminado' ? 'selected' : ''}>Terminado</option>
          </select>
        </div>
      </div>`;
    tareasFormulario.appendChild(fila);
  }

  function reiniciarFormularioHistoria() {
    formularioHistoria.reset();
    criteriosFormulario.replaceChildren();
    tareasFormulario.replaceChildren();
    historiaEditando = null;
    document.getElementById('historia-aclaracion').value = '';
    document.getElementById('aclaracion-refinamiento').hidden = true;
    document.getElementById('guardar-historia').textContent = 'Registrar historia';
    document.getElementById('cancelar-edicion-historia').hidden = true;
  }

  function actualizarOpcionesDependencias(seleccionadas = [], excluirId = null) {
    dependenciasFormulario.replaceChildren();
    historiasActuales
      .filter((historia) => historia.id !== excluirId)
      .forEach((historia) => {
        const opcion = document.createElement('option');
        opcion.value = historia.id;
        opcion.textContent = `${historia.id} - ${historia.titulo}`;
        opcion.selected = seleccionadas.includes(historia.id);
        dependenciasFormulario.appendChild(opcion);
      });
  }

  function dibujarHistorias(historias, permisos, archivado) {
    historiasActuales = historias || [];
    actualizarOpcionesDependencias([], historiaEditando);
    formularioContenedor.hidden = !permisos.gestionarHistorias || archivado;
    
    listaHistorias.innerHTML = historiasActuales.length
      ? historiasActuales.map((historia, indice) => {
        const criterios = historia.criterios || [];
        const tareas = historia.tareas || [];
        const comentarios = historia.comentarios || [];
        const aclaraciones = historia.aclaraciones || [];
        const relacion = historia.idHistoriaOrigen
          ? `Derivada de: ${UI.escapar(historia.idHistoriaOrigen)}`
          : historia.divisiones?.length
            ? `Dividida en: ${historia.divisiones.map((id) => UI.escapar(id)).join(', ')}`
            : '';
        return `
          <tr>
            <td><span class="insignia">${UI.escapar(historia.id)}</span>${relacion ? `<small class="historia-relacion">${relacion}</small>` : ''}</td>
            <td class="historia-prioridad">
              <strong>${indice + 1}</strong>
              ${permisos.priorizarHistorias && !archivado ? `<div class="historia-prioridad__acciones">
                <button class="btn btn-secundario btn-chico" type="button" data-mover-historia="${indice}" data-direccion="-1" aria-label="Subir prioridad" ${indice === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn btn-secundario btn-chico" type="button" data-mover-historia="${indice}" data-direccion="1" aria-label="Bajar prioridad" ${indice === historiasActuales.length - 1 ? 'disabled' : ''}>▼</button>
              </div>` : ''}
            </td>
            <td><strong>${UI.escapar(historia.titulo)}</strong></td>
            <td class="historia-tabla__descripcion">${UI.escapar(historia.descripcion)}</td>
            <td>${historia.estimacion
              ? `<span class="insignia historia-estimacion">Talla ${UI.escapar(historia.estimacion)}</span>`
              : '<span class="historia-vacio">Sin estimar</span>'}</td>
            <td class="historia-dependencias">${historia.dependencias?.length
              ? historia.dependencias.map((idDependencia) => {
                const dependencia = historiasActuales.find((item) => item.id === idDependencia);
                return `<span class="historia-relacion">${UI.escapar(idDependencia)}${dependencia ? ` - ${UI.escapar(dependencia.titulo)}` : ''}</span>`;
              }).join('')
              : '<span class="historia-vacio">Sin dependencias</span>'}</td>
            <td class="historia-responsable">${UI.escapar(historia.responsableOrganizativo || 'Sin responsable')}</td>
            <td>${criterios.length
              ? `<details class="historia-tabla__criterios">
                  <summary>Ver ${criterios.length}</summary>
                  <ol class="historia-criterios-lista">${criterios.map((criterio) => `
                  <li><strong>Dado:</strong> ${UI.escapar(criterio.dado)}; <strong>Cuando:</strong> ${UI.escapar(criterio.cuando)}; <strong>Entonces:</strong> ${UI.escapar(criterio.entonces)}</li>
                  `).join('')}</ol>
                </details>`
              : '<span class="historia-vacio">Sin criterios</span>'}</td>
            <td>${tareas.length
              ? `<details class="historia-tabla__criterios">
                  <summary>Ver ${tareas.length}</summary>
                  <ol class="historia-criterios-lista">${tareas.map((tarea) => {
                    const respTexto = tarea.nombreResponsable || tarea.idResponsable ? ` - Resp: ${UI.escapar(tarea.nombreResponsable || tarea.idResponsable)}` : '';
                    return `<li><strong>${UI.escapar(tarea.id ? `${tarea.id} - ` : '')}${UI.escapar(tarea.titulo)}</strong> <span class="insignia insignia--chica">${tarea.horasEstimadas || 1}h</span> (${UI.escapar(tarea.estado || 'Por hacer')}${respTexto}${tarea.fechaTerminado ? ` Terminado: ${UI.formatoFecha(tarea.fechaTerminado)}` : ''}): ${UI.escapar(tarea.descripcion)}</li>`;
                  }).join('')}</ol>
                </details>`
              : '<span class="historia-vacio">Sin tareas</span>'}</td>
            <td class="historia-comentarios">
              ${comentarios.length
                ? `<details>
                    <summary>Ver ${comentarios.length}</summary>
                    <ul class="historia-comentarios__lista">${comentarios.map((comentario) => `
                      <li class="historia-comentarios__item">
                        <strong>${UI.escapar(comentario.usuario)}</strong> • <time>${UI.formatoFecha(comentario.fecha)}</time>
                        <p>${UI.escapar(comentario.texto)}</p>
                      </li>`).join('')}
                    </ul>
                  </details>`
                : '<span class="historia-vacio">Sin comentarios</span>'}
              ${permisos.comentarHistorias && !archivado ? `
                <form class="historia-comentarios__formulario" data-comentar-historia="${UI.escapar(historia.id)}">
                  <textarea class="control" name="texto" maxlength="2000" placeholder="Escribe un comentario..." required></textarea>
                  <button class="btn btn-secundario btn-chico" type="submit">Comentar</button>
                </form>` : ''}
            </td>
            <td>${aclaraciones.length
              ? `<details>
                  <summary>Ver ${aclaraciones.length}</summary>
                  <ul class="historia-comentarios__lista">${aclaraciones.map((aclaracion) => `
                    <li class="historia-comentarios__item">
                      <strong>${UI.escapar(aclaracion.usuario)}</strong> • <time>${UI.formatoFecha(aclaracion.fecha)}</time>
                      <p>${UI.escapar(aclaracion.texto)}</p>
                    </li>`).join('')}
                  </ul>
                </details>`
              : '<span class="historia-vacio">Sin aclaraciones</span>'}</td>
            <td class="historia-acciones">
              ${permisos.refinarHistorias && !archivado
                ? `<button class="btn btn-secundario btn-chico" type="button" data-editar-historia="${UI.escapar(historia.id)}">Refinar</button>`
                : ''}
              ${permisos.gestionarHistorias && !archivado
                ? `<button class="btn btn-secundario btn-chico" type="button" data-dividir-historia="${UI.escapar(historia.id)}">Dividir</button>`
                : ''}
            </td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="12" class="historia-vacio">Todavía no hay historias registradas en este proyecto.</td></tr>';
  }

  // ---------- Sprints y Tablero ----------
  const ROLES_DEFINIR_SPRINT = ['administrador', 'Product Owner', 'Developer'];
  const ROLES_FINALIZAR_SPRINT = ['administrador', 'Product Owner', 'Developer'];
  const ROLES_CANCELAR_SPRINT = ['administrador', 'Product Owner'];
  const ESTADOS_SPRINT_VALIDOS = ['Planificado', 'En curso', 'Finalizado', 'Cancelado'];
  const CLASE_ESTADO_SPRINT = {
    'Planificado': 'preparacion',
    'En curso': 'activo',
    'Finalizado': 'finalizado',
    'Cancelado': 'suspendido'
  };

  function insigniaEstadoSprint(estado) {
    const valor = ESTADOS_SPRINT_VALIDOS.includes(estado) ? estado : 'Planificado';
    const clase = CLASE_ESTADO_SPRINT[valor] || 'preparacion';
    return `<span class="insignia insignia--${clase}">${UI.escapar(valor)}</span>`;
  }

  function fechaActualLocal() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  function actualizarResumenHistoriasSprint() {
    if (!sprintHistoriasResumen) return;
    sprintHistoriasResumen.textContent = historiasAsignadasSprint.length
      ? `Historias seleccionadas (${historiasAsignadasSprint.length}): ${historiasAsignadasSprint.join(', ')}`
      : 'Historias seleccionadas (0): ninguna';
  }

  function actualizarOpcionesHistoriasSprint() {
    if (!sprintHistoriasLista) return;
    const idsValidos = new Set(historiasActuales.map((h) => h.id));
    historiasAsignadasSprint = historiasAsignadasSprint.filter((idHistoria) => idsValidos.has(idHistoria));
    if (!historiasActuales.length) {
      sprintHistoriasLista.innerHTML = '<p class="historia-vacio">No hay historias para seleccionar.</p>';
      actualizarResumenHistoriasSprint();
      return;
    }
    sprintHistoriasLista.innerHTML = historiasActuales.map((historia) => {
      const marcada = historiasAsignadasSprint.includes(historia.id);
      return `
        <label class="casilla sprint-historia-opcion ${marcada ? 'sprint-historia-opcion--activa' : ''}">
          <input type="checkbox" value="${UI.escapar(historia.id)}" data-historia-sprint="${UI.escapar(historia.id)}" ${marcada ? 'checked' : ''}>
          <span class="insignia">${UI.escapar(historia.id)}</span>
          <span class="sprint-historia-opcion__titulo">${UI.escapar(historia.titulo)}</span>
        </label>`;
    }).join('');
    actualizarResumenHistoriasSprint();
  }

  if (sprintHistoriasLista) {
    sprintHistoriasLista.addEventListener('change', (e) => {
      const casilla = e.target.closest('input[data-historia-sprint]');
      if (!casilla) return;
      const idHistoria = casilla.dataset.historiaSprint;
      if (casilla.checked) {
        if (!historiasAsignadasSprint.includes(idHistoria)) {
          historiasAsignadasSprint.push(idHistoria);
        }
      } else {
        historiasAsignadasSprint = historiasAsignadasSprint.filter((idItem) => idItem !== idHistoria);
      }
      const etiqueta = casilla.closest('.sprint-historia-opcion');
      if (etiqueta) etiqueta.classList.toggle('sprint-historia-opcion--activa', casilla.checked);
      
      actualizarResumenHistoriasSprint();
    });
  }

  function fijarMinimoFechasSprint() {
    const hoy = fechaActualLocal();
    if (sprintInicioInput) sprintInicioInput.min = hoy;
    if (sprintFinInput) sprintFinInput.min = sprintInicioInput?.value && sprintInicioInput.value > hoy ? sprintInicioInput.value : hoy;
  }

  if (sprintInicioInput) {
    sprintInicioInput.addEventListener('change', fijarMinimoFechasSprint);
  }

  function reiniciarFormularioSprint() {
    if (!formularioSprint) return;
    formularioSprint.reset();
    sprintEditando = null;
    historiasAsignadasSprint = [];
    fijarMinimoFechasSprint();
    actualizarOpcionesHistoriasSprint();
    if (botonGuardarSprint) botonGuardarSprint.textContent = 'Definir sprint';
    if (botonCancelarSprint) botonCancelarSprint.hidden = true;
  }

  function dibujarSprints(sprints = [], miRol = null, permisos = {}, archivado = false) {
    if (!formularioSprintContenedor || !listaSprints) return;
    sprintsActuales = sprints || [];
    const puedeDefinirSprint = (permisos.definirSprint !== undefined
      ? permisos.definirSprint
      : ROLES_DEFINIR_SPRINT.includes(miRol)) && !archivado;
    const puedeFinalizarSprint = ROLES_FINALIZAR_SPRINT.includes(miRol) && !archivado;
    const puedeCancelarSprint = ROLES_CANCELAR_SPRINT.includes(miRol) && !archivado;
    formularioSprintContenedor.hidden = !puedeDefinirSprint;
    fijarMinimoFechasSprint();
    actualizarOpcionesHistoriasSprint();
    listaSprints.innerHTML = sprintsActuales.length
      ? sprintsActuales.map((sprint) => {
        const historiasAsignadas = sprint.historiasAsignadas || [];
        return `
          <tr>
            <td><span class="insignia">${UI.escapar(sprint.id)}</span></td>
            <td><strong>${UI.escapar(sprint.nombre)}</strong></td>
            <td class="historia-tabla__descripcion">${UI.escapar(sprint.objetivo)}</td>
            <td class="sprint-periodo">${UI.formatoFecha(sprint.fechaInicio)}</td>
            <td class="sprint-periodo">${UI.formatoFecha(sprint.fechaFin)}</td>
            <td>${insigniaEstadoSprint(sprint.estado)}</td>
            <td>${historiasAsignadas.length
              ? `<details class="historia-tabla__criterios">
                  <summary>Ver ${historiasAsignadas.length}</summary>
                  <ul class="historia-criterios-lista">${historiasAsignadas.map((idHistoria) => {
                    const h = historiasActuales.find((item) => item.id === idHistoria);
                    return `<li><strong>${UI.escapar(idHistoria)}</strong>${h ? ` - ${UI.escapar(h.titulo)}` : ''}</li>`;
                  }).join('')}</ul>
                </details>`
              : '<span class="historia-vacio">Sin historias</span>'}</td>
            <td class="historia-acciones">
              ${puedeDefinirSprint && !archivado
                ? `<button class="btn btn-secundario btn-chico" type="button" data-editar-sprint="${UI.escapar(sprint.id)}">Editar</button>`
                : ''}
              ${puedeFinalizarSprint && sprint.estado !== 'Finalizado' && sprint.estado !== 'Cancelado' && !archivado
                ? `<button class="btn btn-secundario btn-chico" type="button" data-finalizar-sprint="${UI.escapar(sprint.id)}">Finalizar</button>`
                : ''}
              ${puedeCancelarSprint && sprint.estado !== 'Cancelado' && sprint.estado !== 'Finalizado' && !archivado
                ? `<button class="btn btn-peligro btn-chico" type="button" data-cancelar-sprint="${UI.escapar(sprint.id)}">Cancelar</button>`
                : ''}
            </td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="8" class="historia-vacio">Todavía no hay sprints.</td></tr>';
  }

  if (formularioSprint) {
    formularioSprint.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!actual) return;
      UI.limpiarErrores(formularioSprint);
      const nombre = sprintNombreInput.value.trim();
      const estado = sprintEstadoSelect ? sprintEstadoSelect.value : 'Planificado';
      const objetivo = sprintObjetivoInput.value.trim();
      const fechaInicio = sprintInicioInput.value;
      const fechaFin = sprintFinInput.value;
      let valido = true;
      if (!nombre) {
        UI.marcarError(sprintNombreInput, 'El nombre es obligatorio.');
        valido = false;
      }
      if (!ESTADOS_SPRINT_VALIDOS.includes(estado)) {
        UI.marcarError(sprintEstadoSelect, 'Selecciona un estado válido.');
        valido = false;
      } else if (estado === 'En curso') {
        const hayOtroEnCurso = sprintsActuales.some(
          (s) => s.estado === 'En curso' && (!sprintEditando || s.id !== sprintEditando)
        );
        if (hayOtroEnCurso) {
          UI.marcarError(sprintEstadoSelect, 'Ya hay un sprint en curso.');
          valido = false;
        }
      }
      if (!valido) return;
      UI.cargando(botonGuardarSprint, true);
      const datosSprint = {
        nombre, objetivo, fechaInicio, fechaFin, estado,
        historiasAsignadas: [...historiasAsignadasSprint]
      };
      
      const url = `/api/projects/${encodeURIComponent(actual.id)}/sprints${sprintEditando ? `/${encodeURIComponent(sprintEditando)}` : ''}`;
      const r = sprintEditando ? await Api.put(url, datosSprint) : await Api.post(url, datosSprint);
      
      UI.cargando(botonGuardarSprint, false);
      if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error al guardar.', 'error');
      
      reiniciarFormularioSprint();
      await pintar();
      UI.toast(r.datos.mensaje, 'exito');
    });
  }

  if (botonCancelarSprint) {
    botonCancelarSprint.addEventListener('click', reiniciarFormularioSprint);
  }

  function pedirRazonCancelacion(nombreSprint) {
    return new Promise((resolver) => {
      const fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo-cancelar">
          <h2 id="modal-titulo-cancelar">Cancelar sprint</h2>
          <p>Indica la razón por la que se decide cancelar el sprint <strong>${UI.escapar(nombreSprint)}</strong>.</p>
          <div class="campo">
            <textarea class="control" id="razon-cancelacion" placeholder="Motivo de la cancelación..." maxlength="1000" rows="3" required></textarea>
            <span class="campo__error" id="error-razon-cancelacion" hidden></span>
          </div>
          <div class="modal__acciones">
            <button class="btn btn-secundario" type="button" data-r="cancelar">Volver</button>
            <button class="btn btn-peligro-solido" type="button" data-r="confirmar">Confirmar</button>
          </div>
        </div>`;
      
      const textarea = fondo.querySelector('#razon-cancelacion');
      const errorAviso = fondo.querySelector('#error-razon-cancelacion');
      
      const cerrar = (valor) => {
        document.removeEventListener('keydown', alTeclear);
        fondo.remove();
        resolver(valor);
      };
      
      const alTeclear = (e) => {
        if (e.key === 'Escape') cerrar(null);
      };
      
      fondo.addEventListener('click', (e) => {
        if (e.target === fondo) return cerrar(null);
        const boton = e.target.closest('[data-r]');
        if (!boton) return;
        
        if (boton.dataset.r === 'cancelar') return cerrar(null);
        if (boton.dataset.r === 'confirmar') {
          const razon = textarea.value.trim();
          if (!razon) {
            errorAviso.textContent = 'Debes escribir una razón.';
            errorAviso.hidden = false;
            textarea.classList.add('invalido');
            textarea.focus();
            return;
          }
          cerrar(razon);
        }
      });
      
      document.addEventListener('keydown', alTeclear);
      document.body.appendChild(fondo);
      textarea.focus();
    });
  }

  if (listaSprints) {
    listaSprints.addEventListener('click', async (e) => {
      const botonCancelar = e.target.closest('[data-cancelar-sprint]');
      if (botonCancelar && actual) {
        const sprint = sprintsActuales.find((s) => s.id === botonCancelar.dataset.cancelarSprint);
        if (!sprint) return;
        const razon = await pedirRazonCancelacion(sprint.nombre);
        if (!razon) return;
        
        UI.cargando(botonCancelar, true);
        const r = await Api.put(`/api/projects/${encodeURIComponent(actual.id)}/sprints/${encodeURIComponent(sprint.id)}/cancelar`, { razon });
        UI.cargando(botonCancelar, false);
        
        if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error al cancelar.', 'error');
        await pintar();
        UI.toast(r.datos.mensaje, 'exito');
        return;
      }
      const botonFinalizar = e.target.closest('[data-finalizar-sprint]');
      if (botonFinalizar && actual) {
        const sprint = sprintsActuales.find((s) => s.id === botonFinalizar.dataset.finalizarSprint);
        if (!sprint) return;
        const ok = await UI.confirmar({
          titulo: 'Finalizar sprint',
          mensaje: `¿Deseas finalizar el sprint "${sprint.nombre}"?`,
          textoOk: 'Finalizar',
          peligro: true
        });
        if (!ok) return;
        UI.cargando(botonFinalizar, true);
        const r = await Api.put(`/api/projects/${encodeURIComponent(actual.id)}/sprints/${encodeURIComponent(sprint.id)}/finalizar`);
        UI.cargando(botonFinalizar, false);
        
        if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error al finalizar.', 'error');
        await pintar();
        UI.toast(r.datos.mensaje, 'exito');
        return;
      }
      const botonEditar = e.target.closest('[data-editar-sprint]');
      if (!botonEditar || !actual) return;
      const sprint = sprintsActuales.find((s) => s.id === botonEditar.dataset.editarSprint);
      if (!sprint) return;
      sprintEditando = sprint.id;
      sprintNombreInput.value = sprint.nombre;
      sprintEstadoSelect.value = sprint.estado || 'Planificado';
      sprintObjetivoInput.value = sprint.objetivo;
      sprintInicioInput.value = sprint.fechaInicio;
      sprintFinInput.value = sprint.fechaFin;
      historiasAsignadasSprint = [...(sprint.historiasAsignadas || [])];
      actualizarOpcionesHistoriasSprint();
      if (botonGuardarSprint) botonGuardarSprint.textContent = 'Guardar cambios';
      if (botonCancelarSprint) botonCancelarSprint.hidden = false;
      formularioSprintContenedor.hidden = false;
      formularioSprint.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ---------- Tablero ----------
  const filtroSprintTablero = document.getElementById('filtro-sprint-tablero');
  const filtroTableroTitulo = document.getElementById('filtro-tablero-titulo');
  const filtroTableroResponsable = document.getElementById('filtro-tablero-responsable');
  const filtroTableroHistoria = document.getElementById('filtro-tablero-historia');
  const columnasTablero = {
    'Por hacer': document.getElementById('columna-por-hacer'),
    'En progreso': document.getElementById('columna-en-progreso'),
    'En revisión': document.getElementById('columna-en-revision'),
    'Terminado': document.getElementById('columna-terminado')
  };
  const contadoresTablero = {
    'Por hacer': document.getElementById('contador-por-hacer'),
    'En progreso': document.getElementById('contador-en-progreso'),
    'En revisión': document.getElementById('contador-en-revision'),
    'Terminado': document.getElementById('contador-terminado')
  };
  const ROLES_MODIFICAR_TAREA = ['administrador', 'Developer'];
  let filtroSprintSeleccionado = 'todos';
  let miRolActual = null;
  let proyectoArchivadoActual = false;

  function renderizarTareasTablero() {
    const puedeModificarTarea = ROLES_MODIFICAR_TAREA.includes(miRolActual) && !proyectoArchivadoActual;
    if (!columnasTablero['Por hacer']) return;
    const textoTitulo = filtroTableroTitulo ? filtroTableroTitulo.value.trim().toLowerCase() : '';
    const filtroResp = filtroTableroResponsable ? filtroTableroResponsable.value : 'todos';
    const filtroHist = filtroTableroHistoria ? filtroTableroHistoria.value : 'todas';
    let historiasFiltradas = historiasActuales;
    if (filtroSprintSeleccionado !== 'todos') {
      const sprintActual = sprintsActuales.find((s) => s.id === filtroSprintSeleccionado);
      const idsAsignadas = new Set(sprintActual ? (sprintActual.historiasAsignadas || []) : []);
      historiasFiltradas = historiasActuales.filter((h) => idsAsignadas.has(h.id));
    }
    const tareasPorEstado = {
      'Por hacer': [],
      'En progreso': [],
      'En revisión': [],
      'Terminado': []
    };
    historiasFiltradas.forEach((historia) => {
      if (filtroHist !== 'todas' && historia.id !== filtroHist) return;
      (historia.tareas || []).forEach((tarea) => {
        if (textoTitulo && !(tarea.titulo || '').toLowerCase().includes(textoTitulo)) return;
        const respId = tarea.idResponsable || tarea.idUsuarioResponsable || '';
        if (filtroResp !== 'todos' && respId !== filtroResp) return;
        let estadoNormalizado = tarea.estado || 'Por hacer';
        if (estadoNormalizado === 'por_hacer' || estadoNormalizado === 'Pendiente') estadoNormalizado = 'Por hacer';
        if (estadoNormalizado === 'en_progreso') estadoNormalizado = 'En progreso';
        if (estadoNormalizado === 'en_revision') estadoNormalizado = 'En revisión';
        if (estadoNormalizado === 'terminado' || estadoNormalizado === 'Completada') estadoNormalizado = 'Terminado';
        
        if (!tareasPorEstado[estadoNormalizado]) estadoNormalizado = 'Por hacer';
        tareasPorEstado[estadoNormalizado].push({
          ...tarea,
          idHistoria: historia.id,
          tituloHistoria: historia.titulo
        });
      });
    });
    Object.keys(tareasPorEstado).forEach((estado) => {
      const contenedor = columnasTablero[estado];
      const contador = contadoresTablero[estado];
      const tareas = tareasPorEstado[estado];
      
      if (contador) contador.textContent = String(tareas.length);
      if (contenedor) {
        if (!tareas.length) {
          contenedor.innerHTML = '<div class="tablero-vacio">Sin tareas</div>';
        } else {
          contenedor.innerHTML = tareas.map((t) => {
            const selectorEstado = puedeModificarTarea ? `
              <div class="tablero-tarjeta__estado">
                <select class="control control--chico selector-estado-tarea" data-id-historia="${UI.escapar(t.idHistoria)}" data-id-tarea="${UI.escapar(t.id)}">
                  <option value="Por hacer" ${t.estado === 'Por hacer' ? 'selected' : ''}>Mover a: Por hacer</option>
                  <option value="En progreso" ${t.estado === 'En progreso' ? 'selected' : ''}>Mover a: En progreso</option>
                  <option value="En revisión" ${t.estado === 'En revisión' ? 'selected' : ''}>Mover a: En revisión</option>
                  <option value="Terminado" ${t.estado === 'Terminado' ? 'selected' : ''}>Mover a: Terminado</option>
                </select>
              </div>` : '';
            
            return `
              <article class="tablero-tarjeta" data-tarea-id="${UI.escapar(t.id || '')}">
                <div class="tablero-tarjeta__meta">
                  <span class="insignia">${UI.escapar(t.id || 'TK')}</span>
                  <span class="insignia insignia--horas">${Number(t.horasEstimadas) || 1}h</span>
                  <span class="tablero-tarjeta__historia" title="${UI.escapar(t.idHistoria)}">${UI.escapar(t.idHistoria)}</span>
                </div>
                <div class="tablero-tarjeta__titulo">${UI.escapar(t.titulo)}</div>
                <div class="tablero-tarjeta__responsable">
                  <span class="avatar avatar--chico" style="width: 22px; height: 22px; font-size: 0.65rem;">${UI.escapar(UI.iniciales(t.nombreResponsable || ''))}</span>
                  <span>${UI.escapar(t.nombreResponsable || t.idResponsable || 'Sin asignar')}</span>
                </div>
                ${selectorEstado}
              </article>`;
          }).join('');
        }
      }
    });
  }

  function dibujarTableroScrum(sprints = [], miRol = null, archivado = false) {
    miRolActual = miRol;
    proyectoArchivadoActual = archivado;
    if (!filtroSprintTablero) return;
    const valorPrevio = filtroSprintSeleccionado;
    const sprintEnCurso = sprints.find((s) => s.estado === 'En curso');
    
    filtroSprintTablero.innerHTML = `
      <option value="todos">Todos los sprints del proyecto</option>
      ${sprints.map((s) => `
        <option value="${UI.escapar(s.id)}">${UI.escapar(s.id)} - ${UI.escapar(s.nombre)}</option>
      `).join('')}
    `;
    
    if (valorPrevio && (valorPrevio === 'todos' || sprints.some((s) => s.id === valorPrevio))) {
      filtroSprintSeleccionado = valorPrevio;
    } else if (sprintEnCurso) {
      filtroSprintSeleccionado = sprintEnCurso.id;
    } else {
      filtroSprintSeleccionado = 'todos';
    }
    filtroSprintTablero.value = filtroSprintSeleccionado;
    
    if (filtroTableroResponsable) {
      filtroTableroResponsable.innerHTML = `
        <option value="todos">Todos los responsables</option>
        ${developersProyecto.map((d) => `
          <option value="${UI.escapar(d.id)}">${UI.escapar(d.nombre)}</option>
        `).join('')}
      `;
    }
    if (filtroTableroHistoria) {
      filtroTableroHistoria.innerHTML = `
        <option value="todas">Todas las historias</option>
        ${historiasActuales.map((h) => `
          <option value="${UI.escapar(h.id)}">${UI.escapar(h.id)}</option>
        `).join('')}
      `;
    }
    
    renderizarTareasTablero();
    Icons.hidratar();
  }

  if (filtroSprintTablero) filtroSprintTablero.addEventListener('change', () => { filtroSprintSeleccionado = filtroSprintTablero.value; renderizarTareasTablero(); });
  if (filtroTableroTitulo) filtroTableroTitulo.addEventListener('input', renderizarTareasTablero);
  if (filtroTableroResponsable) filtroTableroResponsable.addEventListener('change', renderizarTareasTablero);
  if (filtroTableroHistoria) filtroTableroHistoria.addEventListener('change', renderizarTareasTablero);

  // ---------- HU-37: Validar que el trabajo esté terminado (Checklist de DoD) ----------
  function pedirConfirmacionDoD(dods, idTarea) {
    return new Promise((resolver) => {
      const fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      
      const checkboxes = dods.map(d => `
        <div class="campo" style="margin-bottom: 8px;">
          <label class="casilla" style="display: flex; align-items: flex-start; gap: 8px;">
            <input type="checkbox" value="${UI.escapar(d.id)}" data-req="${d.tipo === 'Obligatorio'}" style="margin-top: 4px;">
            <span>${UI.escapar(d.descripcion)} 
              <span class="texto-suave" style="font-size: 0.85rem; margin-left: 4px;">
                ${d.tipo === 'Obligatorio' ? '• <b style="color:var(--c-brasa)">Obligatorio</b>' : '(Opcional)'}
              </span>
            </span>
          </label>
        </div>
      `).join('');

      fondo.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <h2 style="margin-bottom: 4px;">Verificar Tarea</h2>
          <p class="texto-suave" style="margin-bottom: 16px;">Antes de marcar como terminada la tarea <strong>${UI.escapar(idTarea)}</strong></p>
          <div style="max-height: 40vh; overflow-y: auto; margin-bottom: 12px; padding-right: 8px;">
            ${checkboxes}
          </div>
          <div class="campo__error" id="error-dod" hidden style="margin-bottom: 12px;">No se puede terminar: falta cumplir criterios obligatorios de la DoD.</div>
          <div class="modal__acciones">
            <button class="btn btn-secundario" type="button" data-r="cancelar">Cancelar</button>
            <button class="btn btn-primario" type="button" data-r="confirmar">Marcar terminada</button>
          </div>
        </div>`;
      
      const cerrar = (valor) => {
        document.removeEventListener('keydown', alTeclear);
        fondo.remove();
        resolver(valor);
      };
      const alTeclear = (e) => { if (e.key === 'Escape') cerrar(null); };
      
      fondo.addEventListener('click', (e) => {
        if (e.target === fondo) return cerrar(null);
        const boton = e.target.closest('[data-r]');
        if (!boton) return;
        
        if (boton.dataset.r === 'cancelar') return cerrar(null);
        if (boton.dataset.r === 'confirmar') {
          const obligatorios = [...fondo.querySelectorAll('input[data-req="true"]')];
          if (obligatorios.some(cb => !cb.checked)) {
            fondo.querySelector('#error-dod').hidden = false;
            return;
          }
          const confirmados = [...fondo.querySelectorAll('input:checked')].map(cb => cb.value);
          cerrar(confirmados);
        }
      });
      
      document.addEventListener('keydown', alTeclear);
      document.body.appendChild(fondo);
    });
  }

  async function actualizarEstadoTarea(selector, idHistoria, idTarea, nuevoEstado, dodsConfirmados) {
    selector.disabled = true;
    const r = await Api.put(
      `/api/projects/${encodeURIComponent(actual.id)}/historias/${encodeURIComponent(idHistoria)}/tareas/${encodeURIComponent(idTarea)}/estado`,
      { estado: nuevoEstado, dodsConfirmados }
    );
    selector.disabled = false;
    
    if (!r.ok) {
      UI.toast(r.datos?.mensaje || 'Error al actualizar el estado de la tarea.', 'error');
      await pintar();
      return;
    }
    
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  }

  const contenedorTablero = document.getElementById('tablero-scrum');
  if (contenedorTablero) {
    contenedorTablero.addEventListener('change', async (e) => {
      const selector = e.target.closest('.selector-estado-tarea');
      if (!selector || !actual) return;
      const idHistoria = selector.dataset.idHistoria;
      const idTarea = selector.dataset.idTarea;
      const nuevoEstado = selector.value;
      const opcionPrevia = [...selector.options].find(o => o.defaultSelected)?.value || 'Por hacer';
      
      if (nuevoEstado === 'Terminado' && listaDod && listaDod.length > 0) {
        const confirmados = await pedirConfirmacionDoD(listaDod, idTarea);
        if (!confirmados) {
          selector.value = opcionPrevia;
          return;
        }
        await actualizarEstadoTarea(selector, idHistoria, idTarea, nuevoEstado, confirmados);
      } else {
        await actualizarEstadoTarea(selector, idHistoria, idTarea, nuevoEstado, []);
      }
    });
  }

  // ---------- Filtros de Historial (HU-38) ----------
  const inputBuscarHistorial = document.getElementById('buscar-historial');
  const selectFiltroElemento = document.getElementById('filtro-elemento-historial');

  function renderizarHistorial() {
    const tbody = document.getElementById('historial');
    if (!tbody) return;
    const texto = inputBuscarHistorial ? inputBuscarHistorial.value.trim().toLowerCase() : '';
    const tipoFiltro = selectFiltroElemento ? selectFiltroElemento.value : '';

    const filtrado = historialActual.filter((h) => {
      const coincideElemento = !tipoFiltro || h.entidad === tipoFiltro;
      const coincideTexto = !texto 
        || (h.usuario || '').toLowerCase().includes(texto)
        || (h.elemento || '').toLowerCase().includes(texto)
        || (h.valorAnterior || '').toLowerCase().includes(texto)
        || (h.valorNuevo || '').toLowerCase().includes(texto)
        || UI.formatoFecha(h.fecha).toLowerCase().includes(texto);

      return coincideElemento && coincideTexto;
    });

    tbody.innerHTML = filtrado.length
      ? filtrado.map((h) => `
          <tr>
            <td>${UI.formatoFecha(h.fecha)}</td>
            <td>${UI.escapar(h.usuario)}</td>
            <td><strong>[${UI.escapar(h.elemento)}]</strong></td>
            <td>${UI.escapar(h.valorAnterior)}</td>
            <td>${UI.escapar(h.valorNuevo)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="texto-suave">Sin coincidencias en el historial.</td></tr>';
  }

  if (inputBuscarHistorial) {
    inputBuscarHistorial.addEventListener('input', renderizarHistorial);
  }
  if (selectFiltroElemento) {
    selectFiltroElemento.addEventListener('change', renderizarHistorial);
  }

  // ---------- Repintado principal (Carga) ----------
  async function pintar() {
    const r = id ? await Api.get(`/api/projects/${encodeURIComponent(id)}`) : { ok: false, status: 404, datos: { mensaje: 'Falta indicar el proyecto.' } };
    if (!r.ok) {
      document.getElementById('sin-acceso-titulo').textContent = r.status === 403 ? 'Acceso no autorizado' : 'Proyecto no encontrado';
      document.getElementById('sin-acceso-texto').textContent = r.datos?.mensaje || 'No se pudo cargar el proyecto.';
      document.getElementById('sin-acceso').hidden = false;
      document.getElementById('contenido').hidden = true;
      return false;
    }
    
    const { proyecto: p, permisos, miRol, historial, historiasUsuario, developers } = r.datos;
    developersProyecto = developers || [];
    actual = p;
    
    // Cargar la Definition of Done antes del renderizado (HU-36)
    await cargarDod();
    document.title = `${p.nombre} | Scrum Manager`;
    document.getElementById('nombre').textContent = p.nombre;
    document.getElementById('id-proyecto').textContent = p.id;
    document.getElementById('estado-insignia').innerHTML = UI.insigniaProyecto(p.estado);
    document.getElementById('archivado-insignia').innerHTML = p.archivado ? '<span class="insignia insignia--suspendido">Archivado</span>' : '';
    
    document.getElementById('estados').innerHTML = ESTADOS.map(([clave, texto, icono]) => `
      <div class="estado-opcion ${clave === p.estado ? 'actual' : ''}">
        <span class="icono-estado">${Icons.get(icono, 20)}</span>${texto}
      </div>`).join('');
      
    const finalizado = p.estado === 'finalizado';
    const botones = [];
    if (!p.archivado) {
      if (permisos.cambiarEstado && !finalizado) botones.push('<button class="btn btn-primario" data-accion="estado">Cambiar estado</button>');
      if (permisos.finalizar && !finalizado && p.estado !== 'preparacion') botones.push('<button class="btn btn-peligro" data-accion="finalizar">Finalizar proyecto</button>');
      if (permisos.reabrir && finalizado) botones.push('<button class="btn btn-secundario" data-accion="reabrir">Reabrir proyecto</button>');
      if (permisos.editar) botones.push(`<a class="btn btn-secundario" href="/proyectos/editar?id=${encodeURIComponent(p.id)}">Editar</a>`);
      if (permisos.archivar) botones.push('<button class="btn btn-secundario" data-accion="archivar">Archivar</button>');
    } else if (permisos.archivar) {
      botones.push('<button class="btn btn-secundario" data-accion="desarchivar">Desarchivar</button>');
    }
    document.getElementById('acciones').innerHTML = botones.join('');
    
    const aviso = document.getElementById('aviso-rol');
    if (!botones.length) {
      aviso.innerHTML = `${Icons.get('info', 20)}<span>Tu rol (${UI.escapar(miRol)}) permite consultar pero no modificar.</span>`;
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }
    
    document.getElementById('info').innerHTML = `
      <div><dt>Descripción</dt><dd>${UI.escapar(p.descripcion)}</dd></div>
      <div><dt>Objetivo</dt><dd>${UI.escapar(p.objetivo)}</dd></div>
      <div><dt>Fechas previstas</dt><dd>${UI.rangoFechas(p.fechaInicio, p.fechaFin)}</dd></div>
      <div><dt>Tu rol</dt><dd>${UI.insigniaRol(miRol === 'administrador' ? 'Administrador general' : miRol)}</dd></div>`;
      
    dibujarHistorias(historiasUsuario, permisos, p.archivado);
    dibujarSprints(r.datos.sprints || [], miRol, permisos, p.archivado);
    dibujarTableroScrum(r.datos.sprints || [], miRol, p.archivado);
    
    // HU-38: Cargar historial estructurado y renderizar con filtros
    historialActual = historial || [];
    renderizarHistorial();
      
    document.getElementById('contenido').hidden = false;
    await cargarEquipo(p.id, miRol);
    Icons.hidratar();
    return true;
  }

  document.getElementById('acciones').addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton || !actual) return;
    const base = `/api/projects/${encodeURIComponent(actual.id)}`;
    let peticion;
    switch (boton.dataset.accion) {
      case 'estado': {
        const siguiente = SIGUIENTE[actual.estado];
        if (!siguiente) return UI.toast('Este estado no admite cambios directos.', 'info');
        const ok = await UI.confirmar({ titulo: 'Cambiar estado', mensaje: `¿Pasar a "${NOMBRES[siguiente]}"?`, textoOk: 'Cambiar' });
        if (!ok) return;
        peticion = () => Api.put(`${base}/estado`, { estado: siguiente });
        break;
      }
      case 'finalizar': {
        const ok = await UI.confirmar({ titulo: 'Finalizar', mensaje: 'Se finalizará el proyecto.', textoOk: 'Finalizar', peligro: true });
        if (!ok) return;
        peticion = () => Api.put(`${base}/finalizar`);
        break;
      }
      case 'reabrir': {
        const ok = await UI.confirmar({ titulo: 'Reabrir', mensaje: 'Se reactivará el proyecto.', textoOk: 'Reabrir' });
        if (!ok) return;
        peticion = () => Api.put(`${base}/reabrir`);
        break;
      }
      case 'archivar':
      case 'desarchivar': {
        const archivar = boton.dataset.accion === 'archivar';
        const ok = await UI.confirmar({ titulo: archivar ? 'Archivar' : 'Desarchivar', mensaje: 'Cambiará su visibilidad.', textoOk: archivar ? 'Archivar' : 'Desarchivar' });
        if (!ok) return;
        peticion = () => Api.put(`${base}/archivar`, { archivado: archivar });
        break;
      }
      default: return;
    }
    UI.cargando(boton, true);
    const r = await peticion();
    UI.cargando(boton, false);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error.', 'error');
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  document.getElementById('agregar-historia-division').addEventListener('click', () => {
    const numero = historiasDivision.children.length + 1;
    const fila = document.createElement('article');
    fila.className = 'historia-division__item';
    fila.innerHTML = `
      <div class="historia-criterio__encabezado">
        <strong class="historia-criterio__titulo">Historia resultante ${numero}</strong>
        <button class="btn btn-texto btn-chico" type="button" data-quitar-division ${numero <= 2 ? 'hidden' : ''}>Quitar</button>
      </div>
      <div class="campo">
        <input class="control" data-division-titulo maxlength="160" placeholder="Título" required>
      </div>
      <div class="campo">
        <textarea class="control" data-division-descripcion placeholder="Descripción" required></textarea>
      </div>
      <div class="campo">
        <select class="control" data-division-estimacion>
          <option value="">Sin estimar</option><option value="XS">XS</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option>
        </select>
      </div>`;
    historiasDivision.appendChild(fila);
    [...historiasDivision.querySelectorAll('[data-quitar-division]')].forEach((b) => b.hidden = historiasDivision.children.length <= 2);
  });

  document.getElementById('cancelar-division').addEventListener('click', () => {
    historiaParaDividir = null;
    divisionContenedor.hidden = true;
    historiasDivision.replaceChildren();
  });

  historiasDivision.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar-division]');
    if (boton && historiasDivision.children.length > 2) {
      boton.closest('.historia-division__item').remove();
      [...historiasDivision.querySelectorAll('[data-quitar-division]')].forEach((i) => i.hidden = historiasDivision.children.length <= 2);
    }
  });

  document.getElementById('formulario-division').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!actual || !historiaParaDividir) return;
    const historias = [...historiasDivision.querySelectorAll('.historia-division__item')].map((f) => ({
      titulo: f.querySelector('[data-division-titulo]').value.trim(),
      descripcion: f.querySelector('[data-division-descripcion]').value.trim(),
      estimacion: f.querySelector('[data-division-estimacion]').value || null
    }));
    const r = await Api.post(`/api/projects/${encodeURIComponent(actual.id)}/historias/${encodeURIComponent(historiaParaDividir)}/divisiones`, { historias });
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error.', 'error');
    historiaParaDividir = null;
    divisionContenedor.hidden = true;
    historiasDivision.replaceChildren();
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  document.getElementById('agregar-criterio').addEventListener('click', () => agregarCriterio());
  criteriosFormulario.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar-criterio]');
    if (boton) boton.closest('.historia-criterio').remove();
  });

  document.getElementById('agregar-tarea').addEventListener('click', () => agregarTarea());
  tareasFormulario.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar-tarea]');
    if (boton) boton.closest('.historia-tarea').remove();
  });

  document.getElementById('cancelar-edicion-historia').addEventListener('click', reiniciarFormularioHistoria);

  formularioHistoria.addEventListener('submit', async (e) => {
    e.preventDefault();
    const criterios = [...criteriosFormulario.querySelectorAll('.historia-criterio')]
      .map((fila) => ({
        ...(fila.dataset.id ? { id: fila.dataset.id } : {}),
        dado: fila.querySelector('[data-campo="dado"]').value.trim(),
        cuando: fila.querySelector('[data-campo="cuando"]').value.trim(),
        entonces: fila.querySelector('[data-campo="entonces"]').value.trim()
      }))
      .filter((criterio) => criterio.dado || criterio.cuando || criterio.entonces);
      
    const tareas = [...tareasFormulario.querySelectorAll('.historia-tarea')]
      .map((fila) => ({
        ...(fila.dataset.id ? { id: fila.dataset.id } : {}),
        titulo: fila.querySelector('[data-campo-tarea="titulo"]').value.trim(),
        descripcion: fila.querySelector('[data-campo-tarea="descripcion"]').value.trim(),
        estado: fila.querySelector('[data-campo-tarea="estado"]').value,
        horasEstimadas: Number(fila.querySelector('[data-campo-tarea="horasEstimadas"]').value) || 1,
        idResponsable: fila.querySelector('[data-campo-tarea="idResponsable"]').value
      }))
      .filter((tarea) => tarea.titulo || tarea.descripcion || tarea.idResponsable);

    for (const t of tareas) {
      if (!t.titulo || !t.descripcion || !t.idResponsable || isNaN(t.horasEstimadas) || t.horasEstimadas <= 0) {
        UI.toast('Cada tarea debe incluir título, descripción y tener asignado un developer responsable.', 'error');
        return;
      }
    }

    const datos = {
      titulo: document.getElementById('historia-titulo').value.trim(),
      descripcion: document.getElementById('historia-descripcion').value.trim(),
      estimacion: document.getElementById('historia-estimacion').value || null,
      dependencias: [...dependenciasFormulario.selectedOptions].map((opcion) => opcion.value),
      responsableOrganizativo: document.getElementById('historia-responsable').value.trim(),
      ...(historiaEditando ? { aclaracion: document.getElementById('historia-aclaracion').value.trim() } : {}),
      criterios,
      tareas
    };

    const url = `/api/projects/${encodeURIComponent(actual.id)}/historias${historiaEditando ? `/${encodeURIComponent(historiaEditando)}` : ''}`;
    const r = historiaEditando ? await Api.put(url, datos) : await Api.post(url, datos);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error.', 'error');
    reiniciarFormularioHistoria();
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  listaHistorias.addEventListener('click', async (e) => {
    const botonMover = e.target.closest('[data-mover-historia]');
    if (botonMover && actual) {
      const origen = Number(botonMover.dataset.moverHistoria);
      const destino = origen + Number(botonMover.dataset.direccion);
      if (destino < 0 || destino >= historiasActuales.length) return;
      const ids = historiasActuales.map((historia) => historia.id);
      [ids[origen], ids[destino]] = [ids[destino], ids[origen]];
      const r = await Api.put(`/api/projects/${encodeURIComponent(actual.id)}/historias/orden`, { ids });
      if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error.', 'error');
      await pintar();
      return;
    }
    
    const botonDividir = e.target.closest('[data-dividir-historia]');
    if (botonDividir) {
      const historia = historiasActuales.find((item) => item.id === botonDividir.dataset.dividirHistoria);
      if (!historia) return;
      historiaParaDividir = historia.id;
      document.getElementById('division-titulo').textContent = `Dividir ${historia.id}`;
      document.getElementById('division-origen').textContent = historia.titulo;
      historiasDivision.replaceChildren();
      document.getElementById('agregar-historia-division').click();
      document.getElementById('agregar-historia-division').click();
      divisionContenedor.hidden = false;
      divisionContenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    
    const boton = e.target.closest('[data-editar-historia]');
    if (!boton) return;
    const historia = historiasActuales.find((item) => item.id === boton.dataset.editarHistoria);
    if (!historia) return;
    
    historiaEditando = historia.id;
    document.getElementById('historia-titulo').value = historia.titulo;
    document.getElementById('historia-descripcion').value = historia.descripcion;
    document.getElementById('historia-estimacion').value = historia.estimacion || '';
    document.getElementById('historia-responsable').value = historia.responsableOrganizativo || '';
    actualizarOpcionesDependencias(historia.dependencias || [], historia.id);
    document.getElementById('historia-aclaracion').value = '';
    document.getElementById('aclaracion-refinamiento').hidden = false;
    
    criteriosFormulario.replaceChildren();
    (historia.criterios || []).forEach((criterio) => agregarCriterio(criterio));
    tareasFormulario.replaceChildren();
    (historia.tareas || []).forEach((tarea) => agregarTarea(tarea));
    
    document.getElementById('guardar-historia').textContent = 'Guardar cambios';
    document.getElementById('cancelar-edicion-historia').hidden = false;
    formularioContenedor.hidden = false;
    formularioHistoria.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  listaHistorias.addEventListener('submit', async (e) => {
    const formulario = e.target.closest('[data-comentar-historia]');
    if (!formulario || !actual) return;
    e.preventDefault();
    const historiaId = formulario.dataset.comentarHistoria;
    const texto = new FormData(formulario).get('texto');
    const r = await Api.post(`/api/projects/${encodeURIComponent(actual.id)}/historias/${encodeURIComponent(historiaId)}/comentarios`, { texto });
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error.', 'error');
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  document.getElementById('acciones').addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton || !actual) return;
  });

  await pintar();
})();

async function agregarParticipanteConRol(proyectoId) {
  const usuarioId = document.getElementById('select-usuario').value;
  const rolScrum = document.getElementById('select-rol').value;
  try {
    const respuesta = await fetch('/api/equipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idProyecto: proyectoId, idUsuario: usuarioId, rol: rolScrum })
    });
    const resultado = await respuesta.json();
    if (respuesta.ok) {
      alert('Participante y rol registrados correctamente.');
      location.reload(); 
    } else {
      alert(`Error: ${resultado.error}`);
    }
  } catch (error) {
    console.error('Error de red al agregar participante:', error);
  }
}

async function cargarEquipo(proyectoId, miRol) {
  try {
    const respuesta = await fetch(`/api/equipos/proyectos/${proyectoId}/participantes`);
    const equipo = await respuesta.json();
    const contenedorLista = document.getElementById('lista-equipo');
    if (contenedorLista) {
      if (Array.isArray(equipo) && equipo.length > 0) {
        contenedorLista.innerHTML = equipo.map(m => `
          <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
            Usuario: <strong>${m.usuarioId || m.id || 'N/A'}</strong> 
            Rol: <span class="insignia">${m.rolScrum || m.rol || 'Sin rol'}</span> 
            (${m.estado || 'Activo'})
          </li>
        `).join('');
      } else {
        contenedorLista.innerHTML = '<li class="texto-suave">Sin participantes registrados en este proyecto.</li>';
      }
    }
    if (miRol === 'Interesado') {
      document.querySelectorAll('.controles-edicion').forEach(control => control.style.display = 'none');
    }
  } catch (error) {
    console.error('Error al cargar el equipo:', error);
  }
}