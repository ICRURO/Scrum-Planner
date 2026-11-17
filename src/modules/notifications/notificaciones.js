// Consulta de notificaciones y novedades con enlaces seguros (HU-50)
(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const cuerpo = document.getElementById('tabla-notificaciones');
  const buscar = document.getElementById('buscar-notificacion');
  const filtroCategoria = document.getElementById('filtro-categoria');
  const btnMarcarTodas = document.getElementById('btn-marcar-todas');
  const contenedorTabla = document.getElementById('contenedor-tabla');
  const sinNotificaciones = document.getElementById('sin-notificaciones');

  let notificaciones = [];

  function claseCategoria(cat) {
    if (cat === 'Asignación') return 'badge-cat--asignacion';
    if (cat === 'Impedimento') return 'badge-cat--impedimento';
    if (cat === 'Cambio de estado') return 'badge-cat--cambio';
    return 'badge-cat--invitacion';
  }

  function dibujar() {
    const texto = buscar.value.trim().toLowerCase();
    const categoria = filtroCategoria.value;

    const filtradas = notificaciones.filter((n) => {
      const coincideCat = !categoria || n.categoria === categoria;
      const coincideTexto = !texto
        || (n.mensaje || '').toLowerCase().includes(texto)
        || (n.elemento || '').toLowerCase().includes(texto)
        || (n.categoria || '').toLowerCase().includes(texto)
        || UI.formatoFecha(n.fecha).toLowerCase().includes(texto);
      return coincideCat && coincideTexto;
    });

    const hayNoLeidas = notificaciones.some((n) => !n.leida);
    btnMarcarTodas.disabled = !hayNoLeidas;

    contenedorTabla.hidden = filtradas.length === 0;
    sinNotificaciones.hidden = filtradas.length !== 0;

    cuerpo.innerHTML = filtradas.map((n) => {
      const accionHtml = n.puedeAcceder
        ? `<button type="button" class="btn-ver-elemento" data-ver-id="${UI.escapar(n.id)}" data-url="${UI.escapar(n.urlDestino)}">Ver elemento</button>`
        : `<span class="btn-ver-elemento btn-ver-elemento--bloqueado" title="No tienes permisos para consultar este elemento">Sin acceso</span>`;

      return `
        <tr class="${n.leida ? '' : 'fila-no-leida'}">
          <td>${UI.formatoFecha(n.fecha)}</td>
          <td><span class="badge-cat ${claseCategoria(n.categoria)}">${UI.escapar(n.categoria)}</span></td>
          <td>${UI.escapar(n.mensaje)}</td>
          <td><strong>${UI.escapar(n.elemento)}</strong></td>
          <td>${accionHtml}</td>
        </tr>
      `;
    }).join('');
  }

  async function cargar() {
    const r = await Api.get('/api/notifications');
    if (!r.ok) {
      UI.toast(r.datos?.mensaje || 'No se pudieron cargar las notificaciones.', 'error');
      return;
    }
    notificaciones = r.datos.notificaciones || [];
    dibujar();
  }

  // Enlace seguro: marca como leída y redirige solo si el usuario mantiene permisos
  cuerpo.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ver-id]');
    if (!btn) return;

    const idNoti = btn.dataset.verId;
    const url = btn.dataset.url;
    const noti = notificaciones.find((x) => x.id === idNoti);

    if (!noti || !noti.puedeAcceder) {
      UI.toast('No tienes permisos para acceder a este elemento.', 'error');
      return;
    }

    if (!noti.leida) {
      await Api.put(`/api/notifications/${encodeURIComponent(idNoti)}/leer`);
    }
    window.location.href = url;
  });

  btnMarcarTodas.addEventListener('click', async () => {
    UI.cargando(btnMarcarTodas, true);
    const r = await Api.put('/api/notifications/leer-todas');
    UI.cargando(btnMarcarTodas, false);

    if (!r.ok) return UI.toast(r.datos?.mensaje || 'Error al actualizar notificaciones.', 'error');
    UI.toast(r.datos.mensaje, 'exito');
    await cargar();
  });

  buscar.addEventListener('input', dibujar);
  filtroCategoria.addEventListener('change', dibujar);

  await cargar();
  Icons.hidratar();
})();