/* ENCABEZADO COMPARTIDO POR TODAS LAS PANTALLAS */

const Layout = (() => {
  // Menú principal. Para agregar una pantalla nueva basta cambiar su href aquí, "roles" limita quién lo ve (si se omite, lo ven todos)
  const MENU = [
    { id: 'panel', texto: 'Panel', icono: 'panel', href: '/panel', descripcion: 'Resumen de tu actividad' },
    { id: 'proyectos', texto: 'Proyectos', icono: 'carpeta', href: '/proyectos', descripcion: 'Consulta y administra tus proyectos' },
    { id: 'equipos', texto: 'Equipos', icono: 'equipo', href: '/proximamente?s=Equipos', descripcion: 'Participantes y roles Scrum' },
    { id: 'reportes', texto: 'Reportes', icono: 'reportes', href: '/proximamente?s=Reportes', descripcion: 'Métricas y avance de los sprints' },
    { id: 'usuarios', texto: 'Usuarios', icono: 'escudo', href: '/usuarios', descripcion: 'Cuentas, invitaciones y estados', roles: ['administrador'] }
  ];
  const PERFIL_HREF = '/perfil';

  const menuPara = (usuario) => MENU.filter((i) => !i.roles || i.roles.includes(usuario.rolGlobal));

  let resolverListo;
  // Las pantallas esperan esto para saber quién está conectado: const sesion = await Layout.listo;
  const listo = new Promise((r) => { resolverListo = r; });

  const marca = (href) => `
    <a class="marca" href="${href}">
      <span class="marca__logo">S</span>
      <span class="marca__nombre">Scrum Manager</span>
    </a>`;

  const encabezadoPublico = () =>
    `<header class="app-header"><div class="app-header__interior">${marca('/')}</div></header>`;

  function encabezadoApp(usuario, seccion) {
    const enlaces = menuPara(usuario).map((i) => `
      <a class="nav__link ${i.id === seccion ? 'activo' : ''}" href="${i.href}" ${i.id === seccion ? 'aria-current="page"' : ''}>
        ${Icons.get(i.icono, 18)}<span>${i.texto}</span>
      </a>`).join('');
    const nombreCompleto = `${usuario.nombre} ${usuario.apellidos}`.trim();
    return `
      <header class="app-header">
        <div class="app-header__interior">
          ${marca('/panel')}
          <nav class="nav" aria-label="Principal">${enlaces}</nav>
          <div class="usuario-menu">
            <button class="avatar-boton" id="btn-usuario" aria-haspopup="true" aria-expanded="false" title="${UI.escapar(nombreCompleto)}">
              <span class="avatar">${UI.escapar(UI.iniciales(nombreCompleto))}</span>
            </button>
            <div class="menu-flotante" id="menu-usuario" hidden>
              <div class="menu-flotante__quien">
                <strong>${UI.escapar(nombreCompleto)}</strong>
                <span>${UI.escapar(usuario.correo)}</span>
              </div>
              <a class="menu-flotante__item" href="${PERFIL_HREF}">${Icons.get('usuario', 18)}Mi perfil</a>
              <a class="menu-flotante__item" href="/permisos">${Icons.get('escudo', 18)}Permisos de acceso</a>
              <button class="menu-flotante__item menu-flotante__item--salir" id="btn-salir">${Icons.get('salir', 18)}Cerrar sesión</button>
            </div>
          </div>
        </div>
      </header>`;
  }

  // Renglón de navegación bajo el encabezado: Volver (a la pantalla anterior lógica) y Volver al panel
  function barraNavegacion() {
    const destino = document.body.dataset.volver;
    if (!destino) return '';
    const texto = document.body.dataset.volverTexto;
    const etiqueta = texto ? `Volver a ${texto}` : 'Volver';
    const volver = destino === '/panel' ? '' :
      `<a class="btn btn-texto btn-chico" id="enlace-volver" href="${destino}">${Icons.get('flecha_izquierda', 18)}${UI.escapar(etiqueta)}</a>`;
    return `
      <div class="barra-navegacion"><div class="barra-navegacion__interior">
        ${volver}
        <a class="btn btn-texto btn-chico" href="/panel">${Icons.get('inicio', 18)}Volver al panel</a>
      </div></div>`;
  }

  // Cambia el destino de "Volver" cuando depende de datos (por ejemplo, el proyecto que se edita)
  function fijarVolver(href) {
    const enlace = document.getElementById('enlace-volver');
    if (enlace) enlace.setAttribute('href', href);
  }

  // Bloquea la flecha "Atrás" del navegador en pantallas con sesión:
  // se agrega una entrada al historial y, si alguien intenta retroceder, se queda en la misma pantalla
  function protegerNavegacion() {
    let ultimoAviso = 0;
    let reforzado = false;
    const fijar = () => window.history.pushState({ app: true }, '', window.location.href);

    fijar();

    const reforzar = () => { if (!reforzado) { reforzado = true; fijar(); } };
    window.addEventListener('pointerdown', reforzar);
    window.addEventListener('keydown', reforzar);

    window.addEventListener('popstate', () => {
      fijar();
      if (Date.now() - ultimoAviso > 1500) {
        ultimoAviso = Date.now();
        UI.toast('Para moverte usa el menú, "Volver" o "Volver al panel".', 'info');
      }
    });

    // Si el navegador restaura la página desde su memoria (botón Atrás tras cerrar sesión), se revalida la sesión
    window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
  }

  function activarMenuUsuario() {
    const boton = document.getElementById('btn-usuario');
    const menu = document.getElementById('menu-usuario');
    const alternar = (abrir) => { menu.hidden = !abrir; boton.setAttribute('aria-expanded', String(abrir)); };
    boton.addEventListener('click', (e) => { e.stopPropagation(); alternar(menu.hidden); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) alternar(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') alternar(false); });
    document.getElementById('btn-salir').addEventListener('click', async () => {
      await Api.post('/api/auth/logout');
      window.location.replace('/login'); // replace: la pantalla anterior no queda en el historial
    });
  }

  async function iniciar() {
    const contenedor = document.getElementById('app-header');
    if (!contenedor) return resolverListo(null);

    if (document.body.dataset.header === 'publico') {
      contenedor.innerHTML = encabezadoPublico();
      return resolverListo(null);
    }

    const r = await Api.get('/api/auth/session');
    if (!r.ok) {
      if ('protegida' in document.body.dataset) { window.location.replace('/login'); return resolverListo(null); }
      contenedor.innerHTML = encabezadoPublico();
      return resolverListo(null);
    }
    contenedor.innerHTML = encabezadoApp(r.datos.usuario, document.body.dataset.seccion) + barraNavegacion();
    activarMenuUsuario();
    if ('protegida' in document.body.dataset) protegerNavegacion();
    resolverListo(r.datos); 
  }

  document.addEventListener('DOMContentLoaded', iniciar);
  return { listo, menuPara, MENU, fijarVolver };
})();
