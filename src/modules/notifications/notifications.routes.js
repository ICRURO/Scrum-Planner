const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../config/db');
const { requiereSesion } = require('../../middleware/auth');
const { puede } = require('../../middleware/permisos');

router.use(requiereSesion);

// GET /api/notifications -> Lista las notificaciones del usuario autenticado
router.get('/', (req, res) => {
  const db = readDB();
  const u = req.usuario;
  const notificacionesUsuario = (db.notificaciones || [])
    .filter((n) => n.idUsuarioDestino === u.id)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .map((n) => {
      // Validación de permisos antes de exponer la ruta de destino (HU-50-T4)
      const tienePermiso = !n.idProyecto || puede(u, 'consultar_proyecto', n.idProyecto, db);
      return {
        ...n,
        puedeAcceder: tienePermiso,
        urlDestino: tienePermiso ? (n.urlDestino || '/panel') : '/sin-permiso'
      };
    });

  const noLeidas = notificacionesUsuario.filter((n) => !n.leida).length;
  res.json({ notificaciones: notificacionesUsuario, noLeidas });
});

// PUT /api/notifications/leer-todas -> Marca todas como leídas
router.put('/leer-todas', (req, res) => {
  const db = readDB();
  const u = req.usuario;
  let actualizadas = 0;

  (db.notificaciones || []).forEach((n) => {
    if (n.idUsuarioDestino === u.id && !n.leida) {
      n.leida = true;
      actualizadas++;
    }
  });

  if (actualizadas > 0) writeDB(db);
  res.json({ mensaje: 'Todas las notificaciones fueron marcadas como leídas.', actualizadas });
});

// PUT /api/notifications/:id/leer -> Marca una notificación individual como leída
router.put('/:id/leer', (req, res) => {
  const db = readDB();
  const noti = (db.notificaciones || []).find(
    (n) => n.id === req.params.id && n.idUsuarioDestino === req.usuario.id
  );
  if (!noti) return res.status(404).json({ mensaje: 'Notificación no encontrada.' });

  if (!noti.leida) {
    noti.leida = true;
    writeDB(db);
  }
  res.json({ mensaje: 'Notificación marcada como leída.', notificacion: noti });
});

module.exports = router;