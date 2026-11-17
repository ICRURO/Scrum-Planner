/* SISTEMA DE NOTIFICACIONES (HU-49)
   Estructura de eventos y direccionamiento por usuario. */

const CATEGORIAS_EVENTO = {
  ASIGNACION: 'Asignación',
  IMPEDIMENTO: 'Impedimento',
  CAMBIO_ESTADO: 'Cambio de estado',
  INVITACION: 'Invitación'
};

function siguienteIdNotificacion(db) {
  if (!db.notificaciones) db.notificaciones = [];
  const max = db.notificaciones.reduce(
    (m, n) => Math.max(m, parseInt(String(n.id).split('-')[1], 10) || 0),
    0
  );
  return `NOT-${String(max + 1).padStart(3, '0')}`;
}

function crearNotificacion(db, {
  destinatarios = [],
  idActor = null,
  idProyecto = null,
  categoria,
  mensaje,
  elemento,
  entidad,
  idEntidad,
  urlDestino = '/panel'
}) {
  if (!db.notificaciones) db.notificaciones = [];

  const usuariosUnicos = [...new Set(destinatarios)].filter((idUsr) => {
    if (!idUsr || idUsr === idActor) return false;
    const usuario = (db.usuarios || []).find((u) => u.id === idUsr);
    return usuario && usuario.estado !== 'desactivado';
  });

  const fecha = new Date().toISOString();
  const creadas = [];

  for (const idUsuarioDestino of usuariosUnicos) {
    const notificacion = {
      id: siguienteIdNotificacion(db),
      idUsuarioDestino,
      idProyecto,
      categoria,
      mensaje,
      elemento,
      entidad,
      idEntidad,
      urlDestino,
      leida: false,
      fecha
    };
    db.notificaciones.push(notificacion);
    creadas.push(notificacion);
  }

  return creadas;
}

function participantesDelProyecto(db, idProyecto) {
  return (db.participantes || [])
    .filter((p) => (p.idProyecto || p.proyectoId) === idProyecto)
    .map((p) => p.idUsuario || p.usuarioId);
}

module.exports = {
  CATEGORIAS_EVENTO,
  crearNotificacion,
  participantesDelProyecto
};