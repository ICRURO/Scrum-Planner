/* Gestión visual de épicas dentro del detalle del proyecto. */
const EpicasUI = {
  idProyecto: null,
  epicas: [],
  puedeGestionar: false,
  archivado: false,
  inicializado: false,

  escapar(texto) {
    return UI.escapar(String(texto ?? ''));
  },

  iniciar() {
    if (this.inicializado) return;
    this.inicializado = true;
    const boton = document.getElementById('btn-nueva-epica');
    const formulario = document.getElementById('form-epica');
    const cancelar = document.getElementById('cancelar-epica');
    const color = document.getElementById('epica-color');
    const selectorColor = document.getElementById('epica-color-selector');

    boton.addEventListener('click', () => {
      formulario.reset();
      document.getElementById('epica-id').value = '';
      document.getElementById('titulo-form-epica').textContent = 'Nueva épica';
      color.value = '#208E60';
      selectorColor.value = '#208e60';
      formulario.hidden = false;
      document.getElementById('epica-nombre').focus();
    });
    cancelar.addEventListener('click', () => { formulario.hidden = true; });
    selectorColor.addEventListener('input', () => { color.value = selectorColor.value.toUpperCase(); });
    color.addEventListener('input', () => {
      if (/^#[\da-fA-F]{6}$/.test(color.value)) selectorColor.value = color.value;
    });
    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      if (!this.puedeGestionar || this.archivado || !this.idProyecto) return;
      const datos = {
        nombre: document.getElementById('epica-nombre').value.trim(),
        descripcion: document.getElementById('epica-descripcion').value.trim(),
        color: color.value.trim()
      };
      if (!datos.nombre || !/^#[\da-fA-F]{6}$/.test(datos.color)) {
        UI.toast('La épica requiere nombre y color hexadecimal válido.', 'error');
        return;
      }
      const idEpica = document.getElementById('epica-id').value;
      const urlBase = `/api/projects/${encodeURIComponent(this.idProyecto)}/epicas`;
      const r = idEpica
        ? await Api.put(`${urlBase}/${encodeURIComponent(idEpica)}`, datos)
        : await Api.post(urlBase, datos);
      if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo guardar la épica.', 'error');
      formulario.hidden = true;
      await this.cargar(this.idProyecto, null, this.archivado);
      if (!idEpica) this.seleccionar(r.datos.epica.id);
      UI.toast(r.datos.mensaje, 'exito');
    });

    document.getElementById('lista-epicas').addEventListener('click', (evento) => {
      const btn = evento.target.closest('[data-editar-epica]');
      if (!btn || !this.puedeGestionar) return;
      const epica = this.epicas.find((e) => e.id === btn.dataset.editarEpica);
      if (!epica) return;
      document.getElementById('epica-id').value = epica.id;
      document.getElementById('epica-nombre').value = epica.nombre;
      document.getElementById('epica-descripcion').value = epica.descripcion || '';
      color.value = epica.color;
      selectorColor.value = epica.color;
      document.getElementById('titulo-form-epica').textContent = `Editar ${epica.id}`;
      formulario.hidden = false;
      formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  },

  async cargar(idProyecto, miRol, archivado) {
    this.iniciar();
    this.idProyecto = idProyecto;
    this.archivado = !!archivado;
    const r = await Api.get(`/api/projects/${encodeURIComponent(idProyecto)}/epicas`);
    if (!r.ok) {
      this.epicas = [];
      this.puedeGestionar = false;
      document.getElementById('lista-epicas').textContent = r.datos?.mensaje || 'No se pudieron cargar las épicas.';
      return;
    }
    this.epicas = r.datos.epicas || [];
    this.puedeGestionar = !!r.datos.puedeGestionar;
    document.getElementById('btn-nueva-epica').hidden = !this.puedeGestionar;
    if (!this.puedeGestionar) document.getElementById('form-epica').hidden = true;
    this.renderizar();
    this.cargarSelector();
  },

  renderizar() {
    const lista = document.getElementById('lista-epicas');
    if (!this.epicas.length) {
      lista.innerHTML = '<p class="texto-suave">Todavía no hay épicas registradas en este proyecto.</p>';
      return;
    }
    lista.innerHTML = this.epicas.map((e) => `
      <article class="epica-tarjeta">
        <span class="epica-color" style="background-color:${e.color}"></span>
        <div class="epica-tarjeta__info">
          <strong>${this.escapar(e.id)} — ${this.escapar(e.nombre)}</strong>
          <p class="texto-suave">${this.escapar(e.descripcion || 'Sin descripción')}</p>
          <small class="texto-suave">${Number(e.totalHistorias) || 0} historia(s) relacionada(s)</small>
        </div>
        ${this.puedeGestionar ? `<button class="btn btn-secundario btn-chico" type="button" data-editar-epica="${this.escapar(e.id)}">Editar</button>` : ''}
      </article>
    `).join('');
  },

  cargarSelector() {
    const selector = document.getElementById('historia-epica');
    const anterior = selector.value;
    selector.replaceChildren();
    const vacia = new Option('Selecciona una épica', '');
    selector.add(vacia);
    for (const e of this.epicas) {
      selector.add(new Option(`${e.id} - ${e.nombre}`, e.id));
    }
    selector.value = this.epicas.some((e) => e.id === anterior) ? anterior : '';
  },

  seleccionar(idEpica) {
    const selector = document.getElementById('historia-epica');
    selector.value = idEpica || '';
  },

  epicaSeleccionada() {
    return document.getElementById('historia-epica').value;
  },

  insignia(idEpica) {
    const epica = this.epicas.find((e) => e.id === idEpica);
    if (!epica) return '<small class="texto-suave">Sin épica (historia anterior)</small>';
    return `<span class="insignia epica-etiqueta" style="border-left:4px solid ${epica.color}">${this.escapar(epica.nombre)}</span>`;
  }
};
