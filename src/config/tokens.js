/* TOKENS DE UN SOLO USO (invitaciones y recuperación de contraseña)
   Se guardan en db.tokens. Crear uno nuevo invalida los anteriores sin usar
   del mismo usuario y tipo. Un token vence con el tiempo y solo sirve una vez. */

const crypto = require('crypto');

function crearToken(db, idUsuario, tipo, horasVigencia) {
  if (!db.tokens) db.tokens = [];
  db.tokens.forEach((t) => {
    if (t.idUsuario === idUsuario && t.tipo === tipo && !t.usado) t.usado = true;
  });
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens.push({
    token, idUsuario, tipo,
    expira: new Date(Date.now() + horasVigencia * 3600 * 1000).toISOString(),
    usado: false
  });
  return token;
}

// Devuelve el token si existe, no se ha usado y no ha vencido; si no, null
function buscarTokenValido(db, token) {
  const t = (db.tokens || []).find((x) => x.token === token);
  if (!t || t.usado || new Date(t.expira) < new Date()) return null;
  return t;
}

// Marca como usados todos los tokens pendientes de una persona
function invalidarTokens(db, idUsuario) {
  (db.tokens || []).forEach((t) => { if (t.idUsuario === idUsuario) t.usado = true; });
}

module.exports = { crearToken, buscarTokenValido, invalidarTokens };