const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { requiereSesion } = require('../../middleware/auth');
const { puede, rolEnProyecto } = require('../../middleware/permisos');

router.use(requiereSesion);

const TIPOS = ['Sprint Planning', 'Daily Scrum', 'Sprint Review', 'Sprint Retrospective'];
const ESTADOS_ACCION = ['Pendiente', 'En curso', 'Completada'];
const ROLES_GESTION = ['Product Owner', 'Scrum Master', 'Developer'];

function puedeVer(db, usuario, idProyecto) {
  return puede(usuario, 'consultar_proyecto', idProyecto, db);
}

function puedeGestionar(db, usuario, idProyecto) {
  const proyecto = (db.proyectos || []).find(p => p.id === idProyecto);
  if (!proyecto || proyecto.archivado || !puedeVer(db, usuario, idProyecto)) return false;
  if (usuario.rolGlobal === 'administrador') return true;
  return ROLES_GESTION.includes(rolEnProyecto(usuario, idProyecto, db));
}

function idNuevo(lista, prefijo) {
  const mayor = lista.reduce((max, elemento) => {
    const id = String(elemento.id || '');
    const match = id.match(new RegExp(`^${prefijo}-(\\d+)$`));
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefijo}-${String(mayor + 1).padStart(3, '0')}`;
}

function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const objeto = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(objeto.getTime()) && objeto.toISOString().slice(0, 10) === fecha;
}

function nombreUsuario(db, id) {
  const u = (db.usuarios || []).find(item => item.id === id);
  return u ? `${u.nombre} ${u.apellidos}`.trim() : (id || 'Desconocido');
}

function participante(db, idProyecto, idUsuario, { permitirInteresado = true } = {}) {
  const usuario = (db.usuarios || []).find(u => u.id === idUsuario && u.estado === 'activo');
  if (!usuario) return false;
  return (db.participantes || []).some(p =>
    (p.idProyecto || p.proyectoId) === idProyecto &&
    (p.idUsuario || p.usuarioId) === idUsuario &&
    (permitirInteresado || p.rol !== 'Interesado')
  );
}

function resumenEstado(acuerdos = []) {
  if (!acuerdos.length) return 'Sin acuerdos';
  if (acuerdos.every(a => a.estado === 'Completada')) return 'Completados';
  if (acuerdos.some(a => a.estado === 'En curso' || a.estado === 'Completada')) return 'En seguimiento';
  return 'Pendientes';
}

function presentar(db, reunion, usuario) {
  const proyecto = (db.proyectos || []).find(p => p.id === reunion.idProyecto);
  const sprint = (db.sprints || []).find(s => s.id === reunion.idSprint && s.idProyecto === reunion.idProyecto);
  const acuerdos = (reunion.acuerdos || []).map(a => ({
    ...a,
    nombreResponsable: nombreUsuario(db, a.idResponsable),
    historial: (a.historial || []).map(h => ({ ...h, nombreUsuario: nombreUsuario(db, h.idUsuario) }))
  }));
  return {
    ...reunion,
    nombreProyecto: proyecto?.nombre || reunion.idProyecto,
    nombreSprint: sprint?.nombre || (reunion.idSprint ? reunion.idSprint : 'Sin Sprint'),
    nombresParticipantes: (reunion.participantes || []).map(id => nombreUsuario(db, id)),
    acuerdos,
    estadoAcuerdos: resumenEstado(acuerdos),
    puedeGestionar: puedeGestionar(db, usuario, reunion.idProyecto)
  };
}

router.get('/opciones', (req, res) => {
  const db = readDB();
  const proyectos = (db.proyectos || [])
    .filter(p => puedeGestionar(db, req.usuario, p.id))
    .map(p => ({ id: p.id, nombre: p.nombre }));
  const ids = new Set(proyectos.map(p => p.id));
  const sprints = (db.sprints || [])
    .filter(s => ids.has(s.idProyecto))
    .map(s => ({ id: s.id, idProyecto: s.idProyecto, nombre: s.nombre }));
  const participantes = (db.participantes || [])
    .filter(p => ids.has(p.idProyecto || p.proyectoId))
    .map(p => ({
      idProyecto: p.idProyecto || p.proyectoId,
      idUsuario: p.idUsuario || p.usuarioId,
      rol: p.rol,
      nombre: nombreUsuario(db, p.idUsuario || p.usuarioId)
    }))
    .filter(p => participante(db, p.idProyecto, p.idUsuario));
  res.json({ proyectos, sprints, participantes });
});

router.get('/', (req, res) => {
  const db = readDB();
  const reuniones = (db.reuniones || [])
    .filter(r => puedeVer(db, req.usuario, r.idProyecto))
    .map(r => presentar(db, r, req.usuario))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  res.json({ reuniones });
});

router.get('/:id', (req, res) => {
  const db = readDB();
  const reunion = (db.reuniones || []).find(r => r.id === req.params.id);
  if (!reunion) return res.status(404).json({ mensaje: 'Reunión no encontrada.' });
  if (!puedeVer(db, req.usuario, reunion.idProyecto)) {
    return res.status(403).json({ mensaje: 'No tienes acceso a esta reunión.' });
  }
  res.json({ reunion: presentar(db, reunion, req.usuario) });
});

router.post('/', (req, res) => {
  const { idProyecto, idSprint, tipo, fecha, participantes, observaciones } = req.body || {};
  const db = readDB();
  if (!puedeGestionar(db, req.usuario, idProyecto)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para registrar reuniones en ese proyecto.' });
  }
  if (!TIPOS.includes(tipo)) return res.status(400).json({ mensaje: 'Tipo de reunión no válido.' });
  if (!fechaValida(fecha)) return res.status(400).json({ mensaje: 'Indica una fecha válida.' });
  if (idSprint !== null && idSprint !== undefined && idSprint !== '') {
    const valido = (db.sprints || []).some(s => s.id === idSprint && s.idProyecto === idProyecto);
    if (!valido) return res.status(400).json({ mensaje: 'El Sprint no pertenece al proyecto indicado.' });
  }
  if (!Array.isArray(participantes) || participantes.length === 0 ||
      participantes.some(id => typeof id !== 'string') ||
      new Set(participantes).size !== participantes.length ||
      participantes.some(id => !participante(db, idProyecto, id))) {
    return res.status(400).json({ mensaje: 'Selecciona participantes activos del proyecto sin duplicados.' });
  }
  if (typeof observaciones !== 'string' || observaciones.length > 2000) {
    return res.status(400).json({ mensaje: 'Las observaciones deben ser texto de hasta 2000 caracteres.' });
  }
  if (!Array.isArray(db.reuniones)) db.reuniones = [];
  const reunion = {
    id: idNuevo(db.reuniones, 'REU'),
    idProyecto,
    idSprint: idSprint || null,
    tipo,
    fecha,
    participantes,
    observaciones: observaciones.trim(),
    acuerdos: [],
    idCreador: req.usuario.id,
    fechaRegistro: new Date().toISOString()
  };
  db.reuniones.push(reunion);
  registrarHistorial(db, {
    idUsuario: req.usuario.id, entidad: 'reunion', idEntidad: reunion.id,
    campo: 'creacion', valorAnterior: null, valorNuevo: { tipo, fecha, idProyecto }
  });
  writeDB(db);
  res.status(201).json({ mensaje: 'Reunión registrada correctamente.', reunion: presentar(db, reunion, req.usuario) });
});

router.post('/:id/acuerdos', (req, res) => {
  const db = readDB();
  const reunion = (db.reuniones || []).find(r => r.id === req.params.id);
  if (!reunion) return res.status(404).json({ mensaje: 'Reunión no encontrada.' });
  if (!puedeGestionar(db, req.usuario, reunion.idProyecto)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para registrar acuerdos en esta reunión.' });
  }
  const { descripcion, idResponsable, fechaCompromiso } = req.body || {};
  if (typeof descripcion !== 'string' || !descripcion.trim() || descripcion.trim().length > 1000) {
    return res.status(400).json({ mensaje: 'La descripción del acuerdo es obligatoria (máximo 1000 caracteres).' });
  }
  if (typeof idResponsable !== 'string' || !participante(db, reunion.idProyecto, idResponsable, { permitirInteresado: false })) {
    return res.status(400).json({ mensaje: 'El responsable debe ser un integrante activo del equipo.' });
  }
  if (fechaCompromiso !== null && fechaCompromiso !== undefined && fechaCompromiso !== '' && !fechaValida(fechaCompromiso)) {
    return res.status(400).json({ mensaje: 'La fecha del compromiso no es válida.' });
  }
  if (!Array.isArray(reunion.acuerdos)) reunion.acuerdos = [];
  const todosAcuerdos = (db.reuniones || []).flatMap(r => r.acuerdos || []);
  const ahora = new Date().toISOString();
  const acuerdo = {
    id: idNuevo(todosAcuerdos, 'ACU'),
    descripcion: descripcion.trim(),
    idResponsable,
    fechaCompromiso: fechaCompromiso || null,
    estado: 'Pendiente',
    fechaCreacion: ahora,
    idCreador: req.usuario.id,
    historial: []
  };
  reunion.acuerdos.push(acuerdo);
  registrarHistorial(db, {
    idUsuario: req.usuario.id, entidad: 'acuerdo', idEntidad: acuerdo.id,
    campo: 'creacion', valorAnterior: null,
    valorNuevo: { idReunion: reunion.id, descripcion: acuerdo.descripcion, idResponsable }
  });
  writeDB(db);
  res.status(201).json({ mensaje: 'Acuerdo agregado a la reunión.', acuerdo });
});

router.put('/:id/acuerdos/:acuerdoId', (req, res) => {
  const db = readDB();
  const reunion = (db.reuniones || []).find(r => r.id === req.params.id);
  if (!reunion) return res.status(404).json({ mensaje: 'Reunión no encontrada.' });
  if (!puedeGestionar(db, req.usuario, reunion.idProyecto)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para actualizar acuerdos.' });
  }
  const acuerdo = (reunion.acuerdos || []).find(a => a.id === req.params.acuerdoId);
  if (!acuerdo) return res.status(404).json({ mensaje: 'Acuerdo no encontrado.' });
  const { estado, idResponsable, fechaCompromiso, notaSeguimiento } = req.body || {};
  if (!ESTADOS_ACCION.includes(estado)) {
    return res.status(400).json({ mensaje: 'Estado de la acción no válido.' });
  }
  if (typeof idResponsable !== 'string' || !participante(db, reunion.idProyecto, idResponsable, { permitirInteresado: false })) {
    return res.status(400).json({ mensaje: 'El responsable debe pertenecer al equipo del proyecto.' });
  }
  if (fechaCompromiso !== null && fechaCompromiso !== undefined && fechaCompromiso !== '' && !fechaValida(fechaCompromiso)) {
    return res.status(400).json({ mensaje: 'Fecha de compromiso no válida.' });
  }
  if (typeof notaSeguimiento !== 'string' || notaSeguimiento.length > 1000) {
    return res.status(400).json({ mensaje: 'La nota de seguimiento debe tener hasta 1000 caracteres.' });
  }
  const antes = {
    estado: acuerdo.estado,
    idResponsable: acuerdo.idResponsable,
    fechaCompromiso: acuerdo.fechaCompromiso || null
  };
  const despues = { estado, idResponsable, fechaCompromiso: fechaCompromiso || null };
  const nota = notaSeguimiento.trim();
  const hayCambios = Object.keys(antes).some(k => antes[k] !== despues[k]);
  if (!hayCambios && !nota) {
    return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });
  }
  acuerdo.estado = estado;
  acuerdo.idResponsable = idResponsable;
  acuerdo.fechaCompromiso = fechaCompromiso || null;
  acuerdo.fechaActualizacion = new Date().toISOString();
  if (!Array.isArray(acuerdo.historial)) acuerdo.historial = [];
  acuerdo.historial.push({
    fecha: acuerdo.fechaActualizacion, idUsuario: req.usuario.id,
    valorAnterior: antes, valorNuevo: despues, nota
  });
  registrarHistorial(db, {
    idUsuario: req.usuario.id, entidad: 'acuerdo', idEntidad: acuerdo.id,
    campo: 'seguimiento', valorAnterior: antes, valorNuevo: { ...despues, nota }
  });
  writeDB(db);
  res.json({ mensaje: 'Seguimiento del acuerdo actualizado.', acuerdo });
});

module.exports = router;
