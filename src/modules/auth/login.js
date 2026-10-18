const form = document.getElementById('form-login');
const inputCorreo = document.getElementById('correo');
const inputPassword = document.getElementById('password');
const alertaError = document.getElementById('login-error');
const botonEntrar = document.getElementById('btn-entrar');
const botonVer = document.getElementById('ver-password');

function mostrarError(mensaje) {
  alertaError.innerHTML = `${Icons.get('alerta', 20)}<span>${UI.escapar(mensaje)}</span>`;
  alertaError.hidden = false;
}

// Mostrar / ocultar contraseña
botonVer.addEventListener('click', () => {
  const visible = inputPassword.type === 'text';
  inputPassword.type = visible ? 'password' : 'text';
  botonVer.innerHTML = Icons.get(visible ? 'ojo' : 'ojo_cerrado', 20);
  botonVer.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertaError.hidden = true;

  const correo = inputCorreo.value.trim();
  const password = inputPassword.value;
  if (!correo || !password) return mostrarError('Escribe tu correo y tu contraseña.');

  UI.cargando(botonEntrar, true);
  const r = await Api.post('/api/auth/login', { correo, password });
  UI.cargando(botonEntrar, false);

  if (!r.ok) return mostrarError(r.datos?.mensaje || 'No se pudo iniciar sesión.');
  window.location.replace(r.datos.redirigir || '/panel'); 
});
