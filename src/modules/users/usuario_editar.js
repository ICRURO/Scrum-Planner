// Editar usuario: carga la cuenta indicada en ?id=USR-000 (HU-06)

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;
  const miId = sesion.usuario.id;

  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(window.location.search).get('id');
  const aviso = $('error-carga');
  const r = id ? await Api.get(`/api/users/${encodeURIComponent(id)}`) : { ok: false, datos: { mensaje: 'Falta indicar la cuenta a editar.' } };
  if (r.status === 403) { window.location.href = '/sin-permiso'; return; }
  if (!r.ok) {
    aviso.innerHTML = `${Icons.get('alerta', 20)}<span>${UI.escapar(r.datos?.mensaje || 'No se pudo cargar la cuenta.')}</span>`;
    aviso.hidden = false;
    return;
  }

  let u = r.datos.usuario;
  const esMiCuenta = () => u.id === miId;

  // Dibuja la cuenta: encabezado, campos y bloque de estado
  function mostrar() {
    const nombreCompleto = `${u.nombre} ${u.apellidos}`.trim();
    $('usuario-avatar').textContent = UI.iniciales(nombreCompleto);
    $('usuario-nombre').textContent = nombreCompleto;
    $('usuario-estado').innerHTML = UI.insigniaUsuario(u.estado);
    $('nombre').value = u.nombre;
    $('apellidos').value = u.apellidos;
    $('correo').value = u.correo;
    $('rol').value = u.rolGlobal;
    $('rol').disabled = esMiCuenta(); // nadie cambia su propio rol global

    const texto = $('estado-texto');
    const acciones = $('estado-acciones');
    if (esMiCuenta()) {
      texto.textContent = 'Esta es tu propia cuenta: no puedes desactivarla ni cambiar tu rol global.';
      acciones.innerHTML = '';
    } else if (u.estado === 'activo') {
      texto.textContent = 'La cuenta puede iniciar sesión. Si la desactivas, no podrá entrar, pero su historial se conserva.';
      acciones.innerHTML = '<button class="btn btn-peligro" type="button" data-accion="desactivar">Desactivar cuenta</button>';
    } else if (u.estado === 'desactivado') {
      texto.textContent = 'La cuenta está desactivada: no puede iniciar sesión. Su historial se conserva.';
      acciones.innerHTML = '<button class="btn btn-secundario" type="button" data-accion="activar">Activar cuenta</button>';
    } else {
      texto.textContent = 'La invitación aún no se acepta. La persona no puede iniciar sesión hasta activar su cuenta.';
      acciones.innerHTML = '<button class="btn btn-secundario" type="button" data-accion="reenviar">Reenviar invitación</button>';
    }
  }

  const TEXTOS = {
    desactivar: { titulo: 'Desactivar cuenta', mensaje: 'La persona ya no podrá iniciar sesión. Su historial de actividades se conserva.', textoOk: 'Desactivar', peligro: true },
    activar: { titulo: 'Activar cuenta', mensaje: 'La persona podrá volver a iniciar sesión.', textoOk: 'Activar' },
    reenviar: { titulo: 'Reenviar invitación', mensaje: 'Se generará un enlace nuevo. El enlace anterior dejará de funcionar.', textoOk: 'Generar enlace' }
  };

  $('estado-acciones').addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton || !TEXTOS[boton.dataset.accion]) return;
    const accion = boton.dataset.accion;
    if (!await UI.confirmar(TEXTOS[accion])) return;

    UI.cargando(boton, true);
    const resp = await Api.post(`/api/users/${encodeURIComponent(u.id)}/${accion}`);
    UI.cargando(boton, false);
    if (!resp.ok) return UI.toast(resp.datos?.mensaje || 'No se pudo completar la acción.', 'error');

    // El enlace de invitación se muestra en la lista de usuarios
    if (resp.datos.enlace) {
      sessionStorage.setItem('flash', resp.datos.mensaje);
      sessionStorage.setItem('enlace', JSON.stringify({ correo: u.correo, enlace: resp.datos.enlace }));
      window.location.href = '/usuarios';
      return;
    }
    u = resp.datos.usuario;
    mostrar();
    UI.toast(resp.datos.mensaje, 'exito');
  });

  const form = $('form-editar');
  const botonGuardar = form.querySelector('[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.limpiarErrores(form);
    let valido = true;
    ['nombre', 'apellidos'].forEach((campoId) => {
      const campo = $(campoId);
      if (!campo.value.trim()) { UI.marcarError(campo, 'Este campo es obligatorio.'); valido = false; }
    });
    const correo = $('correo');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) { UI.marcarError(correo, 'Escribe un correo válido.'); valido = false; }
    if (!valido) return;

    UI.cargando(botonGuardar, true);
    const resp = await Api.put(`/api/users/${encodeURIComponent(u.id)}`, {
      nombre: $('nombre').value.trim(),
      apellidos: $('apellidos').value.trim(),
      correo: correo.value.trim(),
      rolGlobal: $('rol').value
    });
    UI.cargando(botonGuardar, false);

    if (!resp.ok) {
      if (resp.status === 409 && /correo/i.test(resp.datos?.mensaje || '')) return UI.marcarError(correo, resp.datos.mensaje);
      return UI.toast(resp.datos?.mensaje || 'No se pudo guardar la cuenta.', 'error');
    }
    u = resp.datos.usuario;
    mostrar();
    UI.toast(resp.datos.mensaje, 'exito');
  });

  mostrar();
  $('contenido').hidden = false;
})();