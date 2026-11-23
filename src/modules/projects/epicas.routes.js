/*
 * Épicas por proyecto. Sólo el Scrum Master del proyecto puede crearlas
 * y editarlas. El resto de integrantes con acceso pueden consultarlas.
 */
const express = require('express');
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { requiereSesion } = require('../../middleware/auth');
const { puede, rolEnProyecto } = require('../../middleware/permisos');

const router = express.Router();
router.use(requiereSesion);

function cargarProyecto(req, res, db) {
  const proyecto = (db.proyectos || []).find((p) => p.id === req.params.id);
  if (!proyecto) {
    res.status(404).json({ mensaje: 'El proyecto no existe.' });
    return null;
  }
  if (!puede(req.usuario, 'consultar_proyecto', proyecto.id, db)) {
    res.status(403).json({ mensaje: 'No puedes consultar este proyecto.' });
    return null;
  }
  return proyecto;
}

function gestionarEpicas(req, res, db, proyecto) {
  if (rolEnProyecto(req.usuario, proyecto.id, db) !== 'Scrum Master') {
    res.status(403).json({ mensaje: 'Solo el Scrum Master del proyecto puede administrar épicas.' });
    return false;
  }
  if (proyecto.archivado) {
    res.status(409).json({ mensaje: 'El proyecto está archivado.' });
    return false;
  }
  return true;
}

function validarDatos(datos) {
  const nombre = datos?.nombre;
  const descripcion = datos?.descripcion ?? '';
  const color = datos?.color;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) {
    return 'El nombre de la épica es obligatorio (máximo 100 caracteres).';
  }
  if (typeof color !== 'string' || !/^#[\da-fA-F]{6}$/.test(color)) {
    return 'El color es obligatorio y debe ser hexadecimal, por ejemplo #208E60.';
  }
  if (typeof descripcion !== 'string' || descripcion.length > 500) {
    return 'La descripción debe tener como máximo 500 caracteres.';
  }
  return null;
}

function siguienteId(epicas) {
  const mayor = epicas.reduce((max, epica) => {
    const m = /^EP-(\d+)$/.exec(String(epica.id || ''));
    return Math.max(max, m ? Number(m[1]) : 0);
  }, 0);
  return `EP-${String(mayor + 1).padStart(3, '0')}`;
}

router.get('/:id/epicas', (req, res) => {
  const db = readDB();
  const proyecto = cargarProyecto(req, res, db);
  if (!proyecto) return;
  const epicas = (db.epicas || []).filter((e) => e.idProyecto === proyecto.id);
  const conteos = new Map();
  for (const historia of db.historiasUsuario || []) {
    if (historia.idProyecto === proyecto.id && historia.idEpica) {
      conteos.set(historia.idEpica, (conteos.get(historia.idEpica) || 0) + 1);
    }
  }
  res.json({
    epicas: epicas.map((e) => ({ ...e, totalHistorias: conteos.get(e.id) || 0 })),
    puedeGestionar: !proyecto.archivado && rolEnProyecto(req.usuario, proyecto.id, db) === 'Scrum Master'
  });
});

router.post('/:id/epicas', (req, res) => {
  const db = readDB();
  const proyecto = cargarProyecto(req, res, db);
  if (!proyecto || !gestionarEpicas(req, res, db, proyecto)) return;
  const datos = req.body || {};
  const error = validarDatos(datos);
  if (error) return res.status(400).json({ mensaje: error });
  if (!db.epicas) db.epicas = [];
  const nombre = datos.nombre.trim();
  if (db.epicas.some((e) => e.idProyecto === proyecto.id && e.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'))) {
    return res.status(409).json({ mensaje: 'Ya existe una épica con ese nombre en el proyecto.' });
  }
  const epica = {
    id: siguienteId(db.epicas),
    idProyecto: proyecto.id,
    nombre,
    descripcion: (datos.descripcion || '').trim(),
    color: datos.color.toUpperCase(),
    idCreador: req.usuario.id,
    fechaCreacion: new Date().toISOString()
  };
  db.epicas.push(epica);
  registrarHistorial(db, {
    idUsuario: req.usuario.id, entidad: 'epica', idEntidad: epica.id,
    campo: 'creacion', valorAnterior: null, valorNuevo: { nombre, idProyecto: proyecto.id }
  });
  writeDB(db);
  res.status(201).json({ mensaje: 'Épica creada correctamente.', epica });
});

router.put('/:id/epicas/:idEpica', (req, res) => {
  const db = readDB();
  const proyecto = cargarProyecto(req, res, db);
  if (!proyecto || !gestionarEpicas(req, res, db, proyecto)) return;
  const epica = (db.epicas || []).find((e) => e.id === req.params.idEpica && e.idProyecto === proyecto.id);
  if (!epica) return res.status(404).json({ mensaje: 'No se encontró la épica en este proyecto.' });
  const datos = req.body || {};
  const error = validarDatos(datos);
  if (error) return res.status(400).json({ mensaje: error });
  const nombre = datos.nombre.trim();
  if (db.epicas.some((e) => e.idProyecto === proyecto.id && e.id !== epica.id && e.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'))) {
    return res.status(409).json({ mensaje: 'Ya existe una épica con ese nombre en el proyecto.' });
  }
  const previo = { nombre: epica.nombre, descripcion: epica.descripcion, color: epica.color };
  const nuevo = { nombre, descripcion: (datos.descripcion || '').trim(), color: datos.color.toUpperCase() };
  if (Object.keys(nuevo).every((k) => nuevo[k] === previo[k])) {
    return res.status(400).json({ mensaje: 'No hay cambios que guardar.' });
  }
  Object.assign(epica, nuevo, { fechaActualizacion: new Date().toISOString() });
  registrarHistorial(db, {
    idUsuario: req.usuario.id, entidad: 'epica', idEntidad: epica.id,
    campo: 'edicion', valorAnterior: previo, valorNuevo: nuevo
  });
  writeDB(db);
  res.json({ mensaje: 'Épica actualizada.', epica });
});

module.exports = router;
