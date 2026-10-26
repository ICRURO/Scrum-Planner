// Lista de proyectos con acceso autorizado

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const flash = sessionStorage.getItem('flash');
  if (flash) { sessionStorage.removeItem('flash'); UI.toast(flash, 'exito'); }

  const cuerpo = document.getElementById('tabla-proyectos');
  const buscar = document.getElementById('buscar');
  const filtroEstado = document.getElementById('filtro-estado');
  const verArchivados = document.getElementById('ver-archivados');
  const contenedorTabla = document.getElementById('contenedor-tabla');
  const sinResultados = document.getElementById('sin-resultados');

  let proyectos = [];

  async function cargar() {
    const r = await Api.get('/api/projects');
    if (!r.ok) { UI.toast(r.datos?.mensaje || 'No se pudo cargar la lista.', 'error'); return false; }
    proyectos = r.datos.proyectos;
    document.getElementById('btn-nuevo').hidden = !r.datos.puedeCrear;
    dibujar();
    return true;
  }

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
          ${p.permisos.archivar
            ? `<button data-accion="${p.archivado ? 'desarchivar' : 'archivar'}" data-id="${UI.escapar(p.id)}">${p.archivado ? 'Desarchivar' : 'Archivar'}</button>`
            : ''}
        </div></td>
      </tr>`).join('');
  }

  buscar.addEventListener('input', dibujar);
  filtroEstado.addEventListener('change', dibujar);
  verArchivados.addEventListener('change', dibujar);

  // HU-13: archivar / desarchivar (no elimina datos)
  cuerpo.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    const archivar = boton.dataset.accion === 'archivar';
    const proyecto = proyectos.find((p) => p.id === boton.dataset.id);
    if (!proyecto) return;

    const ok = await UI.confirmar({
      titulo: archivar ? 'Archivar proyecto' : 'Desarchivar proyecto',
      mensaje: archivar
        ? `"${proyecto.nombre}" dejará de aparecer en la lista activa. Su información se conserva.`
        : `"${proyecto.nombre}" volverá a aparecer en la lista activa.`,
      textoOk: archivar ? 'Archivar' : 'Desarchivar'
    });
    if (!ok) return;

    const r = await Api.put(`/api/projects/${encodeURIComponent(proyecto.id)}/archivar`, { archivado: archivar });
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo completar la acción.', 'error');
    await cargar();
    UI.toast(r.datos.mensaje, 'exito');
  });

  await cargar();
})();