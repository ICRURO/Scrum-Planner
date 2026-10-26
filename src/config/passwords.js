/* CONTRASEÑAS
   Se guardan con scrypt (sal aleatoria). verificarPassword también acepta las
   contraseñas antiguas en texto plano de las cuentas de prueba; el login las
   convierte a hash la primera vez que la persona entra. */

const crypto = require('crypto');

const PREFIJO = 'scrypt$';

const esHash = (almacenado) => typeof almacenado === 'string' && almacenado.startsWith(PREFIJO);

function hashearPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `${PREFIJO}${sal}$${hash}`;
}

function iguales(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verificarPassword(password, almacenado) {
  if (!almacenado) return false;
  if (!esHash(almacenado)) return iguales(String(password), almacenado);
  const [, sal, hash] = almacenado.split('$');
  return iguales(crypto.scryptSync(String(password), sal, 64).toString('hex'), hash);
}

module.exports = { hashearPassword, verificarPassword, esHash };