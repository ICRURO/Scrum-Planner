const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { requiereSesion } = require('../../middleware/auth');

// GET /api/equipos -> Listar todos los equipos/participantes para la vista general de la barra superior
router.get('/', requiereSesion, (req, res) => {
  const db = readDB();
  const participantes = db.participantes || db.equipos || [];

  const resultado = participantes.map(p => {
    const usuario = (db.usuarios || []).find(u => u.id === (p.idUsuario || p.usuarioId));
    const proyecto = (db.proyectos || []).find(pr => pr.id === (p.idProyecto || p.proyectoId));
    return {
      id: p.id,
      idProyecto: p.idProyecto || p.proyectoId,
      nombreProyecto: proyecto ? proyecto.nombre : (p.idProyecto || p.proyectoId),
      usuarioId: p.idUsuario || p.usuarioId,
      nombreUsuario: usuario ? `${usuario.nombre} ${usuario.apellidos}` : (p.idUsuario || p.usuarioId),
      correo: usuario ? usuario.correo : '',
      rol: p.rol,
      estado: usuario ? (usuario.estado === 'activo' ? 'Activo' : usuario.estado) : 'Activo'
    };
  });

  res.json(resultado);
});

// GET /api/equipos/proyectos/:idProyecto/participantes -> Consultar equipo del proyecto específico
router.get('/proyectos/:idProyecto/participantes', requiereSesion, (req, res) => {
  const db = readDB();
  const idProyecto = req.params.idProyecto;
  const lista = db.participantes || db.equipos || [];
  const participantes = lista.filter(p => (p.idProyecto || p.proyectoId) === idProyecto);

  const resultado = participantes.map(p => {
    const usuario = (db.usuarios || []).find(u => u.id === (p.idUsuario || p.usuarioId));
    return {
      id: p.id,
      usuarioId: p.idUsuario || p.usuarioId,
      nombreUsuario: usuario ? `${usuario.nombre} ${usuario.apellidos}` : (p.idUsuario || p.usuarioId),
      correo: usuario ? usuario.correo : '',
      rol: p.rol,
      rolScrum: p.rol,
      estado: usuario ? (usuario.estado === 'activo' ? 'Activo' : usuario.estado) : 'Activo'
    };
  });

  res.json(resultado);
});

// POST /api/equipos -> Agregar integrante al proyecto
router.post('/', requiereSesion, (req, res) => {
  const { idProyecto, idUsuario, rol } = req.body;
  if (!idProyecto || !idUsuario) {
    return res.status(400).json({ error: 'El idProyecto e idUsuario son obligatorios' });
  }

  const db = readDB();
  if (!db.participantes) {
    db.participantes = [];
  }

  // Validar si el usuario ya está en el proyecto
  const yaExiste = db.participantes.find(p => (p.idProyecto || p.proyectoId) === idProyecto && (p.idUsuario || p.usuarioId) === idUsuario);
  if (yaExiste) {
    return res.status(400).json({ error: 'El usuario ya forma parte de este proyecto.' });
  }

  const max = db.participantes.reduce((m, p) => Math.max(m, parseInt(String(p.id).split('-')[1], 10) || 0), 0);
  const nuevoId = `PAR-${String(max + 1).padStart(3, '0')}`;

  const nuevoParticipante = {
    id: nuevoId,
    idProyecto: idProyecto,
    idUsuario: idUsuario,
    rol: rol || 'Developer'
  };

  db.participantes.push(nuevoParticipante);
  
  registrarHistorial(db, {
    idUsuario: req.usuario.id,
    entidad: 'proyecto',
    idEntidad: idProyecto,
    campo: 'participante',
    valorNuevo: `${idUsuario} (${nuevoParticipante.rol})`
  });

  writeDB(db);

  return res.status(201).json({
    mensaje: 'Participante agregado exitosamente',
    participante: nuevoParticipante
  });
});

module.exports = router;