/* HISTORIAL DE CAMBIOS
   Solo se agregan registros; nunca se editan ni se borran (HU-10, HU-11, HU-38). */

function registrarHistorial(db, { idUsuario, entidad, idEntidad, campo, valorAnterior = null, valorNuevo = null }) {
  if (!db.historial) db.historial = [];
  const max = db.historial.reduce((m, h) => Math.max(m, parseInt(String(h.id).split('-')[1], 10) || 0), 0);
  db.historial.push({
    id: `HIS-${String(max + 1).padStart(3, '0')}`,
    fecha: new Date().toISOString(),
    idUsuario, entidad, idEntidad, campo, valorAnterior, valorNuevo
  });
}

module.exports = { registrarHistorial };