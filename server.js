const express = require('express');
const path = require('path');
const { obtenerUsuario, requierePagina } = require('./src/middleware/auth');
const { paginaConPermiso } = require('./src/middleware/permisos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pagina = (...partes) => path.join(__dirname, 'src', 'modules', ...partes);

// ---------- Archivos públicos ----------
const soloRecursos = (req, res, next) => {
  const permitido = /\.(css|js|svg|png|jpe?g|webp|ico)$/i.test(req.path) && !/\.routes\.js$/i.test(req.path);
  return permitido ? next() : res.status(404).end();
};
app.use('/shared', soloRecursos, express.static(path.join(__dirname, 'src', 'shared')));
app.use('/modules', soloRecursos, express.static(path.join(__dirname, 'src', 'modules')));
app.use('/assets', soloRecursos, express.static(path.join(__dirname, 'assets')));

// ---------- Páginas públicas ----------
app.get('/', (req, res) => res.redirect(obtenerUsuario(req) ? '/panel' : '/login'));
app.get('/login', (req, res) => {
  if (obtenerUsuario(req)) return res.redirect('/panel');
  res.sendFile(pagina('auth', 'login.html'));
});
app.get('/recuperar', (req, res) => res.sendFile(pagina('auth', 'recuperar.html')));
app.get('/proximamente', (req, res) => res.sendFile(pagina('common', 'proximamente.html'))); // guía de página pendiente
app.get('/componentes', (req, res) => res.sendFile(pagina('common', 'componentes.html'))); // guía de diseño 

// ---------- Páginas con sesión ----------
app.get('/panel', requierePagina, (req, res) => res.sendFile(pagina('dashboard', 'panel.html')));
app.get('/perfil', requierePagina, (req, res) => res.sendFile(pagina('users', 'perfil.html')));
app.get('/permisos', requierePagina, (req, res) => res.sendFile(pagina('auth', 'permisos.html')));
app.get('/sin-permiso', requierePagina, (req, res) => res.sendFile(pagina('auth', 'sin_permiso.html')));

// ---------- Páginas solo para el administrador ----------
const soloAdmin = [requierePagina, paginaConPermiso('administrar_usuarios')];
app.get('/usuarios', ...soloAdmin, (req, res) => res.sendFile(pagina('users', 'usuarios.html')));
app.get('/usuarios/invitar', ...soloAdmin, (req, res) => res.sendFile(pagina('users', 'usuario_invitar.html')));
app.get('/usuarios/editar', ...soloAdmin, (req, res) => res.sendFile(pagina('users', 'usuario_editar.html')));

// ---------- Proyectos ----------
app.get('/proyectos', requierePagina, (req, res) => res.sendFile(pagina('projects', 'proyectos.html')));
app.get('/proyectos/detalle', requierePagina, (req, res) => res.sendFile(pagina('projects', 'proyecto_detalle.html')));
app.get('/proyectos/nuevo', requierePagina, paginaConPermiso('crear_proyecto'),
  (req, res) => res.sendFile(pagina('projects', 'proyecto_form.html')));
app.get('/proyectos/editar', requierePagina, paginaConPermiso('editar_proyecto', (req) => req.query.id),
  (req, res) => res.sendFile(pagina('projects', 'proyecto_form.html')));

// ---------- API ----------
// Cada módulo monta aquí sus rutas con una sola línea.
app.use('/api/auth', require('./src/modules/auth/auth.routes'));
app.use('/api/users', require('./src/modules/users/users.routes'));
app.use('/api/projects', require('./src/modules/projects/projects.routes'));
// Apartado equipos
app.use('/api/equipos', require('./src/modules/equipos/equipos.routes'));

app.use((req, res) => res.status(404).send('Página no encontrada'));

app.listen(PORT, () => {
  console.log(`>>> Servidor activo en: http://localhost:${PORT}`);
  console.log(`>>> Iniciar sesión:     http://localhost:${PORT}/login`);
});
