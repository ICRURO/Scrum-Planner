// /api/projects — solo lectura por ahora (crear, editar y cambiar estado llegan en el siguiente paso)
const express = require('express');
const { readDB } = require('../../config/db');
const { requiereSesion } = require('../../middleware/auth');
const { puede, rolEnProyecto, permisosProyecto, esParticipante } = require('../../middleware/permisos');

const router = express.Router();
router.use(requiereSesion);

const ETIQUETAS = { preparacion: 'En preparación', activo: 'Activo', suspendido: 'Suspendido', finalizado: 'Finalizado' };

// El administrador ve todos; los demás solo los proyectos donde participan (RF-09)
const proyectosVisibles = (db, usuario) =>
  db.proyectos.filter((p) => usuario.rolGlobal === 'administrador' || esParticipante(usuario, p.id, db));

function siguienteId(db) {
  const max = db.proyectos.reduce((m, p) => Math.max(m, parseInt(p.id.split('-')[1], 10) || 0), 0);
  return `PRJ-${String(max + 1).padStart(3, '0')}`;
}

function textoCambio(h) {
  if (h.campo === 'estado') return `Estado: ${ETIQUETAS[h.valorAnterior] || h.valorAnterior} → ${ETIQUETAS[h.valorNuevo] || h.valorNuevo}`;
  if (h.campo === 'archivado') return h.valorNuevo ? 'Proyecto archivado' : 'Proyecto desarchivado';
  return 'Información editada';
}

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
  const historial = (db.historial || [])
    .filter((h) => h.entidad === 'proyecto' && h.idEntidad === proyecto.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((h) => {
      const autor = db.usuarios.find((x) => x.id === h.idUsuario);
      return { fecha: h.fecha, usuario: autor ? `${autor.nombre} ${autor.apellidos}` : 'Desconocido', cambio: textoCambio(h) };
    });
  res.json({ proyecto, miRol: rolEnProyecto(u, proyecto.id, db), permisos: permisosProyecto(u, proyecto, db), historial, siguienteId: siguienteId(db) });
});

module.exports = router;
