/*

  BIBLIOTECA DE ÍCONOS DEL SISTEMA

  Guarda los íconos como SVG propios. Se pueden insertar:

  Desde JS con: Icons,get('nombre') o desde HTML con: data-icon. Toman el 
  color del texto que los rodea

*/

const Icons = (() => {
  const RUTAS = {
    panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    equipo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6 0 4.5 1.8 4.5 4.5"/>',
    reportes: '<path d="M4 20V11M10 20V5M16 20v-8M3 20h18"/>',
    escudo: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    salir: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    ojo_cerrado: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    archivar: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/>',
    editar: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    flecha_abajo: '<path d="M6 9l6 6 6-6"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    enviar: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    bandera: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    rayo: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pausa: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    reabrir: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
    construccion: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    flecha_izquierda: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
    inicio: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    carpeta_vacia: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 13h6"/>',
    historia: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5zM6 6h10M6 10h10M6 14h6"/>'
  };

  function get(nombre, tam = 20) {
    const ruta = RUTAS[nombre];
    if (!ruta) return '';
    return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ruta}</svg>`;
  }

  function hidratar(raiz = document) {
    raiz.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = get(el.dataset.icon, Number(el.dataset.size) || 20);
      el.removeAttribute('data-icon');
    });
  }

  document.addEventListener('DOMContentLoaded', () => hidratar());
  return { get, hidratar, nombres: Object.keys(RUTAS) };
})();
