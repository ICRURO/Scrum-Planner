/*
  RUTAS DE ACCESO

  Define las direcciones de la API que atienden el inicio y cierre de sesión
  y entregan a las pantallas los datos de la sesión actual

*/

const express = require('express');
const { readDB, writeDB } = require('../../config/db');
const { verificarPassword, hashearPassword, esHash } = require('../../config/passwords');
const { crearToken, buscarTokenValido, invalidarTokens } = require('../../config/tokens');
const { registrarHistorial } = require('../../config/historial');
const { enlaceActivacion, enviarRecuperacion } = require('../../config/correo');
const { crearSesion, destruirSesion, sinPassword, requiereSesion } = require('../../middleware/auth');
const { ROLES, MATRIZ } = require('../../middleware/permisos');

const router = express.Router();

// Valida correo y contraseña. Crea la sesión
router.post('/login', (req, res) => {
  const correo = String(req.body?.correo || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!correo || !password) {
    return res.status(400).json({ mensaje: 'Escribe tu correo y tu contraseña.' });
  }

  const usuario = readDB().usuarios.find((u) => u.correo.toLowerCase() === correo);

  if (!usuario || !usuario.password || !verificarPassword(password, usuario.password)) {
    return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
  }

  if (usuario.estado !== 'activo') {
    return res.status(403).json({ mensaje: 'Tu cuenta no está activa. Contacta al administrador.' });
  }

  // Las contraseñas antiguas en texto plano se convierten a hash al primer ingreso correcto
  if (!esHash(usuario.password)) {
    const db = readDB();
    const guardado = db.usuarios.find((u) => u.id === usuario.id);
    guardado.password = hashearPassword(password);
    writeDB(db);
  }

  crearSesion(res, usuario.id);
  res.json({ mensaje: 'Inicio de sesión correcto.', redirigir: '/panel' });
});

// ---------- HU-04 Recuperar contraseña y activar cuentas invitadas ----------
const VIGENCIA_RECUPERACION_HORAS = 1;
const MENSAJE_TOKEN = 'El enlace no es válido, ya se usó o venció. Solicita uno nuevo.';

// Paso 1. Responde siempre lo mismo, exista o no el correo, para no revelar qué cuentas hay.
// El enlace llega por correo; si no hay SMTP configurado, se imprime en la consola del servidor.
router.post('/recuperar', (req, res) => {
  const correo = String(req.body?.correo || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ mensaje: 'Escribe un correo válido.' });
  }

  const db = readDB();
  const usuario = db.usuarios.find((u) => u.correo.toLowerCase() === correo);
  if (usuario && usuario.estado === 'activo') {
    const token = crearToken(db, usuario.id, 'recuperacion', VIGENCIA_RECUPERACION_HORAS);
    writeDB(db);
    // Sin await: la respuesta tarda igual exista o no la cuenta, para no revelar cuáles hay
    enviarRecuperacion(usuario, enlaceActivacion(token))
      .catch((e) => console.error('>>> No se pudo enviar el correo de recuperación:', e.message));
  }
  res.json({ mensaje: 'Si el correo está registrado, se envió un enlace para restablecer la contraseña.' });
});

// Indica a la pantalla si el enlace sigue siendo utilizable y de qué tipo es
router.get('/token/:token', (req, res) => {
  const t = buscarTokenValido(readDB(), req.params.token);
  res.json(t ? { valido: true, tipo: t.tipo } : { valido: false });
});

// Paso 2. Guarda la nueva contraseña. El enlace solo sirve una vez.
router.post('/restablecer', (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 6) return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });

  const db = readDB();
  const t = buscarTokenValido(db, String(req.body?.token || ''));
  if (!t) return res.status(400).json({ mensaje: MENSAJE_TOKEN });

  const usuario = db.usuarios.find((u) => u.id === t.idUsuario);
  const esInvitacion = t.tipo === 'invitacion';
  const estadoEsperado = esInvitacion ? 'invitacion_pendiente' : 'activo';
  if (!usuario || usuario.estado !== estadoEsperado) return res.status(400).json({ mensaje: MENSAJE_TOKEN });

  usuario.password = hashearPassword(password);
  if (esInvitacion) usuario.estado = 'activo';
  invalidarTokens(db, usuario.id);
  registrarHistorial(db, {
    idUsuario: usuario.id, entidad: 'usuario', idEntidad: usuario.id,
    campo: esInvitacion ? 'estado' : 'contrasena',
    valorAnterior: esInvitacion ? 'invitacion_pendiente' : null,
    valorNuevo: esInvitacion ? 'activo' : 'restablecida'
  });
  writeDB(db);
  res.json({ mensaje: esInvitacion ? 'Cuenta activada. Ya puedes iniciar sesión.' : 'Contraseña actualizada. Ya puedes iniciar sesión.', redirigir: '/login' });
});

// Cierra la sesión
router.post('/logout', (req, res) => {
  destruirSesion(req, res);
  res.json({ mensaje: 'Sesión cerrada.' });
});

// Datos del usuario con sesión y roles por proyecto
router.get('/session', requiereSesion, (req, res) => {
  const db = readDB();
  const participaciones = (db.participantes || [])
    .filter((p) => p.idUsuario === req.usuario.id)
    .map((p) => {
      const proyecto = (db.proyectos || []).find((x) => x.id === p.idProyecto);
      return { idProyecto: p.idProyecto, nombreProyecto: proyecto ? proyecto.nombre : p.idProyecto, rol: p.rol };
    });
  res.json({ usuario: sinPassword(req.usuario), participaciones });
});

// Matriz de permisos que ocupa la pantalla de permisos 
router.get('/permisos', requiereSesion, (req, res) => {
  res.json({ roles: ROLES, matriz: MATRIZ });
});

module.exports = router;