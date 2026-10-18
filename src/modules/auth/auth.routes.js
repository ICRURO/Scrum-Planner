/*
  RUTAS DE ACCESO

  Define las direcciones de la API que atienden el inicio y cierre de sesión
  y entregan a las pantallas los datos de la sesión actual

*/

const express = require('express');
const { readDB } = require('../../config/db');
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

  if (!usuario || !usuario.password || usuario.password !== password) {
    return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
  }

  if (usuario.estado !== 'activo') {
    return res.status(403).json({ mensaje: 'Tu cuenta no está activa. Contacta al administrador.' });
  }

  crearSesion(res, usuario.id);
  res.json({ mensaje: 'Inicio de sesión correcto.', redirigir: '/panel' });
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
