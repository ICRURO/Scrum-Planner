(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const modalBienvenida = document.getElementById('modal-bienvenida');
  const contenedorTutorial = document.getElementById('contenedor-tutorial');
  const contenidoTeoria = document.getElementById('contenido-teoria');
  const tituloModulo = document.getElementById('titulo-modulo');
  const btnAnterior = document.getElementById('btn-anterior');
  const btnSiguiente = document.getElementById('btn-siguiente');
  const indicadorTexto = document.getElementById('indicador-progreso-texto');

  let pasoActual = 0;

  // Pasos iniciales de prueba para la navegación secuencial
  const pasosCapacitacion = [
    {
      titulo: 'Épica 1: Gestión de Cuentas y Autenticación',
      texto: 'Permite el registro, inicio de sesión seguro mediante contraseñas cifradas y gestión de perfiles de usuario.'
    },
    {
      titulo: 'Épica 2: Control de Roles Globales',
      texto: 'Administración de permisos generales para diferenciar entre el rol de administrador y usuarios estándar.'
    }
  ];

  async function verificarPrimeraVisita() {
    try {
      const r = await Api.get('/api/training/progreso');
      if (r.ok && r.datos?.progreso) {
        const prog = r.datos.progreso;
        pasoActual = typeof prog.pasoIndex === 'number' ? prog.pasoIndex : 0;
        actualizarInterfaz();

        if (prog.porcentaje === 0 && pasoActual === 0) {
          if (modalBienvenida) modalBienvenida.hidden = false;
          if (contenedorTutorial) contenedorTutorial.style.opacity = '0.4';
        }
      }
    } catch (error) {
      console.error('Error al verificar el progreso inicial de capacitación:', error);
    }
    Icons.hidratar();
  }

  function actualizarInterfaz() {
    const totalPasos = pasosCapacitacion.length;
    if (tituloModulo) {
      tituloModulo.innerHTML = `<span class="icono-ficha" data-icon="bandera"></span>${pasosCapacitacion[pasoActual].titulo}`;
    }
    if (contenidoTeoria) {
      contenidoTeoria.innerHTML = `<p>${pasosCapacitacion[pasoActual].texto}</p>`;
    }
    if (indicadorTexto) {
      indicadorTexto.textContent = `Paso ${pasoActual + 1} de ${totalPasos}`;
    }
    if (btnAnterior) {
      btnAnterior.disabled = pasoActual === 0;
    }
    if (btnSiguiente) {
      btnSiguiente.textContent = pasoActual === totalPasos - 1 ? 'Finalizar' : 'Siguiente';
    }
  }

  // Eventos de control del modal (HU-54-T2)
  const btnAhora = document.getElementById('btn-ahora');
  const btnDespues = document.getElementById('btn-despues');

  if (btnAhora) {
    btnAhora.addEventListener('click', () => {
      modalBienvenida.hidden = true;
      contenedorTutorial.style.opacity = '1';
      UI.toast('Iniciando recorrido de capacitación.', 'exito');
    });
  }

  if (btnDespues) {
    btnDespues.addEventListener('click', () => {
      modalBienvenida.hidden = true;
      contenedorTutorial.style.opacity = '1';
      UI.toast('Puedes retomar la capacitación en cualquier momento desde el menú.', 'info');
    });
  }

  // Eventos de navegación secuencial (HU-57-T1)
  if (btnSiguiente) {
    btnSiguiente.addEventListener('click', () => {
      if (pasoActual < pasosCapacitacion.length - 1) {
        pasoActual++;
        actualizarInterfaz();
      } else {
        UI.toast('¡Has completado esta versión del tutorial!', 'exito');
      }
    });
  }

  if (btnAnterior) {
    btnAnterior.addEventListener('click', () => {
      if (pasoActual > 0) {
        pasoActual--;
        actualizarInterfaz();
      }
    });
  }

  await verificarPrimeraVisita();
})();