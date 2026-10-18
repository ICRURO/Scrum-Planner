// /api/users — solo lectura por ahora (el alta, edición y desactivación llegan en el siguiente paso)

const express = require('express');
const { readDB } = require('../../config/db');
const { requiereSesion, sinPassword } = require('../../middleware/auth');
const { apiConPermiso } = require('../../middleware/permisos');

const router = express.Router();
router.use(requiereSesion, apiConPermiso('administrar_usuarios'));

router.get('/', (req, res) => {
  res.json({ usuarios: readDB().usuarios.map(sinPassword) });
});

router.get('/:id', (req, res) => {
  const usuario = readDB().usuarios.find((u) => u.id === req.params.id);
  if (!usuario) return res.status(404).json({ mensaje: 'No se encontró la cuenta.' });
  res.json({ usuario: sinPassword(usuario) });
});

module.exports = router;
