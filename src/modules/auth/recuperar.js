/* Recuperar contraseña: paso 1 (pedir enlace) y paso 2 (nueva contraseña, desde el enlace) */

(function () {
  const token = new URLSearchParams(window.location.search).get('token');

  // ----- Paso 1 -----
  const formSolicitar = document.getElementById('form-solicitar');
  formSolicitar.addEventListener('submit', (e) => {
    e.preventDefault();
    UI.limpiarErrores(formSolicitar);
    const correo = document.getElementById('correo');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) {
      return UI.marcarError(correo, 'Escribe un correo válido.');
    }
    UI.pendiente();
  });

  // ----- Paso 2: solo se habilita si se abrió el enlace con ?token=... -----
  const formNueva = document.getElementById('form-nueva');
  if (token) {
    formNueva.classList.remove('paso--bloqueado');
    document.getElementById('aviso-paso2').hidden = true;
    formNueva.querySelectorAll('input, button').forEach((el) => { el.disabled = false; });
  }

  formNueva.addEventListener('submit', (e) => {
    e.preventDefault();
    UI.limpiarErrores(formNueva);
    const nueva = document.getElementById('nueva');
    const confirmar = document.getElementById('confirmar');
    let valido = true;
    if (nueva.value.length < 6) { UI.marcarError(nueva, 'Usa al menos 6 caracteres.'); valido = false; }
    if (confirmar.value !== nueva.value) { UI.marcarError(confirmar, 'Las contraseñas no coinciden.'); valido = false; }
    if (valido) UI.pendiente();
  });
})();
