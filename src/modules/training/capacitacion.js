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

  // Contenido completo de las 12 Épicas de Scrum Manager (HU-56 y HU-57)
  const pasosCapacitacion = [
    {
      titulo: 'Épica 1: Gestión de Cuentas y Autenticación',
      texto: 'Permite el registro, inicio de sesión seguro mediante contraseñas cifradas y gestión de perfiles de usuario dentro de la plataforma.'
    },
    {
      titulo: 'Épica 2: Control de Roles Globales',
      texto: 'Administración de permisos generales para diferenciar entre el rol de administrador y usuarios estándar del sistema.'
    },
    {
      titulo: 'Épica 3: Creación y Administración de Proyectos',
      texto: 'Gestión del ciclo de vida de los proyectos, definición de objetivos, fechas previstas y estados (preparación, activo, suspendido, finalizado).'
    },
    {
      titulo: 'Épica 4: Asignación de Equipos y Roles Scrum',
      texto: 'Vinculación de participantes a los proyectos asignándoles roles específicos como Product Owner, Scrum Master, Developer o Interesado.'
    },
    {
      titulo: 'Épica 5: Planeación y Gestión de Sprints',
      texto: 'Creación de Sprints, establecimiento de metas (Sprint Goals), definición de fechas y asignación de historias de usuario al Backlog del Sprint.'
    },
    {
      titulo: 'Épica 6: Tablero de Trabajo Kanban (Scrum Board)',
      texto: 'Visualización interactiva del flujo de tareas distribuidas en columnas ("Por hacer", "En progreso", "En revisión", "Terminado") con actualización en tiempo real.'
    },
    {
      titulo: 'Épica 7: Definition of Done (DoD) y Trazabilidad',
      texto: 'Configuración de criterios de verificación obligatorios u opcionales antes de marcar una tarea como terminada, junto con el registro histórico de cambios.'
    },
    {
      titulo: 'Épica 8: Gestión de Impedimentos y Riesgos',
      texto: 'Registro y seguimiento de obstáculos y riesgos identificados en el proyecto, asociándolos a tareas, historias o Sprints con sus respectivos responsables.'
    },
    {
      titulo: 'Épica 9: Eventos y Reuniones Scrum',
      texto: 'Control y registro de reuniones de coordinación (Sprint Planning, Daily Scrum, Sprint Review, Retrospective) y sus acuerdos derivados.'
    },
    {
      titulo: 'Épica 10: Métricas, Burndown Chart y Velocidad',
      texto: 'Generación automática de gráficos de esfuerzo ideal vs. real (Burndown Chart) y consulta del trabajo completado clasificado por tallas de estimación (XS, S, M, L, XL).'
    },
    {
      titulo: 'Épica 11: Auditoría y Historial de Modificaciones',
      texto: 'Registro detallado y auditable de todas las modificaciones realizadas sobre entidades, proyectos, tareas y Sprints.'
    },
    {
      titulo: 'Épica 12: Exportación de Reportes y Estados',
      texto: 'Capacidad de generar y exportar reportes ejecutivos del estado del proyecto, horas invertidas y métricas generales.'
    }
  ];

  async function verificarProgresoInicial() {
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
      btnSiguiente.textContent = pasoActual === totalPasos - 1 ? 'Finalizar capacitación' : 'Siguiente';
    }
  }

  // Eventos de control del modal (HU-54)
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

  // Eventos de navegación secuencial (HU-57)
  if (btnSiguiente) {
    btnSiguiente.addEventListener('click', () => {
      if (pasoActual < pasosCapacitacion.length - 1) {
        pasoActual++;
        actualizarInterfaz();
      } else {
        UI.toast('¡Has completado todas las épicas de Scrum Manager!', 'exito');
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

  await verificarProgresoInicial();
})();