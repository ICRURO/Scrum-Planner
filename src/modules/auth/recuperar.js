/* Recuperar contraseña (HU-04): paso 1 (pedir enlace) y paso 2 (nueva contraseña, desde el enlace).
   La misma pantalla activa las cuentas invitadas (HU-03): el enlace de invitación lleva al paso 2. */

(async function () {
  const token = new URLSearchParams(window.location.search).get('token');
  const $ = (id) => document.getElementById(id);

  // ----- Paso 1: pedir el enlace -----
  const formSolicitar = $('form-solicitar');
  const botonSolicitar = formSolicitar.querySelector('[type="submit"]');
  formSolicitar.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.limpiarErrores(formSolicitar);
    const correo = $('correo');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) {
      return UI.marcarError(correo, 'Escribe un correo válido.');
    }
    UI.cargando(botonSolicitar, true);
    const r = await Api.post('/api/auth/recuperar', { correo: correo.value.trim() });
    UI.cargando(botonSolicitar, false);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo procesar la solicitud.', 'error');
    UI.toast(r.datos.mensaje, 'exito');
  });

  // ----- Paso 2: solo se habilita si el enlace (?token=...) es válido -----
  const formNueva = $('form-nueva');
  const aviso = $('aviso-paso2');
  const botonRestablecer = $('btn-restablecer');

  if (token) {
    const r = await Api.get(`/api/auth/token/${encodeURIComponent(token)}`);
    if (!r.ok || !r.datos.valido) {
      aviso.className = 'alerta alerta--error';
      aviso.querySelectorAll('span')[1].textContent = 'El enlace no es válido, ya se usó o venció. Solicita uno nuevo en el paso 1.';
    } else {
      formNueva.classList.remove('paso--bloqueado');
      aviso.hidden = true;
      formNueva.querySelectorAll('input, button').forEach((el) => { el.disabled = false; });

      // Un enlace de invitación activa la cuenta: se adapta el texto y se oculta el paso 1
      if (r.datos.tipo === 'invitacion') {
        document.querySelector('.titulo-pagina h1').textContent = 'Activar cuenta';
        document.querySelector('.titulo-pagina p').textContent = 'Define tu contraseña para entrar por primera vez';
        formSolicitar.hidden = true;
        botonRestablecer.textContent = 'Activar cuenta';
      }
    }
  }

  formNueva.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.limpiarErrores(formNueva);
    const nueva = $('nueva');
    const confirmar = $('confirmar');
    let valido = true;
    if (nueva.value.length < 6) { UI.marcarError(nueva, 'Usa al menos 6 caracteres.'); valido = false; }
    if (confirmar.value !== nueva.value) { UI.marcarError(confirmar, 'Las contraseñas no coinciden.'); valido = false; }
    if (!valido) return;

    UI.cargando(botonRestablecer, true);
    const r = await Api.post('/api/auth/restablecer', { token, password: nueva.value });
    UI.cargando(botonRestablecer, false);
    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo cambiar la contraseña.', 'error');

    UI.toast(r.datos.mensaje, 'exito');
    setTimeout(() => { window.location.href = r.datos.redirigir || '/login'; }, 1500);
  });
})();