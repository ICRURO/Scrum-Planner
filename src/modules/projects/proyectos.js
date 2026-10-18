// Lista de proyectos con acceso autorizado

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const cuerpo = document.getElementById('tabla-proyectos');
  const buscar = document.getElementById('buscar');
  const filtroEstado = document.getElementById('filtro-estado');
  const verArchivados = document.getElementById('ver-archivados');
  const contenedorTabla = document.getElementById('contenedor-tabla');
  const sinResultados = document.getElementById('sin-resultados');

  const r = await Api.get('/api/projects');
  if (!r.ok) { UI.toast(r.datos?.mensaje || 'No se pudo cargar la lista.', 'error'); return; }
  const { proyectos, puedeCrear } = r.datos;

  document.getElementById('btn-nuevo').hidden = !puedeCrear;

  function dibujar() {
    const texto = buscar.value.trim().toLowerCase();
    const estado = filtroEstado.value;
    const filas = proyectos.filter((p) =>
      (verArchivados.checked || !p.archivado) &&
      (!estado || p.estado === estado) &&
      (!texto || `${p.id} ${p.nombre}`.toLowerCase().includes(texto)));

    contenedorTabla.hidden = filas.length === 0;
    sinResultados.hidden = filas.length !== 0;

    cuerpo.innerHTML = filas.map((p) => `
      <tr>
        <td>${UI.escapar(p.id)}</td>
        <td><strong>${UI.escapar(p.nombre)}</strong></td>
        <td>${p.miRol === 'administrador' ? UI.insigniaRol('Administrador general') : UI.insigniaRol(p.miRol)}</td>
        <td>${UI.rangoFechas(p.fechaInicio, p.fechaFin)}</td>
        <td>${UI.insigniaProyecto(p.estado)}${p.archivado ? ' <span class="insignia insignia--suspendido">Archivado</span>' : ''}</td>
        <td><div class="tabla__acciones">
          <a href="/proyectos/detalle?id=${encodeURIComponent(p.id)}">Ver detalle</a>
          ${p.permisos.archivar && !p.archivado ? '<button data-accion="archivar">Archivar</button>' : ''}
        </div></td>
      </tr>`).join('');
  }

  buscar.addEventListener('input', dibujar);
  filtroEstado.addEventListener('change', dibujar);
  verArchivados.addEventListener('change', dibujar);
  cuerpo.addEventListener('click', (e) => { if (e.target.closest('[data-accion]')) UI.pendiente(); });
  dibujar();
})();
