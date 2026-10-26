// /api/users — perfil propio (cualquier usuario) y administración de cuentas (solo administrador)

const express = require('express');
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { hashearPassword } = require('../../config/passwords');
const { crearToken } = require('../../config/tokens');
const { enlaceActivacion, enviarInvitacion } = require('../../config/correo');
const { requiereSesion, sinPassword } = require('../../middleware/auth');
const { apiConPermiso } = require('../../middleware/permisos');

const router = express.Router();
router.use(requiereSesion);

const soloAdmin = apiConPermiso('administrar_usuarios');
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_GLOBALES = ['administrador', 'usuario'];
const VIGENCIA_INVITACION_HORAS = 72;

const texto = (v) => String(v ?? '').trim();

function siguienteId(db) {
  const max = db.usuarios.reduce((m, u) => Math.max(m, parseInt(String(u.id).split('-')[1], 10) || 0), 0);
  return `USR-${String(max + 1).padStart(3, '0')}`;
}

// Envía la invitación por correo. Devuelve true si salió. Si falla o no hay SMTP,
// la API devuelve el enlace para que el administrador lo comparta a mano.
async function mandarInvitacion(usuario, enlace) {
  try { return await enviarInvitacion(usuario, enlace); }
  catch (e) { console.error('>>> No se pudo enviar la invitación:', e.message); return false; }
}

// Busca la cuenta o responde 404
function cargar(req, res) {
  const db = readDB();
  const usuario = db.usuarios.find((u) => u.id === req.params.id);
  if (!usuario) { res.status(404).json({ mensaje: 'No se encontró la cuenta.' }); return null; }
  return { db, usuario };
}

// ---------- HU-05 Mi perfil (nombre y apellidos; el correo y el rol no se cambian aquí) ----------
router.put('/me', (req, res) => {
  const nombre = texto(req.body?.nombre);
  const apellidos = texto(req.body?.apellidos);
  if (!nombre || !apellidos) return res.status(400).json({ mensaje: 'El nombre y los apellidos son obligatorios.' });

  const db = readDB();
  const usuario = db.usuarios.find((u) => u.id === req.usuario.id);
  const antes = {}, despues = {};
  if (nombre !== usuario.nombre) { antes.nombre = usuario.nombre; despues.nombre = nombre; }
  if (apellidos !== usuario.apellidos) { antes.apellidos = usuario.apellidos; despues.apellidos = apellidos; }
  if (!Object.keys(despues).length) return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });

  usuario.nombre = nombre;
  usuario.apellidos = apellidos;
  registrarHistorial(db, { idUsuario: usuario.id, entidad: 'usuario', idEntidad: usuario.id, campo: 'perfil', valorAnterior: antes, valorNuevo: despues });
  writeDB(db);
  res.json({ mensaje: 'Perfil actualizado.', usuario: sinPassword(usuario) });
});

// ---------- Consultas (administrador) ----------
router.get('/', soloAdmin, (req, res) => {
  res.json({ usuarios: readDB().usuarios.map(sinPassword) });
});

router.get('/:id', soloAdmin, (req, res) => {
  const usuario = readDB().usuarios.find((u) => u.id === req.params.id);
  if (!usuario) return res.status(404).json({ mensaje: 'No se encontró la cuenta.' });
  res.json({ usuario: sinPassword(usuario) });
});

// ---------- HU-03 Registrar o invitar ----------
router.post('/', soloAdmin, async (req, res) => {
  const d = req.body || {};
  const nombre = texto(d.nombre);
  const apellidos = texto(d.apellidos);
  const correo = texto(d.correo).toLowerCase();
  const rolGlobal = d.rolGlobal || 'usuario';
  const conPassword = d.metodo === 'password';

  if (!nombre || !apellidos) return res.status(400).json({ mensaje: 'El nombre y los apellidos son obligatorios.' });
  if (!CORREO.test(correo)) return res.status(400).json({ mensaje: 'Escribe un correo válido.' });
  if (!ROLES_GLOBALES.includes(rolGlobal)) return res.status(400).json({ mensaje: 'Rol global no válido.' });
  if (conPassword && String(d.password || '').length < 6) return res.status(400).json({ mensaje: 'La contraseña inicial debe tener al menos 6 caracteres.' });

  const db = readDB();
  if (db.usuarios.some((u) => u.correo.toLowerCase() === correo)) {
    return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo.' });
  }

  const usuario = {
    id: siguienteId(db),
    nombre, apellidos, correo,
    password: conPassword ? hashearPassword(String(d.password)) : null,
    rolGlobal,
    estado: conPassword ? 'activo' : 'invitacion_pendiente'
  };
  db.usuarios.push(usuario);
  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'usuario', idEntidad: usuario.id, campo: 'creacion', valorNuevo: correo });

  const enlace = conPassword ? null : enlaceActivacion(crearToken(db, usuario.id, 'invitacion', VIGENCIA_INVITACION_HORAS));
  writeDB(db);

  const enviado = enlace ? await mandarInvitacion(usuario, enlace) : false;
  res.status(201).json({
    mensaje: conPassword ? 'Cuenta registrada.' : (enviado ? 'Invitación enviada por correo.' : 'Invitación generada.'),
    usuario: sinPassword(usuario),
    enlace: enviado ? null : enlace // el enlace solo se muestra si el correo no pudo salir
  });
});

// ---------- HU-06 Editar cuenta ----------
router.put('/:id', soloAdmin, (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, usuario } = ctx;
  const d = req.body || {};

  const nuevo = {
    nombre: texto(d.nombre),
    apellidos: texto(d.apellidos),
    correo: texto(d.correo).toLowerCase(),
    rolGlobal: d.rolGlobal || usuario.rolGlobal
  };
  if (!nuevo.nombre || !nuevo.apellidos) return res.status(400).json({ mensaje: 'El nombre y los apellidos son obligatorios.' });
  if (!CORREO.test(nuevo.correo)) return res.status(400).json({ mensaje: 'Escribe un correo válido.' });
  if (!ROLES_GLOBALES.includes(nuevo.rolGlobal)) return res.status(400).json({ mensaje: 'Rol global no válido.' });
  if (db.usuarios.some((u) => u.id !== usuario.id && u.correo.toLowerCase() === nuevo.correo)) {
    return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo.' });
  }
  if (usuario.id === req.usuario.id && nuevo.rolGlobal !== usuario.rolGlobal) {
    return res.status(409).json({ mensaje: 'No puedes cambiar tu propio rol global.' });
  }

  const antes = {}, despues = {};
  Object.keys(nuevo).forEach((c) => {
    if (nuevo[c] !== usuario[c]) { antes[c] = usuario[c]; despues[c] = nuevo[c]; usuario[c] = nuevo[c]; }
  });
  if (!Object.keys(despues).length) return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'usuario', idEntidad: usuario.id, campo: 'informacion', valorAnterior: antes, valorNuevo: despues });
  writeDB(db);
  res.json({ mensaje: 'Cuenta actualizada.', usuario: sinPassword(usuario) });
});

// ---------- HU-06 Activar y desactivar (nunca se elimina la cuenta ni su historial) ----------
router.post('/:id/desactivar', soloAdmin, (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, usuario } = ctx;
  if (usuario.id === req.usuario.id) return res.status(409).json({ mensaje: 'No puedes desactivar tu propia cuenta.' });
  if (usuario.estado !== 'activo') return res.status(409).json({ mensaje: 'Solo se puede desactivar una cuenta activa.' });

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'usuario', idEntidad: usuario.id, campo: 'estado', valorAnterior: usuario.estado, valorNuevo: 'desactivado' });
  usuario.estado = 'desactivado'; // la sesión abierta deja de ser válida en la siguiente petición
  writeDB(db);
  res.json({ mensaje: 'Cuenta desactivada.', usuario: sinPassword(usuario) });
});

router.post('/:id/activar', soloAdmin, (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, usuario } = ctx;
  if (usuario.estado !== 'desactivado') return res.status(409).json({ mensaje: 'Solo se puede activar una cuenta desactivada.' });
  if (!usuario.password) return res.status(409).json({ mensaje: 'Esta cuenta nunca definió su contraseña. Reenvía la invitación.' });

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'usuario', idEntidad: usuario.id, campo: 'estado', valorAnterior: usuario.estado, valorNuevo: 'activo' });
  usuario.estado = 'activo';
  writeDB(db);
  res.json({ mensaje: 'Cuenta activada.', usuario: sinPassword(usuario) });
});

// ---------- HU-03 Reenviar invitación ----------
router.post('/:id/reenviar', soloAdmin, async (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, usuario } = ctx;
  if (usuario.estado !== 'invitacion_pendiente') return res.status(409).json({ mensaje: 'Solo se puede reenviar la invitación de una cuenta pendiente.' });

  const enlace = enlaceActivacion(crearToken(db, usuario.id, 'invitacion', VIGENCIA_INVITACION_HORAS));
  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'usuario', idEntidad: usuario.id, campo: 'invitacion', valorNuevo: 'reenviada' });
  writeDB(db);

  const enviado = await mandarInvitacion(usuario, enlace);
  res.json({
    mensaje: enviado ? 'Invitación reenviada por correo.' : 'Invitación generada.',
    usuario: sinPassword(usuario),
    enlace: enviado ? null : enlace
  });
});

module.exports = router;