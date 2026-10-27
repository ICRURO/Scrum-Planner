/*
  QUÉ PUEDE HACER CADA ROL

  Matriz de permisos del sistema (qué acciones puede hacer cada rol) y 
  las funciones para consultarla

  Existen dos roles:

  1. GLOBAL: admin
  2. ROL EN UN PROYECTO

*/

const { readDB } = require('../config/db');

const ROLES = ['administrador', 'Product Owner', 'Scrum Master', 'Developer', 'Interesado'];
const TODOS = ROLES;
const ADMIN_Y_PO = ['administrador', 'Product Owner'];

const MATRIZ = [
  { accion: 'consultar_proyecto', texto: 'Consultar proyecto', roles: TODOS },
  { accion: 'crear_proyecto', texto: 'Crear proyecto', roles: ADMIN_Y_PO },
  { accion: 'editar_proyecto', texto: 'Editar proyecto', roles: ADMIN_Y_PO },
  { accion: 'cambiar_estado', texto: 'Cambiar estado', roles: ADMIN_Y_PO },
  { accion: 'finalizar_proyecto', texto: 'Finalizar proyecto', roles: ADMIN_Y_PO },
  { accion: 'reabrir_proyecto', texto: 'Reabrir proyecto', roles: ADMIN_Y_PO },
  { accion: 'archivar_proyecto', texto: 'Archivar proyecto', roles: ADMIN_Y_PO },
  { accion: 'gestionar_historias', texto: 'Registrar y editar historias de usuario', roles: ADMIN_Y_PO },
  { accion: 'refinar_historias', texto: 'Refinar historias de usuario', roles: ['administrador', 'Product Owner', 'Scrum Master', 'Developer'] },
  { accion: 'priorizar_historias', texto: 'Modificar el orden del Product Backlog', roles: ADMIN_Y_PO },
  { accion: 'comentar_historias', texto: 'Comentar historias de usuario', roles: TODOS },
  { accion: 'administrar_usuarios', texto: 'Administrar usuarios', roles: ['administrador'] }
];

function esParticipante(usuario, idProyecto, db = readDB()) {
  return (db.participantes || []).some((p) => p.idProyecto === idProyecto && p.idUsuario === usuario.id);
}

function rolEnProyecto(usuario, idProyecto, db = readDB()) {
  if (usuario.rolGlobal === 'administrador') return 'administrador';
  const p = (db.participantes || []).find((x) => x.idProyecto === idProyecto && x.idUsuario === usuario.id);
  return p ? p.rol : null;
}

function puede(usuario, accion, idProyecto, db = readDB()) {
  const regla = MATRIZ.find((r) => r.accion === accion);
  if (!regla) return false;
  if (usuario.rolGlobal === 'administrador') return regla.roles.includes('administrador');
  if (accion === 'administrar_usuarios') return false;
  if (accion === 'crear_proyecto' && !idProyecto) {
    return (db.participantes || []).some((p) => p.idUsuario === usuario.id && p.rol === 'Product Owner');
  }
  const rol = rolEnProyecto(usuario, idProyecto, db);
  return !!rol && regla.roles.includes(rol);
}

function permisosProyecto(usuario, proyecto, db = readDB()) {
  return {
    editar: puede(usuario, 'editar_proyecto', proyecto.id, db),
    cambiarEstado: puede(usuario, 'cambiar_estado', proyecto.id, db),
    finalizar: puede(usuario, 'finalizar_proyecto', proyecto.id, db),
    reabrir: puede(usuario, 'reabrir_proyecto', proyecto.id, db),
    archivar: puede(usuario, 'archivar_proyecto', proyecto.id, db),
    gestionarHistorias: puede(usuario, 'gestionar_historias', proyecto.id, db),
    refinarHistorias: puede(usuario, 'refinar_historias', proyecto.id, db),
    priorizarHistorias: puede(usuario, 'priorizar_historias', proyecto.id, db),
    comentarHistorias: puede(usuario, 'comentar_historias', proyecto.id, db)
  };
}

function paginaConPermiso(accion, obtenerId) {
  return (req, res, next) => {
    const id = obtenerId ? obtenerId(req) : undefined;
    if (!puede(req.usuario, accion, id)) return res.redirect('/sin-permiso');
    next();
  };
}

function apiConPermiso(accion, obtenerId) {
  return (req, res, next) => {
    const id = obtenerId ? obtenerId(req) : undefined;
    if (!puede(req.usuario, accion, id)) {
      return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { ROLES, MATRIZ, esParticipante, rolEnProyecto, puede, permisosProyecto, paginaConPermiso, apiConPermiso };
