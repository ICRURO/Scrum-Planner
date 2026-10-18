// Editar usuario: carga la cuenta indicada en ?id=USR-000

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const aviso = document.getElementById('error-carga');
  const r = id ? await Api.get(`/api/users/${encodeURIComponent(id)}`) : { ok: false, datos: { mensaje: 'Falta indicar la cuenta a editar.' } };
  if (r.status === 403) { window.location.href = '/sin-permiso'; return; }
  if (!r.ok) {
    aviso.innerHTML = `${Icons.get('alerta', 20)}<span>${UI.escapar(r.datos?.mensaje || 'No se pudo cargar la cuenta.')}</span>`;
    aviso.hidden = false;
    return;
  }

  const u = r.datos.usuario;
  const nombreCompleto = `${u.nombre} ${u.apellidos}`.trim();
  document.getElementById('usuario-avatar').textContent = UI.iniciales(nombreCompleto);
  document.getElementById('usuario-nombre').textContent = nombreCompleto;
  document.getElementById('usuario-estado').innerHTML = UI.insigniaUsuario(u.estado);
  document.getElementById('nombre').value = u.nombre;
  document.getElementById('apellidos').value = u.apellidos;
  document.getElementById('correo').value = u.correo;
  document.getElementById('rol').value = u.rolGlobal;

  // Texto y botón de estado según la cuenta
  const texto = document.getElementById('estado-texto');
  const acciones = document.getElementById('estado-acciones');
  if (u.estado === 'activo') {
    texto.textContent = 'La cuenta puede iniciar sesión. Si la desactivas, no podrá entrar, pero su historial se conserva.';
    acciones.innerHTML = '<button class="btn btn-peligro" type="button" id="btn-estado">Desactivar cuenta</button>';
  } else if (u.estado === 'desactivado') {
    texto.textContent = 'La cuenta está desactivada: no puede iniciar sesión. Su historial se conserva.';
    acciones.innerHTML = '<button class="btn btn-secundario" type="button" id="btn-estado">Activar cuenta</button>';
  } else {
    texto.textContent = 'La invitación aún no se acepta. La persona no puede iniciar sesión hasta activar su cuenta.';
    acciones.innerHTML = '<button class="btn btn-secundario" type="button" id="btn-estado">Reenviar invitación</button>';
  }
  document.getElementById('btn-estado').addEventListener('click', UI.pendiente);

  const form = document.getElementById('form-editar');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    UI.limpiarErrores(form);
    let valido = true;
    ['nombre', 'apellidos'].forEach((campoId) => {
      const campo = document.getElementById(campoId);
      if (!campo.value.trim()) { UI.marcarError(campo, 'Este campo es obligatorio.'); valido = false; }
    });
    const correo = document.getElementById('correo');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) { UI.marcarError(correo, 'Escribe un correo válido.'); valido = false; }
    if (valido) UI.pendiente();
  });

  document.getElementById('contenido').hidden = false;
})();
