
/* =================================================================
   MÓDULO DE CAPACITACIÓN - SCRUM MANAGER
   ================================================================= */

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const modalBienvenida = document.getElementById('modal-bienvenida');
  const contenedorTutorial = document.getElementById('contenedor-tutorial');
  const contenidoTeoria = document.getElementById('contenido-teoria');
  const tituloModulo = document.getElementById('titulo-modulo');
  const btnAnterior = document.getElementById('btn-anterior');
  const btnSiguiente = document.getElementById('btn-siguiente');
  const textoPorcentaje = document.getElementById('texto-porcentaje');
  const barraProgreso = document.getElementById('barra-progreso');
  const indicadorTexto = document.getElementById('indicador-progreso-texto');
  const panelAdmin = document.getElementById('panel-admin-avances');
  const tablaAdmin = document.getElementById('tabla-avances-admin');

  let pasoActual = 0;

  // Guía verificada contra pantallas y rutas del proyecto recibido.
  const pasosCapacitacion = [
    {
      titulo: "Épica 1: Gestión de Cuentas y Autenticación",
      teoriaConcepto: "La cuenta identifica a cada participante y permite atribuir acciones a personas concretas. Los roles Scrum se asignan dentro de cada proyecto y no sustituyen el acceso a la plataforma.",
      objetivo: "Acceder, recuperar la contraseña y actualizar los datos personales.",
      pasos: [
        "Abre /login e introduce el correo de tu cuenta en el campo Correo.",
        "Escribe la contraseña en Contraseña; utiliza el control de mostrar contraseña si necesitas revisar lo escrito.",
        "Pulsa Entrar. Si los datos son válidos, accederás a /panel. Si aparece un error, verifica correo y contraseña antes de repetir.",
        "Si no recuerdas la contraseña, pulsa ¿Olvidaste tu contraseña? o abre /recuperar. Introduce tu correo y solicita el enlace.",
        "Abre el enlace recibido, escribe la nueva contraseña y su confirmación y utiliza Restablecer cuando el formulario lo permita.",
        "Una vez dentro, abre /perfil, revisa Nombre, Apellidos y Correo, modifica los datos permitidos y pulsa Guardar cambios."
      ],
      ejemplo: "Una persona invitada inicia sesión y comprueba que sus datos personales sean correctos.",
      resultado: "La cuenta permite entrar al panel y la información del perfil se muestra actualizada.",
      advertencia: "No compartas contraseñas; la recuperación depende del correo asociado a la cuenta."
    },
    {
      titulo: "Épica 2: Control de Roles Globales",
      teoriaConcepto: "Un rol global determina permisos generales de la aplicación; un rol Scrum define responsabilidades dentro de un proyecto. No son equivalentes.",
      objetivo: "Distinguir permisos y administrar usuarios cuando corresponda.",
      pasos: [
        "Abre /permisos para consultar tus privilegios. Comprueba qué operaciones están autorizadas para tu cuenta.",
        "Si eres administrador, abre /usuarios desde la navegación. Esta página no está disponible para usuarios sin el permiso correspondiente.",
        "Revisa el listado de usuarios y localiza la cuenta que necesitas gestionar.",
        "Para dar de alta una cuenta, entra en /usuarios/invitar y completa Nombre, Apellidos, Correo y Rol global.",
        "Elige el Método disponible en el formulario. Si aparece el campo Contraseña inicial, complétalo según el método seleccionado.",
        "Pulsa Enviar invitación y comprueba la respuesta del sistema.",
        "Para modificar una cuenta, utiliza su opción de edición; en /usuarios/editar revisa los campos y pulsa Guardar cambios."
      ],
      ejemplo: "El administrador registra a un nuevo colaborador; después se le asignará un rol Scrum dentro de un proyecto.",
      resultado: "El usuario aparece en la administración y sus permisos globales corresponden al rol seleccionado.",
      advertencia: "Un Developer no necesita ser administrador global; el acceso a cada proyecto se controla por separado."
    },
    {
      titulo: "Épica 3: Creación y Administración de Proyectos",
      teoriaConcepto: "Un proyecto agrupa el objetivo del producto, sus participantes, historias, Sprints y registros de seguimiento.",
      objetivo: "Crear y mantener un proyecto durante su ciclo de vida.",
      pasos: [
        "Abre /proyectos y revisa los proyectos visibles para tu cuenta.",
        "Si tienes permiso para crear, entra en /proyectos/nuevo desde la acción de creación.",
        "Escribe un Nombre reconocible, una Descripción del contexto y el Objetivo que se pretende alcanzar.",
        "Selecciona Fecha de inicio y Fecha de fin; verifica que las fechas sean coherentes.",
        "Completa Identificador y el Estado inicial conforme a las opciones del formulario.",
        "Pulsa Guardar proyecto y vuelve al listado para comprobar su aparición.",
        "Abre el detalle del proyecto y consulta Información general y Estado del proyecto.",
        "Si cuentas con permisos, utiliza las acciones del detalle para editar, cambiar estado, finalizar, reabrir o archivar; lee las confirmaciones antes de aceptar."
      ],
      ejemplo: "Crear un proyecto para desarrollar un portal académico, con objetivo y fechas de entrega definidos.",
      resultado: "El proyecto queda registrado y su detalle muestra los datos introducidos.",
      advertencia: "Finalizar, reabrir y archivar son acciones distintas. No uses Archivar para simular eliminación; el historial debe conservarse."
    },
    {
      titulo: "Épica 4: Asignación de Equipos y Roles Scrum",
      teoriaConcepto: "Scrum establece las responsabilidades de Product Owner, Scrum Master y Developers. La plataforma también contempla participantes Interesados con permisos limitados.",
      objetivo: "Incorporar personas al proyecto y distinguir responsabilidades.",
      pasos: [
        "Abre /proyectos y entra en el detalle del proyecto correspondiente.",
        "Busca el bloque Agregar Participante (HU-14 y HU-15).",
        "En ID del Usuario introduce el identificador de una cuenta existente, por ejemplo con el formato que usa tu instalación.",
        "En Rol Scrum selecciona Product Owner, Scrum Master, Developer o Interesado.",
        "Pulsa Agregar al Equipo y revisa el mensaje de resultado.",
        "En Equipo del Proyecto comprueba que la persona figure con el rol asignado.",
        "Abre /equipos para consultar la vista de equipos y participantes accesibles."
      ],
      ejemplo: "Un equipo asigna un Product Owner para gestionar prioridades, un Scrum Master para facilitar el trabajo y Developers para construir el producto.",
      resultado: "La lista de participantes del proyecto refleja la asignación realizada.",
      advertencia: "No confundas ID del usuario con correo o nombre. La acción requiere permisos y una cuenta existente."
    },
    {
      titulo: "Épica 5: Product Backlog e Historias de Usuario",
      teoriaConcepto: "El Product Backlog es una lista ordenada y cambiante de necesidades del producto. Las historias expresan valor desde la perspectiva de quien lo recibe.",
      objetivo: "Registrar, estimar, refinar, dividir y priorizar historias.",
      pasos: [
        "En /proyectos/detalle abre el proyecto y localiza Product Backlog: historias y criterios de aceptación.",
        "Abre el formulario de nueva historia cuando tu rol lo permita.",
        "En Título escribe una necesidad concreta; en Descripción utiliza Como [rol], quiero [necesidad], para [beneficio].",
        "Selecciona Estimación relativa: Sin estimar, XS, S, M, L o XL. Las tallas representan tamaños relativos y no puntos acumulables.",
        "Si aplica, selecciona otras historias en Depende de y completa Responsable organizativo (opcional).",
        "Pulsa Agregar criterio y escribe condiciones verificables de aceptación; por ejemplo Dado un usuario registrado, cuando inicia sesión correctamente, entonces ve su panel.",
        "Pulsa Agregar tarea para descomponer el trabajo en actividades ejecutables.",
        "Guarda mediante Registrar historia; revisa su aparición en la lista de historias.",
        "Para refinar, abre la edición disponible, ajusta información y registra Aclaración del refinamiento si se muestra.",
        "Cuando corresponda, utiliza la opción de dividir una historia en historias más pequeñas o reordena prioridades con el control habilitado para tu rol."
      ],
      ejemplo: "Historia: Como estudiante, quiero recuperar mi contraseña para volver a entrar a la plataforma.",
      resultado: "La historia conserva título, descripción, estimación, criterios y tareas asociados.",
      advertencia: "El Product Owner es responsable de la ordenación del backlog. Una historia sin criterios verificables es difícil de validar."
    },
    {
      titulo: "Épica 6: Planeación y Gestión de Sprints",
      teoriaConcepto: "Un Sprint es un periodo fijo en el que el equipo persigue un Sprint Goal y crea un incremento útil. El Sprint Backlog reúne el objetivo, los elementos seleccionados y el plan de trabajo.",
      objetivo: "Definir un Sprint y seleccionar las historias que se atenderán.",
      pasos: [
        "Entra al detalle de un proyecto y localiza Sprint Backlog: definición y lista de sprints.",
        "Abre el formulario de Sprint si tienes permisos de gestión.",
        "Escribe un Nombre descriptivo, por ejemplo Sprint 1 - Autenticación.",
        "Selecciona el Estado adecuado; para un Sprint futuro utiliza Planificado.",
        "En Objetivo redacta un resultado concreto que el equipo pueda verificar al final del Sprint.",
        "Selecciona Fecha de inicio y Fecha de fin; revisa que el intervalo sea válido.",
        "En el selector de historias marca las historias del Product Backlog que el equipo se compromete a trabajar.",
        "Revisa el resumen Historias seleccionadas y pulsa Definir sprint.",
        "Consulta la lista de sprints; cuando corresponda, utiliza las opciones disponibles para editar, finalizar o cancelar según permisos y reglas."
      ],
      ejemplo: "Sprint Goal: permitir que un usuario acceda y recupere su cuenta de forma segura.",
      resultado: "El Sprint aparece con sus fechas, objetivo y las historias seleccionadas.",
      advertencia: "No confundas finalizar un Sprint con cancelar uno. La cancelación corresponde al Product Owner según las reglas del sistema."
    },
    
    {
      titulo: "Épica 7: Tablero Scrum y Estados de las Tareas",
      teoriaConcepto: "El tablero hace visible el trabajo y facilita inspeccionar el avance. Una tarea debe cambiar de estado conforme a lo que realmente ocurre, no por apariencia de progreso.",
      objetivo: "Consultar y actualizar tareas del Sprint.",
      pasos: [
        "Abre el detalle del proyecto y desplázate hasta Tablero Scrum.",
        "Identifica las columnas Por hacer, En progreso, En revisión y Terminado.",
        "Usa el selector Filtrar tablero por sprint para mostrar el Sprint relevante.",
        "Utiliza Filtrar tareas, Filtrar por responsable o Filtrar por historia para localizar una tarjeta.",
        "Abre o identifica la tarjeta de tarea que necesitas actualizar y comprueba su historia y responsable.",
        "Cuando el control de cambio de estado esté habilitado, mueve o actualiza la tarea hacia el estado correspondiente.",
        "Espera la confirmación de guardado y verifica que la tarjeta se muestre en la columna correcta.",
        "Antes de colocar una tarea en Terminado, revisa sus criterios de aceptación y la Definition of Done aplicable."
      ],
      ejemplo: "Una tarea de implementar el formulario de acceso pasa de Por hacer a En progreso; después se revisa y finalmente se completa.",
      resultado: "El tablero refleja el estado actualizado y los contadores corresponden a las tareas visibles.",
      advertencia: "Si el cambio se rechaza, revisa el rol, el Sprint, las reglas de transición y la respuesta del sistema. No asumas que arrastrar equivale siempre a guardar."
    },
    {
      titulo: "Épica 8: Definition of Done y Criterios de Calidad",
      teoriaConcepto: "La Definition of Done es el compromiso de calidad que indica cuándo un incremento cumple las condiciones acordadas. No sustituye los criterios de aceptación de cada historia.",
      objetivo: "Definir verificaciones obligatorias u opcionales y comprobar calidad.",
      pasos: [
        "Abre el detalle del proyecto y busca Definition of Done.",
        "Revisa los elementos existentes y distingue los tipos Obligatorio y Opcional.",
        "Si tu rol lo permite, pulsa + Agregar elemento.",
        "En Elemento de verificación escribe una condición observable, por ejemplo Pruebas funcionales ejecutadas sin fallos.",
        "En Tipo selecciona Obligatorio u Opcional según el acuerdo del equipo.",
        "Pulsa Guardar cambios y comprueba que el elemento figure en la tabla DoD.",
        "Si necesitas corregir una condición, utiliza la edición disponible y vuelve a guardar.",
        "Antes de dar por terminado el trabajo, compara las evidencias con la DoD y con los criterios de aceptación de la historia."
      ],
      ejemplo: "Para una historia de inicio de sesión, verificar pruebas, interfaz acordada, integración y documentación.",
      resultado: "La DoD contiene criterios claros y el equipo sabe qué revisar antes de aceptar trabajo terminado.",
      advertencia: "Registrar un elemento DoD no demuestra por sí solo que las pruebas se hayan ejecutado."
    },
    {
      titulo: "Épica 9: Impedimentos, Riesgos y Seguimiento",
      teoriaConcepto: "Un impedimento es un obstáculo actual; un riesgo es un evento incierto que podría afectar objetivos. El Scrum Master ayuda a que se eliminen impedimentos, pero todo el equipo puede hacerlos visibles.",
      objetivo: "Reconocer impedimentos y documentarlos sin confundir funciones disponibles con futuras.",
      pasos: [
        "Identifica si el problema ya bloquea el trabajo o si todavía es una posibilidad.",
        "Consulta la información de la historia, tarea o Sprint afectado en el detalle del proyecto.",
        "Comunica al equipo qué ocurre, desde cuándo y qué trabajo se ve afectado.",
        "Anota una descripción verificable, el impacto, la persona que dará seguimiento y una acción de mitigación en el canal de trabajo acordado.",
        "Revisa el problema durante el Daily Scrum y actualiza su situación hasta resolverlo.",
        "Cuando exista un formulario específico de impedimentos o riesgos en la aplicación, registra ahí los mismos datos y verifica que queden asociados al elemento correspondiente."
      ],
      ejemplo: "Impedimento: el entorno de pruebas no está disponible; riesgo: podría retrasarse la integración con un servicio externo.",
      resultado: "El equipo identifica el obstáculo, su responsable de seguimiento y la acción siguiente.",
      advertencia: "En esta versión del ZIP no se encontró una pantalla independiente de registro de impedimentos y riesgos. Este apartado es formativo, no una instrucción para un botón existente."
    },
    {
      titulo: "Épica 10: Eventos Scrum y Coordinación del Equipo",
      teoriaConcepto: "Scrum contempla Sprint Planning, Daily Scrum, Sprint Review y Sprint Retrospective; cada evento tiene un propósito distinto y ayuda a inspeccionar y adaptar el trabajo.",
      objetivo: "Comprender qué revisar antes, durante y después de cada evento.",
      pasos: [
        "Antes del Sprint Planning, revisa el Product Backlog ordenado y las historias listas para discusión.",
        "En Planning, acuerden por qué el Sprint es valioso, qué historias pueden atenderse y cómo se realizará el trabajo. Registra el Sprint Goal en el formulario del Sprint.",
        "Durante cada Daily Scrum, los Developers inspeccionan el progreso hacia el Sprint Goal y adaptan el plan de las siguientes 24 horas.",
        "Utiliza el Tablero Scrum para identificar tareas bloqueadas, en progreso y terminadas.",
        "En Sprint Review, presenta el incremento a las personas interesadas y registra observaciones que puedan orientar el Product Backlog.",
        "En Retrospective, identifica prácticas que funcionaron, dificultades y una mejora concreta para el próximo Sprint.",
        "Conserva minutas y acuerdos en el canal de comunicación que haya definido tu equipo mientras no exista un módulo dedicado a eventos."
      ],
      ejemplo: "Tras una Review, el equipo recibe comentarios sobre la navegación y crea o refina historias para atenderlos.",
      resultado: "Cada evento tiene un resultado identificable y el equipo puede trasladar acuerdos al backlog o al plan del Sprint.",
      advertencia: "El ZIP no incluye una pantalla independiente para agendar eventos ni almacenar minutas; no se debe afirmar que existe."
    },
    {
      titulo: "Épica 11: Métricas, Burndown y Trabajo por Tallas",
      teoriaConcepto: "Las métricas ayudan a inspeccionar tendencias, pero no sustituyen la conversación sobre valor, calidad y obstáculos. Las tallas XS a XL son categorías de estimación, no cantidades sumables.",
      objetivo: "Leer los reportes y detectar límites de interpretación.",
      pasos: [
        "Abre /reportes desde la navegación.",
        "En Seleccionar proyecto elige el proyecto que deseas analizar.",
        "En Seleccionar sprint elige un Sprint con datos registrados.",
        "Observa Burndown Chart: compara la referencia Ideal con la curva Actual; interpreta los resultados junto con las fechas y cambios del Sprint.",
        "Revisa Historias por Talla de Estimación y compara las cantidades en XS, S, M, L y XL sin convertirlas automáticamente en una suma de puntos.",
        "Consulta los paneles restantes para revisar tareas en progreso y el estado del trabajo.",
        "Si aparece No hay suficientes tareas registradas ni tiempo transcurrido, no extraigas conclusiones de una gráfica incompleta."
      ],
      ejemplo: "Un Sprint con varias historias XS y una XL no equivale a un número único de puntos por simple suma de tallas.",
      resultado: "Los filtros muestran el Sprint elegido y las gráficas se interpretan según la información disponible.",
      advertencia: "No confundas una línea de referencia con una promesa de rendimiento; los datos incompletos limitan las conclusiones."
    },
    {
      titulo: "Épica 12: Historial, Reportes y Exportación",
      teoriaConcepto: "La transparencia requiere poder revisar decisiones y cambios. Los reportes permiten compartir el estado del trabajo con quienes necesitan conocerlo.",
      objetivo: "Consultar el historial y exportar métricas de un Sprint.",
      pasos: [
        "Abre el detalle del proyecto y localiza Historial de cambios.",
        "Utiliza Buscar usuario o elemento para encontrar registros relacionados con una persona o entidad.",
        "En Filtrar por elemento selecciona Tareas, Historias, Proyecto, Sprints o Definition of Done, según lo que necesites investigar.",
        "Revisa el registro resultante para identificar la acción y su contexto; evita modificar información solo para generar historial.",
        "Abre /reportes y selecciona el proyecto y el Sprint correctos.",
        "Comprueba que las métricas correspondan al periodo que necesitas comunicar.",
        "Pulsa Exportar y revisa el archivo o la respuesta generada por el sistema.",
        "Antes de compartirlo, confirma que el reporte no contenga datos ajenos al destinatario y explica si las métricas son insuficientes."
      ],
      ejemplo: "Preparar un reporte del Sprint 1 y revisar qué tareas cambiaron de estado durante el periodo.",
      resultado: "El historial se puede filtrar y la exportación corresponde al Sprint seleccionado.",
      advertencia: "La exportación implementada está asociada a métricas de un Sprint; no debe presentarse como exportación universal de todas las entidades."
    },
  ];

  // ================================================================
  // CARGA DEL PROGRESO DE CAPACITACIÓN
  // ================================================================

  async function cargarProgreso() {
    const r = await Api.get('/api/training/progreso');

    if (r.ok && r.datos?.progreso) {
      const prog = r.datos.progreso;

      pasoActual = typeof prog.pasoIndex === 'number'
        ? prog.pasoIndex
        : 0;

      actualizarInterfazProgreso(false);

      if (prog.porcentaje === 0 && pasoActual === 0) {
        modalBienvenida.hidden = false;
        contenedorTutorial.style.opacity = '0.4';
      }
    }

    const resAdmin = await Api.get('/api/training/admin/avances');

    if (resAdmin.ok && resAdmin.datos?.avances) {
      panelAdmin.hidden = false;

      tablaAdmin.innerHTML = resAdmin.datos.avances.map((item) => `
        <tr>
          <td>
            <strong>${UI.escapar(item.nombre)}</strong>
            <br>
            <small class="texto-suave">
              ${UI.escapar(item.correo)}
            </small>
          </td>
          <td>${UI.escapar(item.moduloActual)}</td>
          <td>
            <span class="insignia insignia--activo">
              ${item.porcentaje}%
            </span>
          </td>
        </tr>
      `).join('');
    }

    Icons.hidratar();
  }

  // ================================================================
  // ACTUALIZACIÓN DE LA INTERFAZ Y DEL PROGRESO
  // ================================================================

  function actualizarInterfazProgreso(guardar = true) {
    const totalPasos = pasosCapacitacion.length;

    const porcentajeCalculado = Math.round(
      ((pasoActual + 1) / totalPasos) * 100
    );

    const leccion = pasosCapacitacion[pasoActual];
    const esc = UI.escapar;

    tituloModulo.innerHTML = `
      <span class="icono-ficha" data-icon="bandera"></span>
      ${esc(leccion.titulo)}
    `;

    
    contenidoTeoria.innerHTML = `
      <div class="capacitacion-contenido"
          style="line-height:1.7;">

        <!-- OBJETIVO DE APRENDIZAJE -->
        <div style="
          padding:12px 16px;
          margin-bottom:20px;
          background:#f5f7f6;
          border-radius:8px;
        ">
          <div style="
            color:#587064;
            font-size:11px;
            font-weight:700;
            letter-spacing:.7px;
            margin-bottom:5px;
            text-transform:uppercase;
          ">
            Objetivo de aprendizaje
          </div>

          <div>${esc(leccion.objetivo)}</div>
        </div>

        <!-- FUNDAMENTO SCRUM -->
        <div style="
          padding:14px 16px;
          margin-bottom:24px;
          background:rgba(34,139,79,.07);
          border-left:4px solid #238448;
          border-radius:6px;
        ">
          <div style="
            color:#176b39;
            font-weight:700;
            margin-bottom:7px;
          ">
            Fundamento Scrum
          </div>

          <p style="margin:0;">
            ${esc(leccion.teoriaConcepto)}
          </p>
        </div>

        <!-- GUÍA PASO A PASO -->
        <section style="margin-bottom:24px;">
          <h3 style="
            font-size:16px;
            margin:0 0 12px;
            font-weight:700;
          ">
            Guía paso a paso en Scrum Manager
          </h3>

          <ol style="
            padding-left:24px;
            margin:0;
          ">
            ${leccion.pasos.map(p => `
              <li style="
                margin-bottom:12px;
                padding-left:4px;
              ">
                ${esc(p)}
              </li>
            `).join('')}
          </ol>
        </section>

        <!-- EJEMPLO PRÁCTICO -->
        <section style="
          margin-bottom:20px;
          padding-top:16px;
          border-top:1px solid #e5e9e6;
        ">
          <h3 style="
            font-size:15px;
            margin:0 0 8px;
          ">
            Ejemplo práctico
          </h3>

          <p style="margin:0;">
            ${esc(leccion.ejemplo)}
          </p>
        </section>

        <!-- COMPROBACIÓN -->
        <section style="margin-bottom:20px;">
          <h3 style="
            font-size:15px;
            margin:0 0 8px;
          ">
            ¿Cómo comprobar el resultado?
          </h3>

          <p style="margin:0;">
            ${esc(leccion.resultado)}
          </p>
        </section>

        <!-- ADVERTENCIA -->
        <div style="
          background:#e5f1eb;
          border-radius:9px;
          padding:14px 16px;
          font-size:13px;
          line-height:1.6;
        ">
          <strong style="color:#176b39;">
            Importante:
          </strong>
          ${esc(leccion.advertencia)}
        </div>

      </div>
    `;

    indicadorTexto.textContent =
      `Paso ${pasoActual + 1} de ${totalPasos}`;

    textoPorcentaje.textContent = `${porcentajeCalculado}%`;
    barraProgreso.value = porcentajeCalculado;

    btnAnterior.disabled = pasoActual === 0;

    btnSiguiente.textContent =
      pasoActual === totalPasos - 1
        ? 'Finalizar capacitación'
        : 'Siguiente';

    if (guardar) {
      Api.put('/api/training/progreso', {
        porcentaje: porcentajeCalculado,
        pasoIndex: pasoActual,
        moduloActual: `Épica ${pasoActual + 1}`,
        completado: porcentajeCalculado === 100
      });
    }
  }

  // ================================================================
  // BOTONES DE BIENVENIDA
  // ================================================================

  document.getElementById('btn-ahora').addEventListener('click', () => {
    modalBienvenida.hidden = true;
    contenedorTutorial.style.opacity = '1';
  });

  document.getElementById('btn-despues').addEventListener('click', () => {
    modalBienvenida.hidden = true;
    contenedorTutorial.style.opacity = '1';

    UI.toast(
      'Puedes retomar la capacitación en cualquier momento.',
      'info'
    );
  });

  // ================================================================
  // NAVEGACIÓN ENTRE MÓDULOS
  // ================================================================

  btnSiguiente.addEventListener('click', () => {
    if (pasoActual < pasosCapacitacion.length - 1) {
      pasoActual++;
      actualizarInterfazProgreso(true);
    } else {
      UI.toast(
        '¡Has completado todas las épicas de Scrum Manager!',
        'exito'
      );
    }
  });

  btnAnterior.addEventListener('click', () => {
    if (pasoActual > 0) {
      pasoActual--;
      actualizarInterfazProgreso(true);
    }
  });

  // ================================================================
  // INICIALIZACIÓN
  // ================================================================

  await cargarProgreso();

})();
