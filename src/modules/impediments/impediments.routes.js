const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { requiereSesion } = require('../../middleware/auth');
const { puede, rolEnProyecto } = require('../../middleware/permisos');

router.use(requiereSesion);

const ROLES_GESTION = ['Product Owner', 'Scrum Master', 'Developer'];
const ESTADOS_IMPEDIMENTO = ['Identificado', 'En atención', 'Resuelto'];
const PROBABILIDADES = ['Alta', 'Media', 'Baja'];
const ESTADOS_RIESGO = ['Identificado', 'En atención', 'Mitigado', 'Cerrado'];

function accesoLectura(usuario, proyectoId, db) {
  return puede(usuario, 'consultar_proyecto', proyectoId, db);
}

function accesoGestion(usuario, proyectoId, db) {
  if (!accesoLectura(usuario, proyectoId, db)) return false;
  if (usuario.rolGlobal === 'administrador') return true;
  return ROLES_GESTION.includes(rolEnProyecto(usuario, proyectoId, db));
}

function siguienteId(lista, prefijo) {
  const maximo = lista.reduce((max, item) => {
    const n = Number(String(item.id || '').replace(new RegExp(`^${prefijo}-`), ''));
    return Math.max(max, Number.isFinite(n) ? n : 0);
  }, 0);
  return `${prefijo}-${String(maximo + 1).padStart(3, '0')}`;
}

function nombreUsuario(db, idUsuario) {
  const usuario = (db.usuarios || []).find(u => u.id === idUsuario);
  return usuario ? `${usuario.nombre} ${usuario.apellidos}`.trim() : 'Sin asignar';
}

function proyectosGestionables(db, usuario) {
  return (db.proyectos || []).filter(p => !p.archivado && accesoGestion(usuario, p.id, db));
}

function tareasConProyecto(db) {
  const historias = new Map((db.historiasUsuario || []).map(h => [h.id, h]));
  const sprints = new Map((db.sprints || []).map(s => [s.id, s]));
  const tareas = new Map();

  for (const h of db.historiasUsuario || []) {
    for (const t of h.tareas || []) {
      if (!t.id) continue;
      tareas.set(t.id, { id: t.id, nombre: t.titulo || t.id, idProyecto: h.idProyecto });
    }
  }
  for (const t of db.tareas || []) {
    if (!t.id) continue;
    const h = historias.get(t.idHistoria);
    const s = sprints.get(t.idSprint);
    const idProyecto = h?.idProyecto || s?.idProyecto;
    if (!idProyecto) continue;
    tareas.set(t.id, { id: t.id, nombre: t.titulo || t.id, idProyecto });
  }
  return [...tareas.values()];
}

function resolverRelacion(db, tipo, id) {
  if (tipo === 'proyecto') {
    const p = (db.proyectos || []).find(p => p.id === id);
    return p && { idProyecto: p.id, nombre: p.nombre };
  }
  if (tipo === 'sprint') {
    const s = (db.sprints || []).find(s => s.id === id);
    return s && { idProyecto: s.idProyecto, nombre: s.nombre };
  }
  if (tipo === 'historia') {
    const h = (db.historiasUsuario || []).find(h => h.id === id);
    return h && { idProyecto: h.idProyecto, nombre: h.titulo };
  }
  if (tipo === 'tarea') {
    const t = tareasConProyecto(db).find(t => t.id === id);
    return t && { idProyecto: t.idProyecto, nombre: t.nombre };
  }
  return null;
}

function responsableValido(db, proyectoId, idUsuario) {
  const cuenta = (db.usuarios || []).find(u => u.id === idUsuario && u.estado === 'activo');
  const pertenece = (db.participantes || []).some(p =>
    (p.idProyecto || p.proyectoId) === proyectoId &&
    (p.idUsuario || p.usuarioId) === idUsuario &&
    p.rol !== 'Interesado'
  );
  return Boolean(cuenta && pertenece);
}

function fechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

router.get('/opciones', (req, res) => {
  const db = readDB();
  const proyectos = proyectosGestionables(db, req.usuario).map(p => ({ id: p.id, nombre: p.nombre }));
  const ids = new Set(proyectos.map(p => p.id));

  const sprints = (db.sprints || [])
    .filter(s => ids.has(s.idProyecto))
    .map(s => ({ id: s.id, idProyecto: s.idProyecto, nombre: s.nombre }));
  const historias = (db.historiasUsuario || [])
    .filter(h => ids.has(h.idProyecto))
    .map(h => ({ id: h.id, idProyecto: h.idProyecto, nombre: h.titulo }));
  const tareas = tareasConProyecto(db).filter(t => ids.has(t.idProyecto));
  const participantes = (db.participantes || [])
    .filter(p => ids.has(p.idProyecto || p.proyectoId))
    .map(p => ({
      idProyecto: p.idProyecto || p.proyectoId,
      idUsuario: p.idUsuario || p.usuarioId,
      rol: p.rol,
      nombre: nombreUsuario(db, p.idUsuario || p.usuarioId),
      activo: (db.usuarios || []).some(u => u.id === (p.idUsuario || p.usuarioId) && u.estado === 'activo')
    }))
    .filter(p => p.activo && p.rol !== 'Interesado');

  res.json({ proyectos, sprints, historias, tareas, participantes });
});

router.get('/', (req, res) => {
  const db = readDB();
  const impedimentos = (db.impedimentos || [])
    .filter(i => accesoLectura(req.usuario, i.idProyecto, db))
    .map(i => ({
      ...i,
      nombreResponsable: i.idResponsable ? nombreUsuario(db, i.idResponsable) : 'Sin asignar',
      nombreRelacionado: resolverRelacion(db, i.tipoRelacion, i.idRelacionado)?.nombre || i.idRelacionado
    }));
  res.json({ impedimentos });
});

router.post('/', (req, res) => {
  const { descripcion, idProyecto, tipoRelacion, idRelacionado } = req.body || {};
  if (typeof descripcion !== 'string' || !descripcion.trim() || descripcion.trim().length > 500) {
    return res.status(400).json({ mensaje: 'La descripción es obligatoria y debe tener hasta 500 caracteres.' });
  }
  if (!['proyecto', 'sprint', 'historia', 'tarea'].includes(tipoRelacion)
      || typeof idProyecto !== 'string' || typeof idRelacionado !== 'string') {
    return res.status(400).json({ mensaje: 'Selecciona una relación válida.' });
  }

  const db = readDB();
  const proyecto = (db.proyectos || []).find(p => p.id === idProyecto);
  if (!proyecto) return res.status(404).json({ mensaje: 'Proyecto no encontrado.' });
  if (proyecto.archivado) return res.status(409).json({ mensaje: 'No se pueden agregar impedimentos a un proyecto archivado.' });
  if (!accesoGestion(req.usuario, idProyecto, db)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para registrar impedimentos en este proyecto.' });
  }
  const relacion = resolverRelacion(db, tipoRelacion, idRelacionado);
  if (!relacion || relacion.idProyecto !== idProyecto) {
    return res.status(400).json({ mensaje: 'El elemento relacionado no pertenece al proyecto indicado.' });
  }

  if (!Array.isArray(db.impedimentos)) db.impedimentos = [];
  const impedimento = {
    id: siguienteId(db.impedimentos, 'IMP'),
    idProyecto,
    descripcion: descripcion.trim(),
    tipoRelacion,
    idRelacionado,
    estado: 'Identificado',
    idResponsable: null,
    idReportadoPor: req.usuario.id,
    fechaRegistro: new Date().toISOString(),
    acciones: []
  };
  db.impedimentos.push(impedimento);
  registrarHistorial(db, {
    idUsuario: req.usuario.id,
    entidad: 'impedimento',
    idEntidad: impedimento.id,
    campo: 'creacion',
    valorAnterior: null,
    valorNuevo: impedimento.descripcion
  });
  writeDB(db);
  res.status(201).json({ mensaje: 'Impedimento registrado correctamente.', impedimento });
});

router.put('/:id/seguimiento', (req, res) => {
  const db = readDB();
  const impedimento = (db.impedimentos || []).find(i => i.id === req.params.id);
  if (!impedimento) return res.status(404).json({ mensaje: 'Impedimento no encontrado.' });
  if (!accesoGestion(req.usuario, impedimento.idProyecto, db)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para actualizar este impedimento.' });
  }
  const { idResponsable, estado, accion } = req.body || {};
  if (!ESTADOS_IMPEDIMENTO.includes(estado)) {
    return res.status(400).json({ mensaje: 'Estado de impedimento no válido.' });
  }
  if (typeof idResponsable !== 'string' || !responsableValido(db, impedimento.idProyecto, idResponsable)) {
    return res.status(400).json({ mensaje: 'Selecciona un responsable activo del equipo del proyecto.' });
  }
  if (typeof accion !== 'string' || accion.length > 1000) {
    return res.status(400).json({ mensaje: 'La acción debe ser texto de hasta 1000 caracteres.' });
  }
  const textoAccion = accion.trim();
  const estadoAnterior = impedimento.estado;
  const responsableAnterior = impedimento.idResponsable || null;
  if (estadoAnterior === estado && responsableAnterior === idResponsable && !textoAccion) {
    return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });
  }

  const fecha = new Date().toISOString();
  impedimento.estado = estado;
  impedimento.idResponsable = idResponsable;
  impedimento.fechaActualizacion = fecha;
  if (!Array.isArray(impedimento.acciones)) impedimento.acciones = [];
  if (textoAccion) {
    impedimento.acciones.push({
      id: siguienteId(impedimento.acciones, 'ACC'),
      descripcion: textoAccion,
      idUsuario: req.usuario.id,
      fecha
    });
  }
  registrarHistorial(db, {
    idUsuario: req.usuario.id,
    entidad: 'impedimento',
    idEntidad: impedimento.id,
    campo: 'seguimiento',
    valorAnterior: { estado: estadoAnterior, idResponsable: responsableAnterior },
    valorNuevo: { estado, idResponsable, accion: textoAccion || null }
  });
  writeDB(db);
  res.json({ mensaje: 'Seguimiento actualizado correctamente.', impedimento });
});

router.get('/riesgos', (req, res) => {
  const db = readDB();
  const riesgos = (db.riesgos || [])
    .filter(r => accesoLectura(req.usuario, r.idProyecto, db))
    .map(r => ({ ...r, nombreResponsable: nombreUsuario(db, r.idResponsable) }));
  res.json({ riesgos });
});

router.post('/riesgos', (req, res) => {
  const { idProyecto, descripcion, probabilidad, idResponsable, accionesRespuesta, fechaRevision } = req.body || {};
  if (typeof descripcion !== 'string' || !descripcion.trim() || descripcion.trim().length > 500) {
    return res.status(400).json({ mensaje: 'La descripción del riesgo es obligatoria (máximo 500 caracteres).' });
  }
  if (!PROBABILIDADES.includes(probabilidad)) {
    return res.status(400).json({ mensaje: 'Selecciona una probabilidad válida: Alta, Media o Baja.' });
  }
  if (typeof accionesRespuesta !== 'string' || accionesRespuesta.length > 1000) {
    return res.status(400).json({ mensaje: 'Las acciones de respuesta no pueden superar 1000 caracteres.' });
  }
  if (!fechaValida(fechaRevision)) {
    return res.status(400).json({ mensaje: 'Indica una fecha de revisión válida (AAAA-MM-DD).' });
  }
  const db = readDB();
  const proyecto = (db.proyectos || []).find(p => p.id === idProyecto);
  if (!proyecto) return res.status(404).json({ mensaje: 'Proyecto no encontrado.' });
  if (proyecto.archivado) return res.status(409).json({ mensaje: 'No se pueden agregar riesgos a un proyecto archivado.' });
  if (!accesoGestion(req.usuario, idProyecto, db)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para registrar riesgos en este proyecto.' });
  }
  if (typeof idResponsable !== 'string' || !responsableValido(db, idProyecto, idResponsable)) {
    return res.status(400).json({ mensaje: 'El responsable debe ser un integrante activo del proyecto.' });
  }

  if (!Array.isArray(db.riesgos)) db.riesgos = [];
  const riesgo = {
    id: siguienteId(db.riesgos, 'RSK'),
    idProyecto,
    descripcion: descripcion.trim(),
    probabilidad,
    idResponsable,
    accionesRespuesta: accionesRespuesta.trim(),
    fechaRevision,
    estado: 'Identificado',
    idReportadoPor: req.usuario.id,
    fechaRegistro: new Date().toISOString()
  };
  db.riesgos.push(riesgo);
  registrarHistorial(db, {
    idUsuario: req.usuario.id,
    entidad: 'riesgo',
    idEntidad: riesgo.id,
    campo: 'creacion',
    valorAnterior: null,
    valorNuevo: riesgo.descripcion
  });
  writeDB(db);
  res.status(201).json({ mensaje: 'Riesgo registrado correctamente.', riesgo });
});

router.put('/riesgos/:id/seguimiento', (req, res) => {
  const db = readDB();
  const riesgo = (db.riesgos || []).find(r => r.id === req.params.id);
  if (!riesgo) return res.status(404).json({ mensaje: 'Riesgo no encontrado.' });

  if (!accesoGestion(req.usuario, riesgo.idProyecto, db)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para actualizar este riesgo.' });
  }
  const proyecto = (db.proyectos || []).find(p => p.id === riesgo.idProyecto);
  if (!proyecto || proyecto.archivado) {
    return res.status(409).json({ mensaje: 'No se puede modificar un riesgo de un proyecto archivado.' });
  }

  const { estado, accionesRespuesta, fechaRevision, accionSeguimiento } = req.body || {};
  if (!ESTADOS_RIESGO.includes(estado)) {
    return res.status(400).json({ mensaje: 'Selecciona un estado de riesgo válido.' });
  }
  if (typeof accionesRespuesta !== 'string' || accionesRespuesta.length > 1000) {
    return res.status(400).json({ mensaje: 'Las acciones de respuesta deben ser texto de hasta 1000 caracteres.' });
  }
  if (!fechaValida(fechaRevision)) {
    return res.status(400).json({ mensaje: 'La fecha de revisión debe tener formato AAAA-MM-DD y ser válida.' });
  }
  if (typeof accionSeguimiento !== 'string' || accionSeguimiento.length > 1000) {
    return res.status(400).json({ mensaje: 'La acción de seguimiento debe ser texto de hasta 1000 caracteres.' });
  }

  const nuevasAcciones = accionesRespuesta.trim();
  const nuevaAccion = accionSeguimiento.trim();
  const anterior = {
    estado: riesgo.estado || 'Identificado',
    accionesRespuesta: riesgo.accionesRespuesta || '',
    fechaRevision: riesgo.fechaRevision || null
  };
  const nuevo = { estado, accionesRespuesta: nuevasAcciones, fechaRevision };
  const hayCambios = anterior.estado !== nuevo.estado ||
    anterior.accionesRespuesta !== nuevo.accionesRespuesta ||
    anterior.fechaRevision !== nuevo.fechaRevision;
  if (!hayCambios && !nuevaAccion) {
    return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });
  }

  const fecha = new Date().toISOString();
  riesgo.estado = estado;
  riesgo.accionesRespuesta = nuevasAcciones;
  riesgo.fechaRevision = fechaRevision;
  riesgo.fechaActualizacion = fecha;
  if (!Array.isArray(riesgo.seguimientos)) riesgo.seguimientos = [];
  riesgo.seguimientos.push({
    id: siguienteId(riesgo.seguimientos, 'SEG'),
    idUsuario: req.usuario.id,
    fecha,
    accion: nuevaAccion,
    valorAnterior: anterior,
    valorNuevo: nuevo
  });

  registrarHistorial(db, {
    idUsuario: req.usuario.id,
    entidad: 'riesgo',
    idEntidad: riesgo.id,
    campo: 'seguimiento',
    valorAnterior: anterior,
    valorNuevo: { ...nuevo, accionSeguimiento: nuevaAccion || null }
  });
  writeDB(db);
  return res.json({ mensaje: 'Seguimiento del riesgo actualizado.', riesgo });
});

module.exports = router;
