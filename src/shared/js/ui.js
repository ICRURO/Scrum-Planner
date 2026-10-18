
/* UTILIDADES DE INTERFACES REUTILIZABLES */

const UI = (() => {
  // Evita que un texto con < o > se interprete como HTML
  const escapar = (texto) =>
    String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const iniciales = (nombre = '') =>
    nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

  // Acepta "2026-10-05" (solo fecha) o una fecha con hora. Las fechas sin hora se leen
  // como locales para que no se recorran un día por la zona horaria
  const formatoFecha = (iso) => {
    if (!iso) return '—';
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const rangoFechas = (inicio, fin) => `${formatoFecha(inicio)} – ${formatoFecha(fin)}`;

  // ----- Insignias de estado -----
  const ESTADOS_PROYECTO = {
    preparacion: { texto: 'En preparación', clase: 'preparacion' },
    activo: { texto: 'Activo', clase: 'activo' },
    suspendido: { texto: 'Suspendido', clase: 'suspendido' },
    finalizado: { texto: 'Finalizado', clase: 'finalizado' }
  };
  const ESTADOS_USUARIO = {
    activo: { texto: 'Activo', clase: 'activo' },
    desactivado: { texto: 'Desactivado', clase: 'suspendido' },
    invitacion_pendiente: { texto: 'Invitación pendiente', clase: 'preparacion' }
  };
  const ROLES_GLOBALES = { administrador: 'Administrador general', usuario: 'Usuario' };

  function insignia(mapa, estado) {
    const e = mapa[estado] || { texto: estado, clase: 'suspendido' };
    return `<span class="insignia insignia--${e.clase}">${escapar(e.texto)}</span>`;
  }
  const insigniaProyecto = (estado) => insignia(ESTADOS_PROYECTO, estado);
  const insigniaUsuario = (estado) => insignia(ESTADOS_USUARIO, estado);
  const insigniaRol = (texto) => `<span class="insignia insignia--rol">${escapar(texto)}</span>`;

  // ----- Aviso temporal (esquina inferior derecha) -----
  function toast(mensaje, tipo = 'info') {
    let zona = document.getElementById('toast-zona');
    if (!zona) {
      zona = document.createElement('div');
      zona.id = 'toast-zona';
      zona.className = 'toast-zona';
      zona.setAttribute('aria-live', 'polite');
      document.body.appendChild(zona);
    }
    const icono = tipo === 'error' ? 'alerta' : tipo === 'exito' ? 'check' : 'info';
    const t = document.createElement('div');
    t.className = `toast toast--${tipo}`;
    t.innerHTML = `${Icons.get(icono, 20)}<span>${escapar(mensaje)}</span>`;
    zona.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  // ----- Confirmación antes de una acción delicada -----
  // const ok = await UI.confirmar({ titulo: 'Desactivar cuenta', mensaje: '...', peligro: true });
  function confirmar({ titulo, mensaje, textoOk = 'Confirmar', textoCancelar = 'Cancelar', peligro = false }) {
    return new Promise((resolver) => {
      const fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
          <h2 id="modal-titulo">${escapar(titulo)}</h2>
          <p>${escapar(mensaje)}</p>
          <div class="modal__acciones">
            <button class="btn btn-secundario" data-r="no">${escapar(textoCancelar)}</button>
            <button class="btn ${peligro ? 'btn-peligro-solido' : 'btn-primario'}" data-r="si">${escapar(textoOk)}</button>
          </div>
        </div>`;
      const cerrar = (valor) => { document.removeEventListener('keydown', alTeclear); fondo.remove(); resolver(valor); };
      const alTeclear = (e) => { if (e.key === 'Escape') cerrar(false); };
      fondo.addEventListener('click', (e) => {
        if (e.target === fondo) return cerrar(false);
        const boton = e.target.closest('[data-r]');
        if (boton) cerrar(boton.dataset.r === 'si');
      });
      document.addEventListener('keydown', alTeclear);
      document.body.appendChild(fondo);
      fondo.querySelector('[data-r="si"]').focus();
    });
  }

  // Muestra el círculo de carga en un botón mientras se espera al servidor
  function cargando(boton, activo) {
    boton.classList.toggle('cargando', activo);
    boton.disabled = activo;
  }

  // ----- Validación de formularios -----
  // Marca un campo con error y escribe el mensaje debajo de él
  function marcarError(input, mensaje) {
    const campo = input.closest('.campo');
    let aviso = campo.querySelector('.campo__error');
    if (!aviso) {
      aviso = document.createElement('span');
      aviso.className = 'campo__error';
      campo.appendChild(aviso);
    }
    aviso.textContent = mensaje;
    input.classList.add('invalido');
    input.setAttribute('aria-invalid', 'true');
  }
  function limpiarErrores(formulario) {
    formulario.querySelectorAll('.campo__error').forEach((e) => e.remove());
    formulario.querySelectorAll('.invalido').forEach((i) => { i.classList.remove('invalido'); i.removeAttribute('aria-invalid'); });
  }

  // Para botones cuya función está pendiente
  const pendiente = () => toast('Esta acción se activa en el siguiente paso.', 'info');

  return { escapar, iniciales, formatoFecha, rangoFechas, marcarError, limpiarErrores, pendiente, insigniaProyecto, insigniaUsuario, insigniaRol, toast, confirmar, cargando, ROLES_GLOBALES };
})();
