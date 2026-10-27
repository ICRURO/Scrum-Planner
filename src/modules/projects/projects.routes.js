// /api/projects — proyectos, Product Backlog e historias de usuario
const express = require('express');
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { requiereSesion } = require('../../middleware/auth');
const { puede, rolEnProyecto, permisosProyecto, esParticipante, apiConPermiso } = require('../../middleware/permisos');

const router = express.Router();
router.use(requiereSesion);

const ETIQUETAS = { preparacion: 'En preparación', activo: 'Activo', suspendido: 'Suspendido', finalizado: 'Finalizado' };

// Transiciones permitidas con "Cambiar estado". Finalizar y reabrir tienen su propia ruta.
const TRANSICIONES = {
  preparacion: ['activo'],
  activo: ['suspendido'],
  suspendido: ['activo'],
  finalizado: []
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const CAMPOS_EDITABLES = ['nombre', 'descripcion', 'objetivo', 'fechaInicio', 'fechaFin'];
const ESTIMACIONES = ['XS', 'S', 'M', 'L', 'XL'];

// El administrador ve todos; los demás solo los proyectos donde participan (RF-09)
const proyectosVisibles = (db, usuario) =>
  db.proyectos.filter((p) => usuario.rolGlobal === 'administrador' || esParticipante(usuario, p.id, db));

function siguienteId(db) {
  const max = db.proyectos.reduce((m, p) => Math.max(m, parseInt(p.id.split('-')[1], 10) || 0), 0);
  return `PRJ-${String(max + 1).padStart(3, '0')}`;
}

function siguienteIdHistoria(historias) {
  const max = historias.reduce((m, h) => Math.max(m, parseInt(String(h.id).replace(/^HU-/, ''), 10) || 0), 0);
  return `HU-${String(max + 1).padStart(3, '0')}`;
}

function siguienteIdCriterio(historias) {
  const max = historias.reduce((m, h) =>
    (h.criterios || []).reduce((n, c) => Math.max(n, parseInt(String(c.id).replace(/^CA-/, ''), 10) || 0), m), 0);
  return `CA-${String(max + 1).padStart(3, '0')}`;
}

function validarHistoria(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return 'Los datos de la historia no son válidos.';
  if (typeof datos.titulo !== 'string' || !datos.titulo.trim()) return 'El título de la historia es obligatorio.';
  if (typeof datos.descripcion !== 'string' || !datos.descripcion.trim()) return 'La descripción es obligatoria.';
  if (datos.estimacion !== undefined && datos.estimacion !== null && !ESTIMACIONES.includes(datos.estimacion)) {
    return 'La estimación debe ser una talla XS, S, M, L o XL.';
  }
  if (datos.criterios !== undefined && !Array.isArray(datos.criterios)) return 'Los criterios deben enviarse como una lista.';
  for (const criterio of datos.criterios || []) {
    if (!criterio || typeof criterio !== 'object' || Array.isArray(criterio)) return 'Cada criterio debe incluir Dado, Cuando y Entonces.';
    for (const campo of ['dado', 'cuando', 'entonces']) {
      if (typeof criterio[campo] !== 'string' || !criterio[campo].trim()) return 'Cada criterio debe incluir Dado, Cuando y Entonces.';
    }
  }
  return null;
}

function normalizarCriterios(db, historia, criterios) {
  const actuales = historia ? historia.criterios || [] : [];
  const idsActuales = new Set(actuales.map((c) => c.id));
  const idsRecibidos = new Set();
  const lista = [];
  let siguienteNumero = parseInt(siguienteIdCriterio(db.historiasUsuario).slice(3), 10);

  for (const criterio of criterios || []) {
    if (criterio.id && (!idsActuales.has(criterio.id) || idsRecibidos.has(criterio.id))) {
      return { error: 'Uno de los criterios no pertenece a esta historia o está duplicado.' };
    }
    const id = criterio.id || `CA-${String(siguienteNumero++).padStart(3, '0')}`;
    idsRecibidos.add(id);
    lista.push({
      id,
      dado: String(criterio.dado).trim(),
      cuando: String(criterio.cuando).trim(),
      entonces: String(criterio.entonces).trim()
    });
  }

  if (historia && actuales.some((criterio) => !idsRecibidos.has(criterio.id))) {
    return { error: 'No se pueden quitar criterios existentes; modifica su contenido o agrega otro.' };
  }
  return { lista };
}

function textoCambio(h) {
  if (h.campo === 'creacion') return 'Proyecto creado';
  if (h.campo === 'estado') return `Estado: ${ETIQUETAS[h.valorAnterior] || h.valorAnterior} → ${ETIQUETAS[h.valorNuevo] || h.valorNuevo}`;
  if (h.campo === 'archivado') return h.valorNuevo ? 'Proyecto archivado' : 'Proyecto desarchivado';
  if (h.entidad === 'historia_usuario') {
    if (h.campo === 'creacion') return `Historia creada: ${h.valorNuevo}`;
    if (h.campo === 'edicion') return 'Historia editada';
    if (h.campo === 'refinamiento') return 'Historia refinada';
    if (h.campo === 'division') return `Historia dividida; se creó ${h.valorNuevo}`;
    if (h.campo === 'orden') return `Prioridad actualizada: ${h.valorAnterior} → ${h.valorNuevo}`;
    if (h.campo === 'comentario') return 'Comentario agregado a una historia';
  }
  if (h.valorNuevo && typeof h.valorNuevo === 'object') return `Información editada (${Object.keys(h.valorNuevo).join(', ')})`;
  return 'Información editada';
}

// Valida los campos de un proyecto. Devuelve un mensaje de error o null.
function validar(d) {
  for (const c of ['nombre', 'descripcion', 'objetivo']) {
    if (!String(d[c] || '').trim()) return `El campo ${c} es obligatorio.`;
  }
  if (!FECHA.test(d.fechaInicio || '') || !FECHA.test(d.fechaFin || '')) return 'Las fechas de inicio y fin son obligatorias (formato AAAA-MM-DD).';
  if (d.fechaFin < d.fechaInicio) return 'La fecha de fin debe ser posterior a la de inicio.';
  return null;
}

// Busca el proyecto o responde 404. Un proyecto archivado solo admite desarchivarse.
function cargar(req, res, { permitirArchivado = false } = {}) {
  const db = readDB();
  const proyecto = db.proyectos.find((p) => p.id === req.params.id);
  if (!proyecto) { res.status(404).json({ mensaje: 'No se encontró el proyecto.' }); return null; }
  if (proyecto.archivado && !permitirArchivado) {
    res.status(409).json({ mensaje: 'El proyecto está archivado. Desarchívalo para modificarlo.' });
    return null;
  }
  return { db, proyecto };
}

// ---------- Consultas ----------
router.get('/', (req, res) => {
  const db = readDB();
  const u = req.usuario;
  res.json({
    puedeCrear: puede(u, 'crear_proyecto', undefined, db),
    siguienteId: siguienteId(db),
    proyectos: proyectosVisibles(db, u).map((p) => ({ ...p, miRol: rolEnProyecto(u, p.id, db), permisos: permisosProyecto(u, p, db) }))
  });
});

router.get('/:id', (req, res) => {
  const db = readDB();
  const u = req.usuario;
  const proyecto = db.proyectos.find((p) => p.id === req.params.id);
  if (!proyecto) return res.status(404).json({ mensaje: 'No se encontró el proyecto.' });
  if (!puede(u, 'consultar_proyecto', proyecto.id, db)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción.' });
  }
  const historiasUsuario = (db.historiasUsuario || [])
    .filter((h) => h.idProyecto === proyecto.id)
    .map((h, indice) => ({
      ...h,
      orden: Number.isInteger(h.orden) && h.orden > 0 ? h.orden : indice + 1,
      divisiones: (db.historiasUsuario || []).filter((derivada) => derivada.idHistoriaOrigen === h.id).map((derivada) => derivada.id),
      comentarios: (h.comentarios || []).map((comentario) => {
        const autor = db.usuarios.find((x) => x.id === comentario.idUsuario);
        return {
          ...comentario,
          usuario: autor ? `${autor.nombre} ${autor.apellidos}` : 'Desconocido'
        };
      }),
      aclaraciones: (h.aclaraciones || []).map((aclaracion) => {
        const autor = db.usuarios.find((x) => x.id === aclaracion.idUsuario);
        return { ...aclaracion, usuario: autor ? `${autor.nombre} ${autor.apellidos}` : 'Desconocido' };
      })
    }))
    .sort((a, b) => a.orden - b.orden);
  const idsHistorias = new Set(historiasUsuario.map((h) => h.id));
  const historial = (db.historial || [])
    .filter((h) => (h.entidad === 'proyecto' && h.idEntidad === proyecto.id)
      || (h.entidad === 'historia_usuario' && idsHistorias.has(h.idEntidad)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((h) => {
      const autor = db.usuarios.find((x) => x.id === h.idUsuario);
      return { fecha: h.fecha, usuario: autor ? `${autor.nombre} ${autor.apellidos}` : 'Desconocido', cambio: textoCambio(h) };
    });
  res.json({ proyecto, miRol: rolEnProyecto(u, proyecto.id, db), permisos: permisosProyecto(u, proyecto, db), historial, historiasUsuario, siguienteId: siguienteId(db) });
});

// ---------- HU-18, HU-19, HU-20 y HU-21 Historias, prioridad y comentarios ----------
router.post('/:id/historias', apiConPermiso('gestionar_historias', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const datos = req.body || {};
  const error = validarHistoria(datos);
  if (error) return res.status(400).json({ mensaje: error });

  const db = ctx.db;
  if (!db.historiasUsuario) db.historiasUsuario = [];
  const criterios = normalizarCriterios(db, null, datos.criterios);
  if (criterios.error) return res.status(400).json({ mensaje: criterios.error });

  const historia = {
    id: siguienteIdHistoria(db.historiasUsuario),
    idProyecto: ctx.proyecto.id,
    titulo: String(datos.titulo).trim(),
    descripcion: String(datos.descripcion).trim(),
    criterios: criterios.lista,
    estimacion: datos.estimacion || null,
    orden: db.historiasUsuario.filter((h) => h.idProyecto === ctx.proyecto.id).length + 1,
    comentarios: []
  };
  db.historiasUsuario.push(historia);
  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'historia_usuario', idEntidad: historia.id, campo: 'creacion', valorNuevo: historia.titulo });
  writeDB(db);
  res.status(201).json({ mensaje: 'Historia de usuario registrada.', historia });
});


router.post('/:id/historias/:idHistoria/divisiones', apiConPermiso('gestionar_historias', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const db = ctx.db;
  const origen = (db.historiasUsuario || []).find((h) => h.id === req.params.idHistoria && h.idProyecto === ctx.proyecto.id);
  if (!origen) return res.status(404).json({ mensaje: 'No se encontró la historia de usuario en este proyecto.' });

  const historias = req.body?.historias;
  if (!Array.isArray(historias) || historias.length < 2) {
    return res.status(400).json({ mensaje: 'Una división debe incluir al menos dos historias resultantes.' });
  }
  for (const datos of historias) {
    const error = validarHistoria(datos);
    if (error) return res.status(400).json({ mensaje: error });
  }

  let orden = db.historiasUsuario.filter((h) => h.idProyecto === ctx.proyecto.id).length;
  const creadas = historias.map((datos) => {
    const criterios = normalizarCriterios(db, null, datos.criterios);
    if (criterios.error) return { error: criterios.error };
    const historia = {
      id: siguienteIdHistoria(db.historiasUsuario),
      idProyecto: ctx.proyecto.id,
      idHistoriaOrigen: origen.id,
      titulo: String(datos.titulo).trim(),
      descripcion: String(datos.descripcion).trim(),
      criterios: criterios.lista,
      estimacion: datos.estimacion || null,
      orden: ++orden,
      comentarios: [],
      aclaraciones: []
    };
    db.historiasUsuario.push(historia);
    registrarHistorial(db, {
      idUsuario: req.usuario.id,
      entidad: 'historia_usuario',
      idEntidad: historia.id,
      campo: 'creacion',
      valorNuevo: historia.titulo
    });
    registrarHistorial(db, {
      idUsuario: req.usuario.id,
      entidad: 'historia_usuario',
      idEntidad: origen.id,
      campo: 'division',
      valorNuevo: historia.id
    });
    return historia;
  });
  const errorCriterios = creadas.find((historia) => historia.error);
  if (errorCriterios) return res.status(400).json({ mensaje: errorCriterios.error });

  writeDB(db);
  res.status(201).json({ mensaje: 'Historias resultantes creadas y vinculadas con la historia original.', historias: creadas });
});

// ---------- HU-20 Priorizar historias del Product Backlog ----------
router.put('/:id/historias/orden', apiConPermiso('priorizar_historias', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const historias = (ctx.db.historiasUsuario || []).filter((h) => h.idProyecto === ctx.proyecto.id);
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length !== historias.length
    || ids.some((idHistoria) => typeof idHistoria !== 'string')
    || new Set(ids).size !== historias.length
    || ids.some((idHistoria) => !historias.some((h) => h.id === idHistoria))) {
    return res.status(400).json({ mensaje: 'Envía el orden completo y válido de las historias del proyecto.' });
  }

  const ordenAnterior = historias
    .map((h, indice) => ({ id: h.id, orden: Number.isInteger(h.orden) && h.orden > 0 ? h.orden : indice + 1 }))
    .sort((a, b) => a.orden - b.orden)
    .map((h) => h.id);
  if (ids.every((idHistoria, indice) => idHistoria === ordenAnterior[indice])) {
    return res.status(400).json({ mensaje: 'El Product Backlog ya tiene ese orden.' });
  }

  ids.forEach((idHistoria, indice) => {
    const historia = historias.find((h) => h.id === idHistoria);
    const ordenAnteriorHistoria = Number.isInteger(historia.orden) && historia.orden > 0 ? historia.orden : ordenAnterior.indexOf(idHistoria) + 1;
    historia.orden = indice + 1;
    if (ordenAnteriorHistoria !== historia.orden) {
      registrarHistorial(ctx.db, {
        idUsuario: req.usuario.id,
        entidad: 'historia_usuario',
        idEntidad: historia.id,
        campo: 'orden',
        valorAnterior: ordenAnteriorHistoria,
        valorNuevo: historia.orden
      });
    }
  });
  writeDB(ctx.db);
  res.json({ mensaje: 'El orden del Product Backlog se actualizó.', ids });
});

// ---------- HU-21 Comentar historias ----------
router.post('/:id/historias/:idHistoria/comentarios', apiConPermiso('comentar_historias', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const historia = (ctx.db.historiasUsuario || []).find((h) => h.id === req.params.idHistoria && h.idProyecto === ctx.proyecto.id);
  if (!historia) return res.status(404).json({ mensaje: 'No se encontró la historia de usuario en este proyecto.' });

  const texto = req.body?.texto;
  if (typeof texto !== 'string' || !texto.trim() || texto.trim().length > 2000) {
    return res.status(400).json({ mensaje: 'El comentario es obligatorio y no puede superar 2000 caracteres.' });
  }

  if (!historia.comentarios) historia.comentarios = [];
  const max = historia.comentarios.reduce((m, c) => Math.max(m, parseInt(String(c.id).replace(/^COM-/, ''), 10) || 0), 0);
  const comentario = {
    id: `COM-${String(max + 1).padStart(3, '0')}`,
    idUsuario: req.usuario.id,
    texto: texto.trim(),
    fecha: new Date().toISOString()
  };
  historia.comentarios.push(comentario);
  registrarHistorial(ctx.db, {
    idUsuario: req.usuario.id,
    entidad: 'historia_usuario',
    idEntidad: historia.id,
    campo: 'comentario',
    valorNuevo: comentario.texto
  });
  writeDB(ctx.db);
  const autor = ctx.db.usuarios.find((x) => x.id === req.usuario.id);
  res.status(201).json({
    mensaje: 'Comentario agregado.',
    comentario: { ...comentario, usuario: autor ? `${autor.nombre} ${autor.apellidos}` : 'Desconocido' }
  });
});

router.put('/:id/historias/:idHistoria', apiConPermiso('refinar_historias', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const db = ctx.db;
  const historia = (db.historiasUsuario || []).find((h) => h.id === req.params.idHistoria && h.idProyecto === ctx.proyecto.id);
  if (!historia) return res.status(404).json({ mensaje: 'No se encontró la historia de usuario en este proyecto.' });

  const datos = req.body || {};
  const error = validarHistoria(datos);
  if (error) return res.status(400).json({ mensaje: error });
  const criterios = normalizarCriterios(db, historia, datos.criterios === undefined ? historia.criterios : datos.criterios);
  if (criterios.error) return res.status(400).json({ mensaje: criterios.error });

  const titulo = String(datos.titulo).trim();
  const descripcion = String(datos.descripcion).trim();
  const estimacion = datos.estimacion === undefined ? historia.estimacion || null : datos.estimacion || null;
  const aclaracion = datos.aclaracion === undefined ? '' : datos.aclaracion;
  if (typeof aclaracion !== 'string' || aclaracion.length > 2000) {
    return res.status(400).json({ mensaje: 'La aclaración no puede superar 2000 caracteres.' });
  }
  const cambios = titulo !== historia.titulo || descripcion !== historia.descripcion
    || estimacion !== (historia.estimacion || null)
    || JSON.stringify(criterios.lista) !== JSON.stringify(historia.criterios || [])
    || !!aclaracion.trim();
  if (!cambios) return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });

  const valorAnterior = { titulo: historia.titulo, descripcion: historia.descripcion, criterios: historia.criterios || [], estimacion: historia.estimacion || null };
  historia.titulo = titulo;
  historia.descripcion = descripcion;
  historia.criterios = criterios.lista;
  historia.estimacion = estimacion;
  const valorNuevo = { titulo, descripcion, criterios: historia.criterios, estimacion };
  if (aclaracion.trim()) {
    if (!historia.aclaraciones) historia.aclaraciones = [];
    const max = historia.aclaraciones.reduce((m, item) => Math.max(m, parseInt(String(item.id).replace(/^ACL-/, ''), 10) || 0), 0);
    const nuevaAclaracion = {
      id: `ACL-${String(max + 1).padStart(3, '0')}`,
      idUsuario: req.usuario.id,
      texto: aclaracion.trim(),
      fecha: new Date().toISOString()
    };
    historia.aclaraciones.push(nuevaAclaracion);
    valorNuevo.aclaracion = nuevaAclaracion.texto;
  }
  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'historia_usuario', idEntidad: historia.id, campo: 'refinamiento', valorAnterior, valorNuevo });
  writeDB(db);
  res.json({ mensaje: 'Historia de usuario actualizada.', historia });
});

// ---------- HU-08 Crear proyecto ----------
router.post('/', apiConPermiso('crear_proyecto'), (req, res) => {
  const d = req.body || {};
  const error = validar(d);
  if (error) return res.status(400).json({ mensaje: error });

  const db = readDB();
  const proyecto = {
    id: siguienteId(db),
    nombre: String(d.nombre).trim(),
    descripcion: String(d.descripcion).trim(),
    objetivo: String(d.objetivo).trim(),
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin,
    estado: 'preparacion',
    archivado: false
  };
  db.proyectos.push(proyecto);

  // Quien crea el proyecto (si no es el administrador) queda como su Product Owner
  if (req.usuario.rolGlobal !== 'administrador') {
    if (!db.participantes) db.participantes = [];
    const max = db.participantes.reduce((m, p) => Math.max(m, parseInt(String(p.id).split('-')[1], 10) || 0), 0);
    db.participantes.push({ id: `PAR-${String(max + 1).padStart(3, '0')}`, idProyecto: proyecto.id, idUsuario: req.usuario.id, rol: 'Product Owner' });
  }

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'proyecto', idEntidad: proyecto.id, campo: 'creacion', valorNuevo: proyecto.nombre });
  writeDB(db);
  res.status(201).json({ mensaje: 'Proyecto creado.', proyecto });
});

// ---------- HU-10 Modificar información ----------
router.put('/:id', apiConPermiso('editar_proyecto', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, proyecto } = ctx;

  const d = { ...proyecto, ...(req.body || {}) };
  const error = validar(d);
  if (error) return res.status(400).json({ mensaje: error });

  const antes = {}, despues = {};
  CAMPOS_EDITABLES.forEach((c) => {
    const nuevo = typeof d[c] === 'string' ? d[c].trim() : d[c];
    if (nuevo !== proyecto[c]) { antes[c] = proyecto[c]; despues[c] = nuevo; proyecto[c] = nuevo; }
  });
  if (!Object.keys(despues).length) return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'proyecto', idEntidad: proyecto.id, campo: 'informacion', valorAnterior: antes, valorNuevo: despues });
  writeDB(db);
  res.json({ mensaje: 'Proyecto actualizado.', proyecto });
});

// ---------- HU-11 Cambiar estado ----------
router.put('/:id/estado', apiConPermiso('cambiar_estado', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, proyecto } = ctx;
  const nuevo = req.body?.estado;

  if (!ETIQUETAS[nuevo]) return res.status(400).json({ mensaje: 'Estado no válido.' });
  if (nuevo === 'finalizado') return res.status(400).json({ mensaje: 'Para finalizar usa la acción "Finalizar proyecto".' });
  if (!(TRANSICIONES[proyecto.estado] || []).includes(nuevo)) {
    return res.status(409).json({ mensaje: `No se puede pasar de ${ETIQUETAS[proyecto.estado]} a ${ETIQUETAS[nuevo]}.` });
  }

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'proyecto', idEntidad: proyecto.id, campo: 'estado', valorAnterior: proyecto.estado, valorNuevo: nuevo });
  proyecto.estado = nuevo;
  writeDB(db);
  res.json({ mensaje: `Estado cambiado a ${ETIQUETAS[nuevo]}.`, proyecto });
});

// ---------- HU-12 Finalizar y reabrir ----------
router.put('/:id/finalizar', apiConPermiso('finalizar_proyecto', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, proyecto } = ctx;
  if (proyecto.estado === 'finalizado') return res.status(409).json({ mensaje: 'El proyecto ya está finalizado.' });
  if (proyecto.estado === 'preparacion') return res.status(409).json({ mensaje: 'Un proyecto en preparación no puede finalizarse; actívalo primero.' });

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'proyecto', idEntidad: proyecto.id, campo: 'estado', valorAnterior: proyecto.estado, valorNuevo: 'finalizado' });
  proyecto.estado = 'finalizado';
  writeDB(db);
  res.json({ mensaje: 'Proyecto finalizado.', proyecto });
});

router.put('/:id/reabrir', apiConPermiso('reabrir_proyecto', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res);
  if (!ctx) return;
  const { db, proyecto } = ctx;
  if (proyecto.estado !== 'finalizado') return res.status(409).json({ mensaje: 'Solo se puede reabrir un proyecto finalizado.' });

  // No se borra nada: historias, tareas, reuniones e historial siguen asociados al proyecto
  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'proyecto', idEntidad: proyecto.id, campo: 'estado', valorAnterior: 'finalizado', valorNuevo: 'activo' });
  proyecto.estado = 'activo';
  writeDB(db);
  res.json({ mensaje: 'Proyecto reabierto.', proyecto });
});

// ---------- HU-13 Archivar / desarchivar (no elimina datos) ----------
router.put('/:id/archivar', apiConPermiso('archivar_proyecto', (req) => req.params.id), (req, res) => {
  const ctx = cargar(req, res, { permitirArchivado: true });
  if (!ctx) return;
  const { db, proyecto } = ctx;
  const archivar = req.body?.archivado !== false; // por defecto archiva; { archivado: false } desarchiva
  if (proyecto.archivado === archivar) return res.status(409).json({ mensaje: archivar ? 'El proyecto ya está archivado.' : 'El proyecto no está archivado.' });

  registrarHistorial(db, { idUsuario: req.usuario.id, entidad: 'proyecto', idEntidad: proyecto.id, campo: 'archivado', valorAnterior: proyecto.archivado, valorNuevo: archivar });
  proyecto.archivado = archivar;
  writeDB(db);
  res.json({ mensaje: archivar ? 'Proyecto archivado.' : 'Proyecto desarchivado.', proyecto });
});

module.exports = router;