// Mi perfil: muestra y actualiza los datos de quien inició sesión (HU-05)

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;
  const u = sesion.usuario;

  const $ = (id) => document.getElementById(id);
  const rolTexto = UI.ROLES_GLOBALES[u.rolGlobal] || u.rolGlobal;

  function pintarCabecera(nombre, apellidos) {
    const nombreCompleto = `${nombre} ${apellidos}`.trim();
    $('perfil-avatar').textContent = UI.iniciales(nombreCompleto);
    $('perfil-nombre').textContent = nombreCompleto;
  }

  pintarCabecera(u.nombre, u.apellidos);
  $('perfil-rol').innerHTML = UI.insigniaRol(rolTexto);
  $('nombre').value = u.nombre;
  $('apellidos').value = u.apellidos;
  $('correo').value = u.correo;
  $('rol').value = rolTexto;

  const form = $('form-perfil');
  const boton = form.querySelector('[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.limpiarErrores(form);
    let valido = true;
    ['nombre', 'apellidos'].forEach((id) => {
      const campo = $(id);
      if (!campo.value.trim()) { UI.marcarError(campo, 'Este campo es obligatorio.'); valido = false; }
    });
    if (!valido) return;

    UI.cargando(boton, true);
    const r = await Api.put('/api/users/me', { nombre: $('nombre').value.trim(), apellidos: $('apellidos').value.trim() });
    UI.cargando(boton, false);

    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo guardar el perfil.', 'error');
    pintarCabecera(r.datos.usuario.nombre, r.datos.usuario.apellidos);
    UI.toast(r.datos.mensaje, 'exito');
  });
})();