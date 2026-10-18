// Administración de usuarios: lista con búsqueda y filtro por estado
(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const cuerpo = document.getElementById('tabla-usuarios');
  const buscar = document.getElementById('buscar');
  const filtroEstado = document.getElementById('filtro-estado');

  const r = await Api.get('/api/users');
  if (r.status === 403) { window.location.href = '/sin-permiso'; return; }
  if (!r.ok) { cuerpo.innerHTML = `<tr><td colspan="5">${UI.escapar(r.datos?.mensaje || 'No se pudo cargar la lista.')}</td></tr>`; return; }
  const usuarios = r.datos.usuarios;

  // Acciones según el estado de la cuenta
  function acciones(u) {
    const editar = `<a href="/usuarios/editar?id=${encodeURIComponent(u.id)}">Editar</a>`;
    if (u.estado === 'activo') return `${editar}<button class="peligro" data-accion="desactivar" data-id="${u.id}">Desactivar</button>`;
    if (u.estado === 'desactivado') return `${editar}<button data-accion="activar" data-id="${u.id}">Activar</button>`;
    return `${editar}<button data-accion="reenviar" data-id="${u.id}">Reenviar invitación</button>`;
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

  buscar.addEventListener('input', dibujar);
  filtroEstado.addEventListener('change', dibujar);
  cuerpo.addEventListener('click', (e) => { if (e.target.closest('[data-accion]')) UI.pendiente(); });
  dibujar();
})();
