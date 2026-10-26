// src/modules/equipos/equipos.js

(async function () {
  // Aseguramos que la sesión está lista (cargada por layout.js)
  const sesion = await Layout.listo;
  if (!sesion) return;

  const cuerpo = document.getElementById('tabla-equipos');
  const buscar = document.getElementById('buscar');
  const contenedorTabla = document.getElementById('contenedor-tabla');
  const sinResultados = document.getElementById('sin-resultados');
  
  let equipos = [];

  // Función para consumir los datos de equipos.routes.js
  async function cargar() {
    const r = await Api.get('/api/equipos');
    
    if (!r.ok) {
      return UI.toast(r.datos?.mensaje || 'No se pudo cargar la lista de equipos.', 'error');
    }
    
    equipos = r.datos;
    dibujar();
  }

  // Función para pintar la tabla y aplicar el filtro de búsqueda
  function dibujar() {
    const texto = buscar.value.trim().toLowerCase();
    
    // Filtrar coincidencias
    const filas = equipos.filter((e) =>
      (!texto || `${e.nombreProyecto} ${e.nombreUsuario} ${e.rol} ${e.correo}`.toLowerCase().includes(texto))
    );

    // Mostrar/Ocultar la tabla o el mensaje de vacío
    contenedorTabla.hidden = filas.length === 0;
    sinResultados.hidden = filas.length !== 0;

    // Pintar los <tr> con utilidades de UI.js para que todo se vea idéntico
    cuerpo.innerHTML = filas.map((e) => {
      // Reutilizamos la misma estructura del avatar visual usada en `usuarios.js`
      return `
      <tr>
        <td><strong>${UI.escapar(e.nombreProyecto)}</strong></td>
        <td>
          <div class="celda-usuario">
            <span class="avatar avatar--chico">${UI.escapar(UI.iniciales(e.nombreUsuario))}</span>
            ${UI.escapar(e.nombreUsuario)}
          </div>
        </td>
        <td>${UI.escapar(e.correo)}</td>
        <td>${UI.insigniaRol(e.rol)}</td>
        <td>${UI.insigniaUsuario(e.estado)}</td>
      </tr>`;
    }).join('');
    
    // Activa la carga de iconos dinámicos si aplicaste alguno (por si acaso)
    Icons.hidratar();
  }

  // Escuchar cuando el usuario escriba en el buscador
  buscar.addEventListener('input', dibujar);

  // Iniciar la carga
  await cargar();
})();