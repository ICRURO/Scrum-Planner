/* CORREO ELECTRÓNICO (HU-03 y HU-04)
   Envía invitaciones y enlaces de recuperación por SMTP con nodemailer.
   La configuración sale de variables de entorno (.env). Si no hay SMTP
   configurado, el correo se imprime en la consola del servidor, como antes.
   El correo lleva el enlace de activación, nunca una contraseña. */

const nodemailer = require('nodemailer');

// Carga .env si existe (Node 20.12 o superior). Si no existe, se usan las variables del sistema.
try { process.loadEnvFile(); } catch (e) { /* sin .env: no pasa nada */ }

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL } = process.env;

const transporter = (SMTP_HOST && SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
  : null;

if (transporter && !SMTP_FROM) {
  console.warn('>>> Falta SMTP_FROM en .env: se usará SMTP_USER como remitente y muchos proveedores lo rechazan si no es un correo.');
}

const escapar = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// El enlace se arma con APP_URL, no con la cabecera Host de la petición (que se puede falsificar)
const enlaceActivacion = (token) =>
  `${(APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}/recuperar?token=${token}`;

// Devuelve true solo si el correo realmente salió; false si no hay SMTP configurado
async function enviar({ para, asunto, texto, html }) {
  if (!transporter) {
    console.log(`>>> [SMTP sin configurar] ${asunto} para ${para}\n${texto}`);
    return false;
  }
  await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to: para, subject: asunto, text: texto, html });
  return true;
}

const enviarInvitacion = (usuario, enlace) => enviar({
  para: usuario.correo,
  asunto: 'Te invitaron a Scrum Manager',
  texto: `Hola ${usuario.nombre}, te invitaron a Scrum Manager. Activa tu cuenta y define tu contraseña aquí (el enlace es de un solo uso y vence en 72 horas): ${enlace}`,
  html: `<p>Hola ${escapar(usuario.nombre)},</p>
<p>Te invitaron a Scrum Manager. <a href="${enlace}">Activa tu cuenta</a> y define tu contraseña.</p>
<p>El enlace es de un solo uso y vence en 72 horas.</p>`
});

const enviarRecuperacion = (usuario, enlace) => enviar({
  para: usuario.correo,
  asunto: 'Restablece tu contraseña',
  texto: `Hola ${usuario.nombre}, para elegir una nueva contraseña entra aquí (vence en 1 hora y sirve una sola vez): ${enlace}. Si no lo pediste, ignora este correo.`,
  html: `<p>Hola ${escapar(usuario.nombre)},</p>
<p><a href="${enlace}">Restablece tu contraseña</a>. El enlace vence en 1 hora y sirve una sola vez.</p>
<p>Si no lo pediste, ignora este mensaje.</p>`
});

module.exports = { enlaceActivacion, enviarInvitacion, enviarRecuperacion };
