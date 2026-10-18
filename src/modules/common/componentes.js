// Rellena la guía de componentes con ejemplos
const COLORES = [
  ['Bosque', '--c-bosque', '#1B4D40'], ['Hoja', '--c-hoja', '#2E7D32'], ['Brote', '--c-brote', '#4CAF50'],
  ['Papel', '--c-papel', '#F5F6F8'], ['Tinta', '--c-tinta', '#1A1F1C'], ['Piedra', '--c-piedra', '#5F6663'],
  ['Brasa', '--c-brasa', '#C62828'], ['Miel', '--c-miel', '#B7791F']
];
document.getElementById('muestras').innerHTML = COLORES.map(([nombre, variable, hex]) => `
  <div class="muestra"><div class="muestra__color" style="background:var(${variable})"></div><strong>${nombre}</strong><span>${hex}</span></div>`).join('');

document.getElementById('insignias').innerHTML =
  ['preparacion', 'activo', 'suspendido', 'finalizado'].map(UI.insigniaProyecto).join('') +
  ['desactivado', 'invitacion_pendiente'].map(UI.insigniaUsuario).join('') +
  ['Product Owner', 'Scrum Master', 'Developer', 'Interesado'].map(UI.insigniaRol).join('');

const PROYECTOS = [
  ['PRJ-001', 'Sistema de gestión Scrum', 'activo'], ['PRJ-002', 'Portal de servicio social', 'finalizado'],
  ['PRJ-003', 'App de biblioteca', 'preparacion'], ['PRJ-004', 'Tablero de inventario', 'suspendido']
];
document.getElementById('tabla-ejemplo').innerHTML = PROYECTOS.map(([id, nombre, estado]) => `
  <tr><td>${id}</td><td>${UI.escapar(nombre)}</td><td>05 oct 2026 – 11 dic 2026</td><td>${UI.insigniaProyecto(estado)}</td>
  <td><div class="tabla__acciones"><a href="#">Ver detalle</a><button>Archivar</button></div></td></tr>`).join('');

document.getElementById('iconos').innerHTML = Icons.nombres.map((n) =>
  `<div class="icono-caja">${Icons.get(n, 24)}<span>${n}</span></div>`).join('');

document.getElementById('prueba-toast-ok').addEventListener('click', () => UI.toast('Proyecto guardado correctamente.', 'exito'));
document.getElementById('prueba-toast-error').addEventListener('click', () => UI.toast('No se pudo guardar. Revisa los campos.', 'error'));
document.getElementById('prueba-confirmar').addEventListener('click', async () => {
  const ok = await UI.confirmar({ titulo: 'Archivar proyecto', mensaje: 'El proyecto saldrá de la lista activa, pero sus datos se conservan.', textoOk: 'Archivar', peligro: true });
  UI.toast(ok ? 'Proyecto archivado.' : 'Acción cancelada.', ok ? 'exito' : 'info');
});

Icons.hidratar();
