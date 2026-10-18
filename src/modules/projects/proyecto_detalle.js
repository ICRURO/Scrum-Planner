// Detalle del proyecto: estado, acciones permitidas, información general e historial

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const r = id ? await Api.get(`/api/projects/${encodeURIComponent(id)}`) : { ok: false, status: 404, datos: { mensaje: 'Falta indicar el proyecto.' } };

  if (!r.ok) {
    document.getElementById('sin-acceso-titulo').textContent = r.status === 403 ? 'Acceso no autorizado' : 'Proyecto no encontrado';
    document.getElementById('sin-acceso-texto').textContent = r.datos?.mensaje || 'No se pudo cargar el proyecto.';
    document.getElementById('sin-acceso').hidden = false;
    document.getElementById('nombre').textContent = 'Proyecto';
    Icons.hidratar();
    return;
  }

  const { proyecto: p, permisos, miRol, historial } = r.datos;

  // Encabezado
  document.title = `${p.nombre} · Scrum Manager`;
  document.getElementById('nombre').textContent = p.nombre;
  document.getElementById('id-proyecto').textContent = p.id;
  document.getElementById('estado-insignia').innerHTML = UI.insigniaProyecto(p.estado);
  document.getElementById('archivado-insignia').innerHTML = p.archivado ? '<span class="insignia insignia--suspendido">Archivado</span>' : '';

  // Los cuatro estados, con el actual resaltado
  const ESTADOS = [
    ['preparacion', 'En preparación', 'reloj'], ['activo', 'Activo', 'rayo'],
    ['suspendido', 'Suspendido', 'pausa'], ['finalizado', 'Finalizado', 'check']
  ];
  document.getElementById('estados').innerHTML = ESTADOS.map(([clave, texto, icono]) => `
    <div class="estado-opcion ${clave === p.estado ? 'actual' : ''}" ${clave === p.estado ? 'aria-current="true"' : ''}>
      <span class="icono-estado">${Icons.get(icono, 20)}</span>${texto}
    </div>`).join('');

  // Solo se muestran las acciones que el rol permite (el servidor las vuelve a verificar al ejecutarlas)
  const finalizado = p.estado === 'finalizado';
  const botones = [];
  if (permisos.cambiarEstado && !finalizado) botones.push('<button class="btn btn-primario" data-accion>Cambiar estado</button>');
  if (permisos.finalizar && !finalizado) botones.push('<button class="btn btn-peligro" data-accion>Finalizar proyecto</button>');
  if (permisos.reabrir && finalizado) botones.push('<button class="btn btn-secundario" data-accion>Reabrir proyecto</button>');
  if (permisos.editar) botones.push(`<a class="btn btn-secundario" href="/proyectos/editar?id=${encodeURIComponent(p.id)}">Editar</a>`);
  if (permisos.archivar && !p.archivado) botones.push('<button class="btn btn-secundario" data-accion>Archivar</button>');
  document.getElementById('acciones').innerHTML = botones.join('');
  document.getElementById('acciones').addEventListener('click', (e) => { if (e.target.closest('[data-accion]')) UI.pendiente(); });

  if (!botones.length) {
    const aviso = document.getElementById('aviso-rol');
    aviso.innerHTML = `${Icons.get('info', 20)}<span>Tu rol en este proyecto (${UI.escapar(miRol)}) permite consultarlo, no modificarlo.</span>`;
    aviso.hidden = false;
  }

  // Información general
  document.getElementById('info').innerHTML = `
    <div><dt>Descripción</dt><dd>${UI.escapar(p.descripcion)}</dd></div>
    <div><dt>Objetivo</dt><dd>${UI.escapar(p.objetivo)}</dd></div>
    <div><dt>Fechas previstas</dt><dd>${UI.rangoFechas(p.fechaInicio, p.fechaFin)}</dd></div>
    <div><dt>Tu rol</dt><dd>${UI.insigniaRol(miRol === 'administrador' ? 'Administrador general' : miRol)}</dd></div>`;

  // Historial
  document.getElementById('historial').innerHTML = historial.length
    ? historial.map((h) => `<tr><td>${UI.formatoFecha(h.fecha)}</td><td>${UI.escapar(h.usuario)}</td><td>${UI.escapar(h.cambio)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="texto-suave">Todavía no hay cambios registrados.</td></tr>';

  document.getElementById('contenido').hidden = false;
  Icons.hidratar();
})();
