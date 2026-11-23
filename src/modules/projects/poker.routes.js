/* Planning Poker por proyecto (Scrum-Planner).
 * Las votaciones se guardan en database.json, pero nunca se revelan a otros
 * participantes hasta que el Scrum Master inicia la revelación.
 */
const express = require('express');
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { requiereSesion } = require('../../middleware/auth');
const { puede, rolEnProyecto } = require('../../middleware/permisos');

const router = express.Router();
router.use(requiereSesion);

const CARTAS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const ESTADOS = ['votando', 'revelada', 'finalizada'];

function preparar(req, res) {
  const db = readDB();
  const proyecto = (db.proyectos || []).find(p => p.id === req.params.id);
  if (!proyecto) {
    res.status(404).json({ mensaje: 'No se encontró el proyecto.' });
    return null;
  }
  if (!puede(req.usuario, 'consultar_proyecto', proyecto.id, db)) {
    res.status(403).json({ mensaje: 'No tienes acceso a este proyecto.' });
    return null;
  }
  return { db, proyecto, rol: rolEnProyecto(req.usuario, proyecto.id, db) };
}

function soloScrumMaster(ctx, res) {
  if (ctx.rol !== 'Scrum Master') {
    res.status(403).json({ mensaje: 'Solo el Scrum Master del proyecto puede realizar esta acción.' });
    return false;
  }
  if (ctx.proyecto.archivado) {
    res.status(409).json({ mensaje: 'El proyecto está archivado.' });
    return false;
  }
  return true;
}

function obtenerSesion(req, res, ctx) {
  const sesion = (ctx.db.pokerSesiones || []).find(s =>
    s.id === req.params.idSesion && s.idProyecto === ctx.proyecto.id
  );
  if (!sesion) res.status(404).json({ mensaje: 'No existe esa sesión de Planning Poker en este proyecto.' });
  return sesion || null;
}

function buscarHistoria(db, idProyecto, idHistoria) {
  return (db.historiasUsuario || []).find(h => h.id === idHistoria && h.idProyecto === idProyecto);
}

function integrantesDev(db, idProyecto) {
  const ids = new Set((db.participantes || [])
    .filter(p => p.idProyecto === idProyecto && p.rol === 'Developer')
    .map(p => p.idUsuario));
  return [...ids].map(id => {
    const u = (db.usuarios || []).find(u => u.id === id);
    return { idUsuario: id, nombre: u ? `${u.nombre} ${u.apellidos}`.trim() : id };
  });
}

function descripcionSesion(ctx, sesion, incluirDetalle = false) {
  const historia = buscarHistoria(ctx.db, ctx.proyecto.id, sesion.idHistoria);
  const votos = Array.isArray(sesion.votos) ? sesion.votos : [];
  const visible = sesion.estado !== 'votando';
  const datos = {
    id: sesion.id,
    idProyecto: sesion.idProyecto,
    idHistoria: sesion.idHistoria,
    tituloHistoria: historia ? historia.titulo : 'Historia no disponible',
    estado: sesion.estado,
    ronda: sesion.ronda,
    numeroVotos: votos.length,
    fechaCreacion: sesion.fechaCreacion,
    puntosAcordados: sesion.puntosAcordados ?? null,
    horasEstimadas: sesion.horasEstimadas ?? null
  };
  if (incluirDetalle) {
    datos.cartas = CARTAS;
    datos.participantes = integrantesDev(ctx.db, ctx.proyecto.id).map(p => ({
      ...p, haVotado: votos.some(v => v.idUsuario === p.idUsuario)
    }));
    // Un Developer puede consultar únicamente su propia carta durante la votación.
    const miVoto = votos.find(v => v.idUsuario === ctx.usuarioId);
    datos.miVoto = miVoto ? miVoto.puntos : null;
    if (visible) {
      datos.votos = votos.map(v => {
        const u = (ctx.db.usuarios || []).find(u => u.id === v.idUsuario);
        return { idUsuario: v.idUsuario, nombre: u ? `${u.nombre} ${u.apellidos}`.trim() : v.idUsuario, puntos: v.puntos };
      });
      datos.rondasAnteriores = sesion.rondasAnteriores || [];
    }
  }
  return datos;
}

function responderSesion(req, res, ctx, sesion) {
  ctx.usuarioId = req.usuario.id;
  res.json({ sesion: descripcionSesion(ctx, sesion, true) });
}

// Listar sesiones del proyecto; no publicar cartas individuales antes de revelarlas.
router.get('/:id/poker', (req, res) => {
  const ctx = preparar(req, res);
  if (!ctx) return;
  ctx.usuarioId = req.usuario.id;
  const sesiones = (ctx.db.pokerSesiones || [])
    .filter(s => s.idProyecto === ctx.proyecto.id)
    .map(s => descripcionSesion(ctx, s));
  res.json({ sesiones, puedeCrear: ctx.rol === 'Scrum Master' && !ctx.proyecto.archivado });
});

// Abrir Planning Poker para una historia registrada en el mismo proyecto.
router.post('/:id/poker', (req, res) => {
  const ctx = preparar(req, res);
  if (!ctx || !soloScrumMaster(ctx, res)) return;
  const idHistoria = req.body?.idHistoria;
  if (typeof idHistoria !== 'string' || !buscarHistoria(ctx.db, ctx.proyecto.id, idHistoria)) {
    return res.status(400).json({ mensaje: 'Selecciona una historia válida de este proyecto.' });
  }
  if (!integrantesDev(ctx.db, ctx.proyecto.id).length) {
    return res.status(400).json({ mensaje: 'Agrega al menos un Developer al equipo antes de abrir la votación.' });
  }
  if ((ctx.db.pokerSesiones || []).some(s => s.idProyecto === ctx.proyecto.id &&
    s.idHistoria === idHistoria && s.estado !== 'finalizada')) {
    return res.status(409).json({ mensaje: 'Ya hay una sesión sin finalizar para esta historia.' });
  }
  if (!ctx.db.pokerSesiones) ctx.db.pokerSesiones = [];
  const max = ctx.db.pokerSesiones.reduce((m, s) => {
    const encontrado = /^PP-(\d+)$/.exec(String(s.id));
    return Math.max(m, encontrado ? Number(encontrado[1]) : 0);
  }, 0);
  const sesion = {
    id: `PP-${String(max + 1).padStart(3, '0')}`,
    idProyecto: ctx.proyecto.id,
    idHistoria,
    idCreador: req.usuario.id,
    estado: 'votando',
    ronda: 1,
    votos: [],
    rondasAnteriores: [],
    fechaCreacion: new Date().toISOString()
  };
  ctx.db.pokerSesiones.push(sesion);
  registrarHistorial(ctx.db, {
    idUsuario: req.usuario.id, entidad: 'proyecto', idEntidad: ctx.proyecto.id,
    campo: 'planning_poker', valorNuevo: `${sesion.id} iniciado para ${idHistoria}`
  });
  writeDB(ctx.db);
  ctx.usuarioId = req.usuario.id;
  return res.status(201).json({ mensaje: 'Sesión de Planning Poker creada.', sesion: descripcionSesion(ctx, sesion, true) });
});

router.get('/:id/poker/:idSesion', (req, res) => {
  const ctx = preparar(req, res);
  if (!ctx) return;
  const sesion = obtenerSesion(req, res, ctx);
  if (sesion) responderSesion(req, res, ctx, sesion);
});

router.post('/:id/poker/:idSesion/votar', (req, res) => {
  const ctx = preparar(req, res);
  if (!ctx) return;
  if (ctx.rol !== 'Developer') return res.status(403).json({ mensaje: 'Solo un Developer del proyecto puede votar.' });
  if (ctx.proyecto.archivado) return res.status(409).json({ mensaje: 'El proyecto está archivado.' });
  const sesion = obtenerSesion(req, res, ctx);
  if (!sesion) return;
  if (sesion.estado !== 'votando') return res.status(409).json({ mensaje: 'Esta ronda ya no acepta votos.' });
  const puntos = req.body?.puntos;
  if (!Number.isInteger(puntos) || !CARTAS.includes(puntos)) {
    return res.status(400).json({ mensaje: 'Selecciona una carta Fibonacci válida.' });
  }
  const voto = sesion.votos.find(v => v.idUsuario === req.usuario.id);
  if (voto) voto.puntos = puntos;
  else sesion.votos.push({ idUsuario: req.usuario.id, puntos });
  writeDB(ctx.db);
  responderSesion(req, res, ctx, sesion);
});

router.post('/:id/poker/:idSesion/revelar', (req, res) => {
  const ctx = preparar(req, res);
  if (!ctx || !soloScrumMaster(ctx, res)) return;
  const sesion = obtenerSesion(req, res, ctx);
  if (!sesion) return;
  if (sesion.estado !== 'votando') return res.status(409).json({ mensaje: 'La sesión no está en votación.' });
  if (!sesion.votos.length) return res.status(400).json({ mensaje: 'Necesitas al menos un voto para revelar las cartas.' });
  sesion.estado = 'revelada';
  sesion.fechaRevelacion = new Date().toISOString();
  writeDB(ctx.db);
  responderSesion(req, res, ctx, sesion);
});

router.post('/:id/poker/:idSesion/nueva-ronda', (req, res) => {
  const ctx = preparar(req, res);
  if (!ctx || !soloScrumMaster(ctx, res)) return;
  const sesion = obtenerSesion(req, res, ctx);
  if (!sesion) return;
  if (sesion.estado !== 'revelada') return res.status(409).json({ mensaje: 'Primero hay que revelar la ronda actual.' });
  sesion.rondasAnteriores.push({ ronda: sesion.ronda, votos: [...sesion.votos], fechaRevelacion: sesion.fechaRevelacion });
  sesion.ronda += 1;
  sesion.votos = [];
  sesion.estado = 'votando';
  delete sesion.fechaRevelacion;
  writeDB(ctx.db);
  responderSesion(req, res, ctx, sesion);
});

router.post('/:id/poker/:idSesion/finalizar', (req, res) => {
  const ctx = preparar(req, res);
  if (!ctx || !soloScrumMaster(ctx, res)) return;
  const sesion = obtenerSesion(req, res, ctx);
  if (!sesion) return;
  if (sesion.estado !== 'revelada') return res.status(409).json({ mensaje: 'Debes revelar los votos antes de cerrar la sesión.' });
  const puntos = req.body?.puntos;
  const horas = req.body?.horasEstimadas;
  if (!Number.isInteger(puntos) || !CARTAS.includes(puntos)) {
    return res.status(400).json({ mensaje: 'Los puntos acordados deben corresponder a una carta Fibonacci.' });
  }
  if (typeof horas !== 'number' || !Number.isFinite(horas) || horas <= 0 || horas > 10000) {
    return res.status(400).json({ mensaje: 'Indica horas estimadas válidas (mayores a cero).' });
  }
  const historia = buscarHistoria(ctx.db, ctx.proyecto.id, sesion.idHistoria);
  if (!historia) return res.status(404).json({ mensaje: 'La historia ya no existe en este proyecto.' });
  const anterior = { puntosHistoria: historia.puntosHistoria ?? null, horasEstimadas: historia.horasEstimadas ?? null };
  historia.puntosHistoria = puntos;
  historia.horasEstimadas = horas;
  sesion.puntosAcordados = puntos;
  sesion.horasEstimadas = horas;
  sesion.fechaFinalizacion = new Date().toISOString();
  sesion.estado = 'finalizada';
  registrarHistorial(ctx.db, {
    idUsuario: req.usuario.id, entidad: 'historia_usuario', idEntidad: historia.id,
    campo: 'estimacion_planning_poker', valorAnterior: anterior,
    valorNuevo: { puntosHistoria: puntos, horasEstimadas: horas }
  });
  writeDB(ctx.db);
  return res.json({ mensaje: 'Estimación guardada en la historia de usuario.', sesion: descripcionSesion({ ...ctx, usuarioId: req.usuario.id }, sesion, true) });
});

module.exports = router;
