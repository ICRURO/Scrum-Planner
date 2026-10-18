/*
  SESIONES Y FILTROS DE ACCESO

  Es el encargado de saber quién está usando el sistema

  1. Crea la sesión al loguearse
  2. Identifica la sesión en cada visita y la elimina la cerrar sesión
  3. Brinda filtros que bloquean el acceso a quien no ha iniciado sesión
*/

const crypto = require('crypto');
const { readDB } = require('../config/db');

const NOMBRE_COOKIE = 'sid';
const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas
const sesiones = new Map(); 

function leerCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach((par) => {
    const i = par.indexOf('=');
    if (i < 0) return;
    cookies[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  });
  return cookies;
}

function crearSesion(res, idUsuario) {
  const token = crypto.randomUUID();
  sesiones.set(token, { idUsuario, creada: Date.now() });
  res.append(
    'Set-Cookie',
    `${NOMBRE_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${DURACION_MS / 1000}`
  );
}

function destruirSesion(req, res) {
  const token = leerCookies(req)[NOMBRE_COOKIE];
  if (token) sesiones.delete(token);
  res.append('Set-Cookie', `${NOMBRE_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function obtenerUsuario(req) {
  const token = leerCookies(req)[NOMBRE_COOKIE];
  const sesion = token && sesiones.get(token);
  if (!sesion) return null;
  if (Date.now() - sesion.creada > DURACION_MS) {
    sesiones.delete(token);
    return null;
  }
  const usuario = readDB().usuarios.find((u) => u.id === sesion.idUsuario);
  if (!usuario || usuario.estado !== 'activo') {
    sesiones.delete(token);
    return null;
  }
  return usuario;
}

function sinPassword(usuario) {
  const { password, ...resto } = usuario;
  return resto;
}

function requiereSesion(req, res, next) {
  const usuario = obtenerUsuario(req);
  if (!usuario) return res.status(401).json({ mensaje: 'Debes iniciar sesión.' });
  req.usuario = usuario;
  res.set('Cache-Control', 'no-store');
  next();
}

function requierePagina(req, res, next) {
  const usuario = obtenerUsuario(req);
  if (!usuario) return res.redirect('/login');
  req.usuario = usuario;
  res.set('Cache-Control', 'no-store');
  next();
}

function requiereRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rolGlobal)) {
      return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { crearSesion, destruirSesion, obtenerUsuario, sinPassword, requiereSesion, requierePagina, requiereRol };
