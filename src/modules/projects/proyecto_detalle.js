(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const flash = sessionStorage.getItem('flash');
  if (flash) { sessionStorage.removeItem('flash'); UI.toast(flash, 'exito'); }

  const id = new URLSearchParams(window.location.search).get('id');

  // Los cuatro estados, con el actual resaltado
  const ESTADOS = [
    ['preparacion', 'En preparación', 'reloj'], ['activo', 'Activo', 'rayo'],
    ['suspendido', 'Suspendido', 'pausa'], ['finalizado', 'Finalizado', 'check']
  ];
  const NOMBRES = { preparacion: 'En preparación', activo: 'Activo', suspendido: 'Suspendido', finalizado: 'Finalizado' };
  // Estado al que lleva "Cambiar estado" (el servidor vuelve a validar la transición)
  const SIGUIENTE = { preparacion: 'activo', activo: 'suspendido', suspendido: 'activo' };

  let actual = null; // proyecto mostrado en pantalla
  let historiasActuales = [];
  let historiaEditando = null;

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
    const estadoActual = tarea.estado || 'Pendiente';
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
          <input class="control" id="tarea-${numero}-titulo" data-campo-tarea="titulo" maxlength="160" placeholder="Ej.: Diseñar tabla o endpoint" value="${UI.escapar(tarea.titulo || '')}" required>
        </div>
        <div class="campo">
          <label for="tarea-${numero}-descripcion">Descripción</label>
          <textarea class="control" id="tarea-${numero}-descripcion" data-campo-tarea="descripcion" placeholder="Detalle de la tarea a realizar" required>${UI.escapar(tarea.descripcion || '')}</textarea>
        </div>
        <div class="campo">
          <label for="tarea-${numero}-estado">Estado</label>
          <select class="control" id="tarea-${numero}-estado" data-campo-tarea="estado">
            <option value="Pendiente" ${estadoActual === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="En progreso" ${estadoActual === 'En progreso' ? 'selected' : ''}>En progreso</option>
            <option value="Completada" ${estadoActual === 'Completada' ? 'selected' : ''}>Completada</option>
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
        opcion.textContent = `${historia.id} · ${historia.titulo}`;
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
                <button class="btn btn-secundario btn-chico" type="button" data-mover-historia="${indice}" data-direccion="-1" aria-label="Subir prioridad de ${UI.escapar(historia.id)}" ${indice === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn btn-secundario btn-chico" type="button" data-mover-historia="${indice}" data-direccion="1" aria-label="Bajar prioridad de ${UI.escapar(historia.id)}" ${indice === historiasActuales.length - 1 ? 'disabled' : ''}>↓</button>
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
                return `<span class="historia-relacion">${UI.escapar(idDependencia)}${dependencia ? ` · ${UI.escapar(dependencia.titulo)}` : ''}</span>`;
              }).join('')
              : '<span class="historia-vacio">Sin dependencias</span>'}</td>
            <td class="historia-responsable">${UI.escapar(historia.responsableOrganizativo || 'Sin responsable')}</td>
            <td>${criterios.length
              ? `<details class="historia-tabla__criterios">
                  <summary>Ver ${criterios.length} ${criterios.length === 1 ? 'criterio' : 'criterios'}</summary>
                  <ol class="historia-criterios-lista">${criterios.map((criterio) => `
                  <li><strong>Dado:</strong> ${UI.escapar(criterio.dado)}; <strong>Cuando:</strong> ${UI.escapar(criterio.cuando)}; <strong>Entonces:</strong> ${UI.escapar(criterio.entonces)}</li>
                  `).join('')}</ol>
                </details>`
              : '<span class="historia-vacio">Sin criterios</span>'}</td>
            <td>${tareas.length
              ? `<details class="historia-tabla__criterios">
                  <summary>Ver ${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}</summary>
                  <ol class="historia-criterios-lista">${tareas.map((tarea) => `
                  <li><strong>${UI.escapar(tarea.id ? `${tarea.id} · ` : '')}${UI.escapar(tarea.titulo)}</strong> (${UI.escapar(tarea.estado || 'Pendiente')}): ${UI.escapar(tarea.descripcion)}</li>
                  `).join('')}</ol>
                </details>`
              : '<span class="historia-vacio">Sin tareas</span>'}</td>
            <td class="historia-comentarios">
              ${comentarios.length
                ? `<details>
                    <summary>Ver ${comentarios.length} ${comentarios.length === 1 ? 'comentario' : 'comentarios'}</summary>
                    <ul class="historia-comentarios__lista">${comentarios.map((comentario) => `
                      <li class="historia-comentarios__item">
                        <strong>${UI.escapar(comentario.usuario)}</strong> · <time>${UI.formatoFecha(comentario.fecha)}</time>
                        <p>${UI.escapar(comentario.texto)}</p>
                      </li>`).join('')}
                    </ul>
                  </details>`
                : '<span class="historia-vacio">Sin comentarios</span>'}
              ${permisos.comentarHistorias && !archivado ? `
                <form class="historia-comentarios__formulario" data-comentar-historia="${UI.escapar(historia.id)}">
                  <textarea class="control" name="texto" maxlength="2000" aria-label="Comentario para ${UI.escapar(historia.id)}" placeholder="Escribe un comentario..." required></textarea>
                  <button class="btn btn-secundario btn-chico" type="submit">Comentar</button>
                </form>` : ''}
            </td>
            <td>${aclaraciones.length
              ? `<details>
                  <summary>Ver ${aclaraciones.length} ${aclaraciones.length === 1 ? 'aclaración' : 'aclaraciones'}</summary>
                  <ul class="historia-comentarios__lista">${aclaraciones.map((aclaracion) => `
                    <li class="historia-comentarios__item">
                      <strong>${UI.escapar(aclaracion.usuario)}</strong> · <time>${UI.formatoFecha(aclaracion.fecha)}</time>
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
              ${!permisos.refinarHistorias && !permisos.gestionarHistorias ? '—' : ''}
            </td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="12" class="historia-vacio">Todavía no hay historias registradas en este proyecto.</td></tr>';
  }

  const ROLES_DEFINIR_SPRINT = ['administrador', 'Product Owner', 'Developer'];
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
      sprintHistoriasLista.innerHTML = '<p class="historia-vacio">Todavía no hay historias en el Product Backlog de este proyecto para seleccionar.</p>';
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
          ${historia.estimacion ? `<span class="insignia historia-estimacion">Talla ${UI.escapar(historia.estimacion)}</span>` : ''}
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
                  <summary>Ver ${historiasAsignadas.length} ${historiasAsignadas.length === 1 ? 'historia' : 'historias'}</summary>
                  <ul class="historia-criterios-lista">${historiasAsignadas.map((idHistoria) => {
                    const h = historiasActuales.find((item) => item.id === idHistoria);
                    const tareasHistoria = h?.tareas || [];
                    const listaTareas = tareasHistoria.length
                      ? `<ul class="sprint-historia-tareas">${tareasHistoria.map((t) => `<li>${UI.escapar(typeof t === 'string' ? t : t.titulo)}</li>`).join('')}</ul>`
                      : '';
                    return `<li><strong>${UI.escapar(idHistoria)}</strong>${h ? ` · ${UI.escapar(h.titulo)}` : ''}${listaTareas}</li>`;
                  }).join('')}</ul>
                </details>`
              : '<span class="historia-vacio">Sin historias asignadas</span>'}</td>
            <td class="historia-acciones">
              ${puedeDefinirSprint
                ? `<button class="btn btn-secundario btn-chico" type="button" data-editar-sprint="${UI.escapar(sprint.id)}">Editar</button>`
                : '—'}
            </td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="8" class="historia-vacio">Todavía no hay sprints registrados en este proyecto.</td></tr>';
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
      const hoy = fechaActualLocal();

      let valido = true;
      if (!nombre) {
        UI.marcarError(sprintNombreInput, 'El nombre del sprint es obligatorio.');
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
          UI.marcarError(sprintEstadoSelect, 'Ya existe un sprint en curso en este proyecto. Solo puede haber uno a la vez.');
          valido = false;
        }
      }
      if (!objetivo) {
        UI.marcarError(sprintObjetivoInput, 'El objetivo del sprint es obligatorio.');
        valido = false;
      }
      if (!fechaInicio) {
        UI.marcarError(sprintInicioInput, 'Selecciona la fecha de inicio.');
        valido = false;
      } else if (fechaInicio < hoy) {
        UI.marcarError(sprintInicioInput, 'La fecha de inicio debe ser como mínimo la fecha actual.');
        valido = false;
      }
      if (!fechaFin) {
        UI.marcarError(sprintFinInput, 'Selecciona la fecha de fin.');
        valido = false;
      } else if (fechaFin < hoy) {
        UI.marcarError(sprintFinInput, 'La fecha de fin debe ser como mínimo la fecha actual.');
        valido = false;
      } else if (fechaInicio && fechaFin < fechaInicio) {
        UI.marcarError(sprintFinInput, 'La fecha de fin no puede ser anterior a la fecha de inicio.');
        valido = false;
      }

      if (!valido) return;

      UI.cargando(botonGuardarSprint, true);
      const datosSprint = {
        nombre,
        objetivo,
        fechaInicio,
        fechaFin,
        estado,
        historiasAsignadas: [...historiasAsignadasSprint]
      };

      const url = `/api/projects/${encodeURIComponent(actual.id)}/sprints${sprintEditando ? `/${encodeURIComponent(sprintEditando)}` : ''}`;
      const r = sprintEditando ? await Api.put(url, datosSprint) : await Api.post(url, datosSprint);
      UI.cargando(botonGuardarSprint, false);

      if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo guardar el sprint.', 'error');
      reiniciarFormularioSprint();
      await pintar();
      UI.toast(r.datos.mensaje, 'exito');
    });
  }

  if (botonCancelarSprint) {
    botonCancelarSprint.addEventListener('click', reiniciarFormularioSprint);
  }

  if (listaSprints) {
    listaSprints.addEventListener('click', (e) => {
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

  function agregarHistoriaDivision() {
    const numero = historiasDivision.children.length + 1;
    const fila = document.createElement('article');
    fila.className = 'historia-division__item';
    fila.innerHTML = `
      <div class="historia-criterio__encabezado">
        <strong class="historia-criterio__titulo">Historia resultante ${numero}</strong>
        <button class="btn btn-texto btn-chico" type="button" data-quitar-division ${numero <= 2 ? 'hidden' : ''}>Quitar</button>
      </div>
      <div class="campo">
        <label>Título</label>
        <input class="control" data-division-titulo maxlength="160" required>
      </div>
      <div class="campo">
        <label>Descripción</label>
        <textarea class="control" data-division-descripcion placeholder="Como [rol], quiero [necesidad], para [beneficio]." required></textarea>
      </div>
      <div class="campo">
        <label>Estimación relativa</label>
        <select class="control" data-division-estimacion>
          <option value="">Sin estimar</option>
          <option value="XS">XS</option>
          <option value="S">S</option>
          <option value="M">M</option>
          <option value="L">L</option>
          <option value="XL">XL</option>
        </select>
        <span class="campo__ayuda">Tallas categóricas; no se suman como puntos.</span>
      </div>`;
    historiasDivision.appendChild(fila);
    [...historiasDivision.querySelectorAll('[data-quitar-division]')].forEach((boton) => {
      boton.hidden = historiasDivision.children.length <= 2;
    });
  }

  function cerrarDivision() {
    historiaParaDividir = null;
    divisionContenedor.hidden = true;
    historiasDivision.replaceChildren();
  }

  document.getElementById('agregar-historia-division').addEventListener('click', agregarHistoriaDivision);
  document.getElementById('cancelar-division').addEventListener('click', cerrarDivision);
  historiasDivision.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar-division]');
    if (boton && historiasDivision.children.length > 2) {
      boton.closest('.historia-division__item').remove();
      [...historiasDivision.querySelectorAll('[data-quitar-division]')].forEach((item) => {
        item.hidden = historiasDivision.children.length <= 2;
      });
    }
  });
  document.getElementById('formulario-division').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!actual || !historiaParaDividir) return;
    const historias = [...historiasDivision.querySelectorAll('.historia-division__item')].map((fila) => ({
      titulo: fila.querySelector('[data-division-titulo]').value.trim(),
      descripcion: fila.querySelector('[data-division-descripcion]').value.trim(),
      estimacion: fila.querySelector('[data-division-estimacion]').value || null
    }));
    const r = await Api.post(
      `/api/projects/${encodeURIComponent(actual.id)}/historias/${encodeURIComponent(historiaParaDividir)}/divisiones`,
      { historias }
    );
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudieron crear las divisiones.', 'error');
    cerrarDivision();
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
        estado: fila.querySelector('[data-campo-tarea="estado"]').value
      }))
      .filter((tarea) => tarea.titulo || tarea.descripcion);
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
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo guardar la historia.', 'error');
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
      if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo actualizar la prioridad.', 'error');
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
      agregarHistoriaDivision();
      agregarHistoriaDivision();
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
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo agregar el comentario.', 'error');
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  // Carga el proyecto y dibuja la pantalla. Se vuelve a llamar después de cada acción.
  async function pintar() {
    const r = id ? await Api.get(`/api/projects/${encodeURIComponent(id)}`) : { ok: false, status: 404, datos: { mensaje: 'Falta indicar el proyecto.' } };

    if (!r.ok) {
      document.getElementById('sin-acceso-titulo').textContent = r.status === 403 ? 'Acceso no autorizado' : 'Proyecto no encontrado';
      document.getElementById('sin-acceso-texto').textContent = r.datos?.mensaje || 'No se pudo cargar el proyecto.';
      document.getElementById('sin-acceso').hidden = false;
      document.getElementById('contenido').hidden = true;
      document.getElementById('nombre').textContent = 'Proyecto';
      Icons.hidratar();
      return false;
    }

    const { proyecto: p, permisos, miRol, historial, historiasUsuario } = r.datos;
    actual = p;

    // Encabezado
    document.title = `${p.nombre} · Scrum Manager`;
    document.getElementById('nombre').textContent = p.nombre;
    document.getElementById('id-proyecto').textContent = p.id;
    document.getElementById('estado-insignia').innerHTML = UI.insigniaProyecto(p.estado);
    document.getElementById('archivado-insignia').innerHTML = p.archivado ? '<span class="insignia insignia--suspendido">Archivado</span>' : '';

    document.getElementById('estados').innerHTML = ESTADOS.map(([clave, texto, icono]) => `
      <div class="estado-opcion ${clave === p.estado ? 'actual' : ''}" ${clave === p.estado ? 'aria-current="true"' : ''}>
        <span class="icono-estado">${Icons.get(icono, 20)}</span>${texto}
      </div>`).join('');

    // Solo se muestran las acciones que el rol permite (el servidor las vuelve a verificar al ejecutarlas)
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
      aviso.innerHTML = `${Icons.get('info', 20)}<span>Tu rol en este proyecto (${UI.escapar(miRol)}) permite consultarlo, no modificarlo.</span>`;
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }

    // Información general
    document.getElementById('info').innerHTML = `
      <div><dt>Descripción</dt><dd>${UI.escapar(p.descripcion)}</dd></div>
      <div><dt>Objetivo</dt><dd>${UI.escapar(p.objetivo)}</dd></div>
      <div><dt>Fechas previstas</dt><dd>${UI.rangoFechas(p.fechaInicio, p.fechaFin)}</dd></div>
      <div><dt>Tu rol</dt><dd>${UI.insigniaRol(miRol === 'administrador' ? 'Administrador general' : miRol)}</dd></div>`;

    dibujarHistorias(historiasUsuario, permisos, p.archivado);
    dibujarSprints(r.datos.sprints || [], miRol, permisos, p.archivado);

    // Historial
    document.getElementById('historial').innerHTML = historial.length
      ? historial.map((h) => `<tr><td>${UI.formatoFecha(h.fecha)}</td><td>${UI.escapar(h.usuario)}</td><td>${UI.escapar(h.cambio)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="texto-suave">Todavía no hay cambios registrados.</td></tr>';

    // Mostrar contenido, cargar equipo y renderizar iconos
    document.getElementById('contenido').hidden = false;
    await cargarEquipo(p.id, miRol);
    Icons.hidratar();
    return true;
  }

  // Acciones del proyecto (HU-11, HU-12, HU-13). Se registra una sola vez.
  document.getElementById('acciones').addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton || !actual) return;
    const base = `/api/projects/${encodeURIComponent(actual.id)}`;
    let peticion;

    switch (boton.dataset.accion) {
      case 'estado': {
        const siguiente = SIGUIENTE[actual.estado];
        if (!siguiente) return UI.toast('Este estado no admite cambios directos.', 'info');
        const ok = await UI.confirmar({
          titulo: 'Cambiar estado',
          mensaje: `El proyecto pasará de "${NOMBRES[actual.estado]}" a "${NOMBRES[siguiente]}".`,
          textoOk: 'Cambiar'
        });
        if (!ok) return;
        peticion = () => Api.put(`${base}/estado`, { estado: siguiente });
        break;
      }
      case 'finalizar': {
        const ok = await UI.confirmar({
          titulo: 'Finalizar proyecto',
          mensaje: 'El proyecto quedará marcado como finalizado. Podrás reabrirlo después sin perder sus registros.',
          textoOk: 'Finalizar', peligro: true
        });
        if (!ok) return;
        peticion = () => Api.put(`${base}/finalizar`);
        break;
      }
      case 'reabrir': {
        const ok = await UI.confirmar({
          titulo: 'Reabrir proyecto',
          mensaje: 'El proyecto volverá a estar activo y conservará todos sus registros anteriores.',
          textoOk: 'Reabrir'
        });
        if (!ok) return;
        peticion = () => Api.put(`${base}/reabrir`);
        break;
      }
      case 'archivar':
      case 'desarchivar': {
        const archivar = boton.dataset.accion === 'archivar';
        const ok = await UI.confirmar({
          titulo: archivar ? 'Archivar proyecto' : 'Desarchivar proyecto',
          mensaje: archivar
            ? 'El proyecto dejará de aparecer en la lista activa. Su información se conserva.'
            : 'El proyecto volverá a aparecer en la lista activa.',
          textoOk: archivar ? 'Archivar' : 'Desarchivar'
        });
        if (!ok) return;
        peticion = () => Api.put(`${base}/archivar`, { archivado: archivar });
        break;
      }
      default:
        return;
    }

    UI.cargando(boton, true);
    const r = await peticion();
    UI.cargando(boton, false);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo completar la acción.', 'error');
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  await pintar();
})();

// Función para ejecutar HU-14 y HU-15 desde la interfaz
async function agregarParticipanteConRol(proyectoId) {
    const usuarioId = document.getElementById('select-usuario').value;
    const rolScrum = document.getElementById('select-rol').value; 

    try {
        const respuesta = await fetch('/api/equipos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            idProyecto: proyectoId, 
            idUsuario: usuarioId, 
            rol: rolScrum 
          })
        });
        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert('Participante y rol registrados correctamente.');
            // Recargar la lista del equipo en pantalla tras agregar uno nuevo
            location.reload(); 
        } else {
            alert(`Error: ${resultado.error}`);
        }
    } catch (error) {
        console.error('Error de red al agregar participante:', error);
    }
}

// Función para ejecutar HU-16 y HU-17 (Consultar equipo y restringir interesados)
async function cargarEquipo(proyectoId, miRol) {
    try {
        const respuesta = await fetch(`/api/equipos/proyectos/${proyectoId}/participantes`);
        const equipo = await respuesta.json();
        
        const contenedorLista = document.getElementById('lista-equipo');
        if (contenedorLista) {
            if (Array.isArray(equipo) && equipo.length > 0) {
                contenedorLista.innerHTML = equipo.map(m => `
                    <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                        Usuario: <strong>${m.usuarioId || m.id || 'N/A'}</strong> — 
                        Rol: <span class="insignia">${m.rolScrum || m.rol || 'Sin rol'}</span> 
                        (${m.estado || 'Activo'})
                    </li>
                `).join('');
            } else {
                contenedorLista.innerHTML = '<li class="texto-suave">Sin participantes registrados en este proyecto.</li>';
            }
        }

        // HU-17: Dar acceso limitado a interesados (oculta controles de edición)
        if (miRol === 'Interesado') {
            const controlesEdicion = document.querySelectorAll('.controles-edicion');
            controlesEdicion.forEach(control => control.style.display = 'none');
        }
    } catch (error) {
        console.error('Error al cargar el equipo:', error);
    }
}