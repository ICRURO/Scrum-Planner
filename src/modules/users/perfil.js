// Mi perfil: muestra los datos de quien inició sesión

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;
  const u = sesion.usuario;
  const nombreCompleto = `${u.nombre} ${u.apellidos}`.trim();

  document.getElementById('perfil-avatar').textContent = UI.iniciales(nombreCompleto);
  document.getElementById('perfil-nombre').textContent = nombreCompleto;
  document.getElementById('perfil-rol').innerHTML = UI.insigniaRol(UI.ROLES_GLOBALES[u.rolGlobal] || u.rolGlobal);
  document.getElementById('nombre').value = u.nombre;
  document.getElementById('apellidos').value = u.apellidos;
  document.getElementById('correo').value = u.correo;
  document.getElementById('rol').value = UI.ROLES_GLOBALES[u.rolGlobal] || u.rolGlobal;

  const form = document.getElementById('form-perfil');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    UI.limpiarErrores(form);
    let valido = true;
    ['nombre', 'apellidos'].forEach((id) => {
      const campo = document.getElementById(id);
      if (!campo.value.trim()) { UI.marcarError(campo, 'Este campo es obligatorio.'); valido = false; }
    });
    if (valido) UI.pendiente();
  });
})();
