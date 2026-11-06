(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const modalBienvenida = document.getElementById('modal-bienvenida');
  const contenedorTutorial = document.getElementById('contenedor-tutorial');

  let progresoUsuario = { porcentaje: 0, pasoIndex: 0, moduloActual: 'Épica 1', completado: false };

  // Lógica inicial para comprobar si es la primera visita del usuario (HU-54-T1)
  async function verificarPrimeraVisita() {
    try {
      const r = await Api.get('/api/training/progreso');
      if (r.ok && r.datos?.progreso) {
        progresoUsuario = r.datos.progreso;

        // Si el usuario no tiene avance, mostramos el modal de bienvenida
        if (progresoUsuario.porcentaje === 0 && progresoUsuario.pasoIndex === 0) {
          if (modalBienvenida) modalBienvenida.hidden = false;
          if (contenedorTutorial) contenedorTutorial.style.opacity = '0.4';
        }
      }
    } catch (error) {
      console.error('Error al verificar el progreso inicial de capacitación:', error);
    }
  }

  await verificarPrimeraVisita();
})();