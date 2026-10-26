// Administración de usuarios: lista con búsqueda y filtro por estado (HU-06) y enlaces de invitación (HU-03)
(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;
  const miId = sesion.usuario.id;

  const cuerpo = document.getElementById('tabla-usuarios');
  const buscar = document.getElementById('buscar');
  const filtroEstado = document.getElementById('filtro-estado');

  let usuarios = [];

  // Ventana con el enlace de activación para que el administrador lo comparta
  function mostrarEnlace({ correo, enlace }) {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <h2 id="modal-titulo">Enlace de invitación</h2>
        <p>Comparte este enlace con ${UI.escapar(correo)} para que defina su contraseña. Es de un solo uso y vence en 72 horas.</p>
        <input class="control" id="enlace-invitacion" readonly value="${UI.escapar(enlace)}">
        <div class="modal__acciones">
          <button class="btn btn-secundario" data-r="cerrar">Cerrar</button>
          <button class="btn btn-primario" data-r="copiar">Copiar enlace</button>
        </div>
      </div>`;
    fondo.addEventListener('click', async (e) => {
      if (e.target === fondo) return fondo.remove();
      const accion = e.target.closest('[data-r]')?.dataset.r;
      if (accion === 'cerrar') return fondo.remove();
      if (accion === 'copiar') {
        const campo = fondo.querySelector('#enlace-invitacion');
        try { await navigator.clipboard.writeText(enlace); }
        catch (err) { campo.select(); document.execCommand('copy'); }
        UI.toast('Enlace copiado.', 'exito');
      }
    });
    document.body.appendChild(fondo);
    fondo.querySelector('#enlace-invitacion').select();
  }

  // Acciones según el estado de la cuenta (nadie puede desactivarse a sí mismo)
  function acciones(u) {
    const editar = `<a href="/usuarios/editar?id=${encodeURIComponent(u.id)}">Editar</a>`;
    const id = UI.escapar(u.id);
    if (u.estado === 'activo') return u.id === miId ? editar : `${editar}<button class="peligro" data-accion="desactivar" data-id="${id}">Desactivar</button>`;
    if (u.estado === 'desactivado') return `${editar}<button data-accion="activar" data-id="${id}">Activar</button>`;
    return `${editar}<button data-accion="reenviar" data-id="${id}">Reenviar invitación</button>`;
  }

  function dibujar() {
    const texto = buscar.value.trim().toLowerCase();
    const estado = filtroEstado.value;
    const filas = usuarios.filter((u) =>
      (!estado || u.estado === estado) &&
      (!texto || `${u.nombre} ${u.apellidos} ${u.correo}`.toLowerCase().includes(texto)));

    cuerpo.innerHTML = filas.length ? filas.map((u) => {
      const nombre = `${u.nombre} ${u.apellidos}`.trim();
      return `<tr>
        <td><div class="celda-usuario"><span class="avatar avatar--chico">${UI.escapar(UI.iniciales(nombre))}</span>${UI.escapar(nombre)}</div></td>
        <td>${UI.escapar(u.correo)}</td>
        <td>${UI.escapar(UI.ROLES_GLOBALES[u.rolGlobal] || u.rolGlobal)}</td>
        <td>${UI.insigniaUsuario(u.estado)}</td>
        <td><div class="tabla__acciones">${acciones(u)}</div></td>
      </tr>`;
    }).join('') : '<tr><td colspan="5" class="texto-suave">Ningún usuario coincide con la búsqueda.</td></tr>';
  }

  async function cargar() {
    const r = await Api.get('/api/users');
    if (r.status === 403) { window.location.href = '/sin-permiso'; return false; }
    if (!r.ok) { cuerpo.innerHTML = `<tr><td colspan="5">${UI.escapar(r.datos?.mensaje || 'No se pudo cargar la lista.')}</td></tr>`; return false; }
    usuarios = r.datos.usuarios;
    dibujar();
    return true;
  }

  const TEXTOS = {
    desactivar: (n) => ({ titulo: 'Desactivar cuenta', mensaje: `${n} ya no podrá iniciar sesión. Su historial de actividades se conserva.`, textoOk: 'Desactivar', peligro: true }),
    activar: (n) => ({ titulo: 'Activar cuenta', mensaje: `${n} podrá volver a iniciar sesión.`, textoOk: 'Activar' }),
    reenviar: (n) => ({ titulo: 'Reenviar invitación', mensaje: `Se generará un enlace nuevo para ${n}. El enlace anterior dejará de funcionar.`, textoOk: 'Generar enlace' })
  };

  cuerpo.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    const usuario = usuarios.find((u) => u.id === boton.dataset.id);
    const accion = boton.dataset.accion;
    if (!usuario || !TEXTOS[accion]) return;

    const nombre = `${usuario.nombre} ${usuario.apellidos}`.trim();
    if (!await UI.confirmar(TEXTOS[accion](nombre))) return;

    const r = await Api.post(`/api/users/${encodeURIComponent(usuario.id)}/${accion}`);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo completar la acción.', 'error');
    await cargar();
    UI.toast(r.datos.mensaje, 'exito');
    if (r.datos.enlace) mostrarEnlace({ correo: usuario.correo, enlace: r.datos.enlace });
  });

  buscar.addEventListener('input', dibujar);
  filtroEstado.addEventListener('change', dibujar);

  // Avisos que dejó la pantalla de invitar o editar
  const flash = sessionStorage.getItem('flash');
  if (flash) { sessionStorage.removeItem('flash'); UI.toast(flash, 'exito'); }
  const pendiente = sessionStorage.getItem('enlace');
  if (pendiente) { sessionStorage.removeItem('enlace'); try { mostrarEnlace(JSON.parse(pendiente)); } catch (err) { /* dato dañado */ } }

  await cargar();
})();