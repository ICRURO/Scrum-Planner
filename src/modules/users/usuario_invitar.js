// Registrar o invitar usuario (HU-03)

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const form = document.getElementById('form-invitar');
  const metodo = document.getElementById('metodo');
  const campoPassword = document.getElementById('campo-password');
  const boton = document.getElementById('btn-enviar');

  // El campo de contraseña solo aparece si se registra con contraseña inicial
  metodo.addEventListener('change', () => {
    const conPassword = metodo.value === 'password';
    campoPassword.hidden = !conPassword;
    boton.textContent = conPassword ? 'Registrar usuario' : 'Enviar invitación';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.limpiarErrores(form);
    const nombre = document.getElementById('nombre');
    const apellidos = document.getElementById('apellidos');
    const correo = document.getElementById('correo');
    const password = document.getElementById('password');
    const conPassword = metodo.value === 'password';

    let valido = true;
    if (!nombre.value.trim()) { UI.marcarError(nombre, 'Escribe el nombre.'); valido = false; }
    if (!apellidos.value.trim()) { UI.marcarError(apellidos, 'Escribe los apellidos.'); valido = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) { UI.marcarError(correo, 'Escribe un correo válido.'); valido = false; }
    if (conPassword && password.value.length < 6) { UI.marcarError(password, 'Usa al menos 6 caracteres.'); valido = false; }
    if (!valido) return;

    UI.cargando(boton, true);
    const r = await Api.post('/api/users', {
      nombre: nombre.value.trim(),
      apellidos: apellidos.value.trim(),
      correo: correo.value.trim(),
      rolGlobal: document.getElementById('rol').value,
      metodo: metodo.value,
      password: conPassword ? password.value : undefined
    });
    UI.cargando(boton, false);

    if (!r.ok) {
      if (r.status === 409) return UI.marcarError(correo, r.datos?.mensaje || 'Ese correo ya está registrado.');
      return UI.toast(r.datos?.mensaje || 'No se pudo registrar la cuenta.', 'error');
    }

    // La lista de usuarios muestra el aviso y, si hubo invitación, el enlace para compartirla
    sessionStorage.setItem('flash', r.datos.mensaje);
    if (r.datos.enlace) sessionStorage.setItem('enlace', JSON.stringify({ correo: r.datos.usuario.correo, enlace: r.datos.enlace }));
    window.location.href = '/usuarios';
  });
})();