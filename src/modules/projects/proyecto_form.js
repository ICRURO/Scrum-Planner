// Formulario de proyecto: sirve para crear (/proyectos/nuevo) y editar (/proyectos/editar?id=PRJ-000)

(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const editando = Boolean(id);
  const campo = (c) => document.getElementById(c);
  const aviso = campo('error-carga');

  if (editando) {
    campo('titulo').textContent = 'Editar proyecto';
    campo('etiqueta-estado').textContent = 'Estado actual';
    campo('btn-cancelar').href = `/proyectos/detalle?id=${encodeURIComponent(id)}`;
    Layout.fijarVolver(`/proyectos/detalle?id=${encodeURIComponent(id)}`);

    const r = await Api.get(`/api/projects/${encodeURIComponent(id)}`);
    if (!r.ok) {
      aviso.innerHTML = `${Icons.get('alerta', 20)}<span>${UI.escapar(r.datos?.mensaje || 'No se pudo cargar el proyecto.')}</span>`;
      aviso.hidden = false;
      campo('form-proyecto').hidden = true;
      return;
    }
    const p = r.datos.proyecto;
    campo('nombre').value = p.nombre;
    campo('descripcion').value = p.descripcion;
    campo('objetivo').value = p.objetivo;
    campo('inicio').value = p.fechaInicio;
    campo('fin').value = p.fechaFin;
    campo('identificador').value = p.id;
    campo('estado').value = { preparacion: 'En preparación', activo: 'Activo', suspendido: 'Suspendido', finalizado: 'Finalizado' }[p.estado];
  } else {
    const r = await Api.get('/api/projects');
    campo('identificador').value = r.ok ? r.datos.siguienteId : '';
    campo('estado').value = 'En preparación';
  }

  const form = campo('form-proyecto');
  const boton = form.querySelector('[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.limpiarErrores(form);
    let valido = true;
    ['nombre', 'descripcion', 'objetivo'].forEach((c) => {
      if (!campo(c).value.trim()) { UI.marcarError(campo(c), 'Este campo es obligatorio.'); valido = false; }
    });
    if (!campo('inicio').value) { UI.marcarError(campo('inicio'), 'Elige la fecha de inicio.'); valido = false; }
    if (!campo('fin').value) { UI.marcarError(campo('fin'), 'Elige la fecha de fin.'); valido = false; }
    if (campo('inicio').value && campo('fin').value && campo('fin').value < campo('inicio').value) {
      UI.marcarError(campo('fin'), 'La fecha de fin debe ser posterior a la de inicio.'); valido = false;
    }
    if (!valido) return;

    const datos = {
      nombre: campo('nombre').value.trim(),
      descripcion: campo('descripcion').value.trim(),
      objetivo: campo('objetivo').value.trim(),
      fechaInicio: campo('inicio').value,
      fechaFin: campo('fin').value
    };

    UI.cargando(boton, true);
    const r = editando
      ? await Api.put(`/api/projects/${encodeURIComponent(id)}`, datos)
      : await Api.post('/api/projects', datos);
    UI.cargando(boton, false);

    if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo guardar el proyecto.', 'error');

    // El aviso de éxito se muestra en la página de destino
    sessionStorage.setItem('flash', r.datos.mensaje);
    window.location.href = `/proyectos/detalle?id=${encodeURIComponent(r.datos.proyecto.id)}`;
  });
})();