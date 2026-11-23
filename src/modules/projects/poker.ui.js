/* Interfaz de Planning Poker. Usa las sesiones del proyecto y refresco periódico. */
const PokerUI = {
  iniciado: false,
  idProyecto: null,
  miRol: null,
  archivado: false,
  historias: [],
  sesiones: [],
  idSesion: null,
  detalle: null,
  ocupado: false,
  ultimaFirma: '',

  escapar(valor) { return UI.escapar(String(valor ?? '')); },
  ruta(sufijo = '') {
    return `/api/projects/${encodeURIComponent(this.idProyecto)}/poker${sufijo}`;
  },
  informar(mensaje, tipo = 'error') { UI.toast(mensaje, tipo); },
  puedeDirigir() { return this.miRol === 'Scrum Master' && !this.archivado; },

  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;

    document.getElementById('poker-form-crear').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.ocupado || !this.puedeDirigir()) return;
      const idHistoria = document.getElementById('poker-historia').value;
      if (!idHistoria) return this.informar('Selecciona una historia del proyecto.');
      this.ocupado = true;
      const r = await Api.post(this.ruta(), { idHistoria });
      this.ocupado = false;
      if (!r.ok) return this.informar(r.datos?.mensaje || 'No se pudo abrir Planning Poker.');
      this.idSesion = r.datos.sesion.id;
      this.ultimaFirma = '';
      await this.refrescar();
      this.informar('Sesión de Planning Poker abierta.', 'exito');
    });

    document.getElementById('poker-sesiones').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-poker-sesion]');
      if (!btn) return;
      this.idSesion = btn.dataset.pokerSesion;
      this.ultimaFirma = '';
      await this.refrescarDetalle();
      this.pintarSesiones();
    });

    document.getElementById('poker-detalle').addEventListener('click', async (e) => {
      const carta = e.target.closest('[data-poker-voto]');
      if (carta) {
        if (this.miRol !== 'Developer' || this.archivado) return;
        await this.accion('votar', { puntos: Number(carta.dataset.pokerVoto) });
        return;
      }
      const boton = e.target.closest('[data-poker-accion]');
      if (!boton) return;
      const accion = boton.dataset.pokerAccion;
      if (accion === 'finalizar') {
        const select = document.getElementById('poker-puntos');
        const input = document.getElementById('poker-horas');
        const puntos = Number(select.value);
        const horasEstimadas = Number(input.value);
        if (!select.value || !input.value || !Number.isFinite(horasEstimadas) || horasEstimadas <= 0) {
          return this.informar('Selecciona los puntos acordados e indica horas mayores a cero.');
        }
        const ok = await UI.confirmar({
          titulo: 'Guardar estimación',
          mensaje: `¿Guardar ${puntos} punto(s) y ${horasEstimadas} hora(s) en la historia?`,
          textoOk: 'Guardar'
        });
        if (!ok) return;
        await this.accion('finalizar', { puntos, horasEstimadas });
      } else if (accion === 'revelar' || accion === 'nueva-ronda') {
        await this.accion(accion);
      }
    });

    document.getElementById('poker-actualizar').addEventListener('click', () => this.refrescar());
    // Las demás cuentas ven el resultado automáticamente al revelar las cartas.
    setInterval(() => {
      if (this.idProyecto && !this.ocupado && document.visibilityState === 'visible') {
        this.refrescar();
      }
    }, 4000);
  },

  async accion(nombre, datos = {}) {
    if (!this.idSesion || this.ocupado) return;
    this.ocupado = true;
    const r = await Api.post(this.ruta(`/${encodeURIComponent(this.idSesion)}/${nombre}`), datos);
    this.ocupado = false;
    if (!r.ok) return this.informar(r.datos?.mensaje || 'No se completó la operación.');
    this.ultimaFirma = '';
    await this.refrescar();
    if (nombre === 'votar') this.informar('Carta guardada. Permanece oculta hasta la revelación.', 'exito');
    if (nombre === 'revelar') this.informar('Se revelaron las cartas de la ronda.', 'exito');
    if (nombre === 'nueva-ronda') this.informar('Nueva ronda disponible.', 'exito');
    if (nombre === 'finalizar') this.informar('Estimación guardada en la historia.', 'exito');
  },

  async cargar(idProyecto, miRol, archivado, historias = []) {
    this.iniciar();
    if (this.idProyecto !== idProyecto) {
      this.idSesion = null;
      this.ultimaFirma = '';
    }
    this.idProyecto = idProyecto;
    this.miRol = miRol;
    this.archivado = !!archivado;
    this.historias = historias || [];
    const form = document.getElementById('poker-form-crear');
    form.hidden = !this.puedeDirigir();
    const selector = document.getElementById('poker-historia');
    const previo = selector.value;
    selector.replaceChildren();
    selector.add(new Option('Selecciona una historia', ''));
    for (const h of this.historias) selector.add(new Option(`${h.id} — ${h.titulo}`, h.id));
    if (this.historias.some(h => h.id === previo)) selector.value = previo;
    await this.refrescar();
  },

  async refrescar() {
    if (!this.idProyecto || this.ocupado) return;
    const r = await Api.get(this.ruta());
    if (!r.ok) {
      document.getElementById('poker-sesiones').textContent = r.datos?.mensaje || 'No se pudieron consultar las sesiones.';
      return;
    }
    this.sesiones = r.datos.sesiones || [];
    if (this.idSesion && !this.sesiones.some(s => s.id === this.idSesion)) this.idSesion = null;
    if (!this.idSesion && this.sesiones.length) {
      this.idSesion = this.sesiones.find(s => s.estado !== 'finalizada')?.id || this.sesiones[this.sesiones.length - 1].id;
    }
    this.pintarSesiones();
    await this.refrescarDetalle();
  },

  pintarSesiones() {
    const lista = document.getElementById('poker-sesiones');
    if (!this.sesiones.length) {
      lista.innerHTML = '<p class="texto-suave">Todavía no hay sesiones de Planning Poker en este proyecto.</p>';
      return;
    }
    lista.innerHTML = this.sesiones.map(s => `
      <button type="button" class="poker-sesion ${this.idSesion === s.id ? 'poker-sesion--activa' : ''}"
              data-poker-sesion="${this.escapar(s.id)}">
        <strong>${this.escapar(s.id)} · ${this.escapar(s.tituloHistoria)}</strong>
        <small>Ronda ${Number(s.ronda)} · ${this.estadoLegible(s.estado)} · ${Number(s.numeroVotos)} voto(s)</small>
      </button>
    `).join('');
  },

  estadoLegible(s) {
    return ({ votando: 'Votación abierta', revelada: 'Votos revelados', finalizada: 'Finalizada' })[s] || s;
  },

  async refrescarDetalle() {
    const contenedor = document.getElementById('poker-detalle');
    if (!this.idSesion) {
      this.ultimaFirma = '';
      contenedor.innerHTML = '<p class="texto-suave">Selecciona o abre una sesión para empezar.</p>';
      return;
    }
    const r = await Api.get(this.ruta(`/${encodeURIComponent(this.idSesion)}`));
    if (!r.ok) {
      contenedor.textContent = r.datos?.mensaje || 'No fue posible consultar la sesión.';
      return;
    }
    const firma = JSON.stringify([r.datos.sesion, this.miRol, this.archivado]);
    if (firma === this.ultimaFirma) return;
    // Si el Scrum Master escribe su acuerdo, el refresco automático respeta el formulario.
    if (document.activeElement && ['poker-horas', 'poker-puntos'].includes(document.activeElement.id)) return;
    this.ultimaFirma = firma;
    this.detalle = r.datos.sesion;
    this.pintarDetalle();
  },

  pintarDetalle() {
    const s = this.detalle;
    const div = document.getElementById('poker-detalle');
    const verVotos = s.estado !== 'votando';
    const puedeVotar = this.miRol === 'Developer' && s.estado === 'votando' && !this.archivado;
    const puedeGestionar = this.puedeDirigir();
    let html = `<div class="poker-cabecera"><h3>${this.escapar(s.tituloHistoria)}</h3>
      <span class="insignia">${this.estadoLegible(s.estado)} · Ronda ${Number(s.ronda)}</span></div>`;
    html += `<p class="texto-suave">Han votado ${Number(s.numeroVotos)} desarrollador(es). Las cartas permanecen secretas hasta la revelación.</p>`;
    if (s.participantes?.length) {
      html += `<div class="poker-participantes">${s.participantes.map(p => `<span class="poker-persona">
        ${this.escapar(p.nombre)} <span class="poker-indicador">${p.haVotado ? '✓ Votó' : 'Pendiente'}</span></span>`).join('')}</div>`;
    }
    if (puedeVotar) {
      html += `<h4>Elige una carta Fibonacci</h4><div class="poker-cartas">${s.cartas.map(n => `
        <button type="button" class="poker-carta ${s.miVoto === n ? 'poker-carta--seleccionada' : ''}"
          data-poker-voto="${n}" aria-pressed="${s.miVoto === n}">${n}</button>`).join('')}</div>
        <p class="texto-suave">Puedes cambiar tu carta antes de que el Scrum Master revele los votos.</p>`;
    }
    if (verVotos) {
      html += `<h4>Votos de la ronda ${Number(s.ronda)}</h4><div class="poker-votos">${(s.votos || []).map(v => `
        <span class="poker-voto"><strong>${this.escapar(v.nombre)}</strong><span>${Number(v.puntos)} pts</span></span>`).join('')}</div>`;
    }
    if (puedeGestionar && s.estado === 'votando') {
      html += `<button type="button" class="btn btn-primario" data-poker-accion="revelar" ${s.numeroVotos === 0 ? 'disabled' : ''}>Revelar votos</button>`;
    }
    if (puedeGestionar && s.estado === 'revelada') {
      const valores = (s.votos || []).map(v => v.puntos);
      const consenso = valores.length && valores.every(v => v === valores[0]) ? valores[0] : null;
      html += `<div class="poker-finalizar"><h4>Acuerdo final de la estimación</h4>
        <p class="texto-suave">Si hay diferencias, conversen y abran una nueva ronda. Si están de acuerdo, guarden puntos y horas estimadas.</p>
        <div class="poker-campos"><div class="campo"><label for="poker-puntos">Puntos de historia</label>
        <select id="poker-puntos" class="control"><option value="">Selecciona puntos</option>
        ${s.cartas.map(n => `<option value="${n}" ${consenso === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="campo"><label for="poker-horas">Horas estimadas</label>
        <input id="poker-horas" class="control" type="number" min="0.1" max="10000" step="0.5" placeholder="Ej.: 16" required></div></div>
        <div class="historias-acciones"><button type="button" class="btn btn-secundario" data-poker-accion="nueva-ronda">Nueva ronda</button>
        <button type="button" class="btn btn-primario" data-poker-accion="finalizar">Guardar puntos y horas</button></div></div>`;
    }
    if (s.estado === 'finalizada') {
      html += `<p class="poker-resultado"><strong>Estimación guardada:</strong> ${Number(s.puntosAcordados)} puntos · ${Number(s.horasEstimadas)} horas</p>`;
    }
    div.innerHTML = html;
  }
};
