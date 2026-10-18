// Registrar o invitar usuario: validación del formulario

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const form = document.getElementById('form-invitar');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    UI.limpiarErrores(form);
    const nombre = document.getElementById('nombre');
    const correo = document.getElementById('correo');
    let valido = true;
    if (!nombre.value.trim()) { UI.marcarError(nombre, 'Escribe el nombre completo.'); valido = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) { UI.marcarError(correo, 'Escribe un correo válido.'); valido = false; }
    if (valido) UI.pendiente();
  });
})();
