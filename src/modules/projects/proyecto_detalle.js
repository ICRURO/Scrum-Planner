// Detalle del proyecto: estado, acciones permitidas, información general e historial

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
  const listaHistorias = document.getElementById('lista-historias');

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

  function reiniciarFormularioHistoria() {
    formularioHistoria.reset();
    criteriosFormulario.replaceChildren();
    historiaEditando = null;
    document.getElementById('guardar-historia').textContent = 'Registrar historia';
    document.getElementById('cancelar-edicion-historia').hidden = true;
  }

  function dibujarHistorias(historias, puedeGestionar, archivado) {
    historiasActuales = historias || [];
    formularioContenedor.hidden = !puedeGestionar || archivado;
    listaHistorias.innerHTML = historiasActuales.length
      ? historiasActuales.map((historia) => {
        const criterios = historia.criterios || [];
        return `
          <tr>
            <td><span class="insignia">${UI.escapar(historia.id)}</span></td>
            <td><strong>${UI.escapar(historia.titulo)}</strong></td>
            <td class="historia-tabla__descripcion">${UI.escapar(historia.descripcion)}</td>
            <td>${criterios.length
              ? `<details class="historia-tabla__criterios">
                  <summary>Ver ${criterios.length} ${criterios.length === 1 ? 'criterio' : 'criterios'}</summary>
                  <ol class="historia-criterios-lista">${criterios.map((criterio) => `
                  <li><strong>Dado:</strong> ${UI.escapar(criterio.dado)}; <strong>Cuando:</strong> ${UI.escapar(criterio.cuando)}; <strong>Entonces:</strong> ${UI.escapar(criterio.entonces)}</li>
                  `).join('')}</ol>
                </details>`
              : '<span class="historia-vacio">Sin criterios</span>'}</td>
            <td>${puedeGestionar && !archivado
              ? `<button class="btn btn-secundario btn-chico" type="button" data-editar-historia="${UI.escapar(historia.id)}">Editar</button>`
              : '—'}</td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="5" class="historia-vacio">Todavía no hay historias registradas en este proyecto.</td></tr>';
  }

  document.getElementById('agregar-criterio').addEventListener('click', () => agregarCriterio());
  criteriosFormulario.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar-criterio]');
    if (boton) boton.closest('.historia-criterio').remove();
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
    const datos = {
      titulo: document.getElementById('historia-titulo').value.trim(),
      descripcion: document.getElementById('historia-descripcion').value.trim(),
      criterios
    };
    const url = `/api/projects/${encodeURIComponent(actual.id)}/historias${historiaEditando ? `/${encodeURIComponent(historiaEditando)}` : ''}`;
    const r = historiaEditando ? await Api.put(url, datos) : await Api.post(url, datos);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo guardar la historia.', 'error');
    reiniciarFormularioHistoria();
    await pintar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  listaHistorias.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-editar-historia]');
    if (!boton) return;
    const historia = historiasActuales.find((item) => item.id === boton.dataset.editarHistoria);
    if (!historia) return;
    historiaEditando = historia.id;
    document.getElementById('historia-titulo').value = historia.titulo;
    document.getElementById('historia-descripcion').value = historia.descripcion;
    criteriosFormulario.replaceChildren();
    (historia.criterios || []).forEach((criterio) => agregarCriterio(criterio));
    document.getElementById('guardar-historia').textContent = 'Guardar cambios';
    document.getElementById('cancelar-edicion-historia').hidden = false;
    formularioContenedor.hidden = false;
    formularioHistoria.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    dibujarHistorias(historiasUsuario, permisos.gestionarHistorias, p.archivado);

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