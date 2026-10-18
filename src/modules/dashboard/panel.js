// Lógica del panel: accesos rápidos y datos de quien inició sesión

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return; // el encabezado ya redirigió al login

  const { usuario, participaciones } = sesion;
  document.getElementById('saludo').textContent = `Bienvenido, ${usuario.nombre}`;

  // Accesos rápidos: los mismos del menú (salvo Panel), según el rol del usuario
  const accesos = Layout.menuPara(usuario).filter((i) => i.id !== 'panel');
  document.getElementById('accesos').innerHTML = accesos.map((i) => `
    <a class="acceso" href="${i.href}">
      <span class="icono-ficha">${Icons.get(i.icono, 20)}</span>
      <strong>${i.texto}</strong>
      <span>${i.descripcion}</span>
    </a>`).join('');

  // Tu acceso: rol en el sistema y rol en cada proyecto
  const proyectos = participaciones.length
    ? `<ul class="lista-simple">${participaciones.map((p) => `
        <li><span class="mi-acceso__proyecto">${UI.escapar(p.nombreProyecto)}</span>${UI.insigniaRol(p.rol)}</li>`).join('')}</ul>`
    : '<p class="acceso-vacio">Aún no participas en ningún proyecto.</p>';

  document.getElementById('mi-acceso').innerHTML = `
    <div class="mi-acceso__bloque">
      <h3>Rol en el sistema</h3>
      <div>${UI.insigniaRol(UI.ROLES_GLOBALES[usuario.rolGlobal] || usuario.rolGlobal)}</div>
    </div>
    <div class="mi-acceso__bloque">
      <h3>Tus proyectos</h3>
      ${proyectos}
    </div>`;

  Icons.hidratar();
})();
