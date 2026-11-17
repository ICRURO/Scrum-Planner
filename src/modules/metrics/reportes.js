(async function () {
    const sesion = await Layout.listo;
    if (!sesion) return;

    const selectProyecto = document.getElementById('select-proyecto');
    const selectSprint = document.getElementById('select-sprint');
    const formatoReporte = document.getElementById('formato-reporte');
    const alertaDatos = document.getElementById('alerta-datos-insuficientes');
    const contenedorSvg = document.getElementById('grafico-burndown');
    const tablaProgreso = document.getElementById('tabla-tareas-progreso');
    const tablaSprintsHistorial = document.getElementById('tabla-sprints-historial');
    const tablaReportesEstado = document.getElementById('tabla-reportes-estado');
    const resumenProyecto = document.getElementById('resumen-proyecto');
    const notasBurndown = document.getElementById('notas-burndown');

    let proyectos = [];

    async function inicializar() {
        const r = await Api.get('/api/projects');
        if (!r.ok) return UI.toast('Error al consultar proyectos.', 'error');
        proyectos = r.datos.proyectos || [];

        if (!proyectos.length) {
            selectProyecto.innerHTML = '<option value="">Sin proyectos</option>';
            selectSprint.innerHTML = '<option value="">Sin sprints</option>';
            return;
        }

        selectProyecto.innerHTML = proyectos
            .map((p) => `<option value="${p.id}">${p.id} · ${UI.escapar(p.nombre)}</option>`)
            .join('');

        const urlParams = new URLSearchParams(window.location.search);
        const idUrl = urlParams.get('id');
        if (idUrl && proyectos.some((p) => p.id === idUrl)) {
            selectProyecto.value = idUrl;
        }

        await cambiarProyecto();
    }

    async function cambiarProyecto() {
        const idProyecto = selectProyecto.value;
        if (!idProyecto) return;

        const projObj = proyectos.find(p => p.id === idProyecto);
        if (projObj && resumenProyecto) {
            resumenProyecto.textContent = `Proyecto: ${projObj.nombre} — Estado: ${projObj.estado.toUpperCase()}${projObj.fechaCierre ? ' (Cerrado el ' + projObj.fechaCierre + ')' : ''}`;
        }

        await cargarHistorialSprintsPasados(idProyecto);

        const res = await Api.get(`/api/metrics/proyectos/${encodeURIComponent(idProyecto)}/sprints/ACTUAL`);
        if (!res.ok) return UI.toast(res.datos?.mensaje || 'Error al obtener métricas.', 'error');

        const { sprintsDisponibles, sprint } = res.datos;

        if (sprintsDisponibles && sprintsDisponibles.length > 0) {
            selectSprint.innerHTML = sprintsDisponibles
                .map((s) => `<option value="${s.id}">${UI.escapar(s.nombre)}</option>`)
                .join('');

            if (sprint) {
                selectSprint.value = sprint.id;
            } else {
                selectSprint.selectedIndex = 0;
            }
            await cargarMetricas(selectSprint.value);
        } else {
            selectSprint.innerHTML = '<option value="">Sin sprints</option>';
            contenedorSvg.innerHTML = '<span class="texto-suave">Sin sprints registrados.</span>';
            alertaDatos.hidden = false;
            tablaProgreso.innerHTML = '<tr><td colspan="3" class="texto-suave">No hay tareas.</td></tr>';
            if (tablaReportesEstado) {
                tablaReportesEstado.innerHTML = '<tr><td colspan="3">Selecciona un Sprint para generar su reporte.</td></tr>';
            }
        }
    }

    async function cargarHistorialSprintsPasados(idProyecto) {
        if (!idProyecto || !tablaSprintsHistorial) return;

        const res = await Api.get(`/api/metrics/proyectos/${encodeURIComponent(idProyecto)}/historial-sprints`);
        const listaSprints = res.sprints || res.datos?.sprints || [];
        
        if (listaSprints.length === 0) {
            tablaSprintsHistorial.innerHTML = `<tr><td colspan="4" class="texto-suave" style="text-align: center;">No hay Sprints finalizados registrados.</td></tr>`;
            return;
        }

        tablaSprintsHistorial.innerHTML = listaSprints.map(s => `
            <tr>
                <td><strong>${UI.escapar(s.nombre)}</strong></td>
                <td><span class="insignia insignia--activo">${UI.escapar(s.estado)}</span></td>
                <td>${UI.escapar(s.fechaCierre || 'N/A')}</td>
                <td>
                    <button class="btn btn--secundario" style="padding: 4px 8px; font-size: 0.8rem;" data-sprint-pdf="${UI.escapar(s.id)}" title="Descargar reporte">
                        PDF
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async function cargarMetricas(idSprint) {
        const idProyecto = selectProyecto.value;
        if (!idProyecto) return;

        const res = await Api.get(`/api/metrics/proyectos/${encodeURIComponent(idProyecto)}/sprints/${encodeURIComponent(idSprint)}`);
        if (!res.ok) return UI.toast(res.datos?.mensaje || 'Error al obtener métricas.', 'error');

        const { metricas, sprint } = res.datos;
        
        if (tablaReportesEstado && sprint) {
            tablaReportesEstado.innerHTML = `
                <tr>
                    <td>Reporte Ejecutivo (${UI.escapar(sprint.nombre)})</td>
                    <td><button class="btn btn--secundario" data-sprint-pdf="${UI.escapar(sprint.id)}">PDF / TXT</button></td>
                    <td>${UI.escapar(metricas.fechaConsulta)}</td>
                </tr>`;
        }

        alertaDatos.hidden = metricas.datosSuficientes;

        document.getElementById('talla-xs').textContent = metricas.conteoTallas.XS || 0;
        document.getElementById('talla-s').textContent = metricas.conteoTallas.S || 0;
        document.getElementById('talla-m').textContent = metricas.conteoTallas.M || 0;
        document.getElementById('talla-l').textContent = metricas.conteoTallas.L || 0;
        document.getElementById('talla-xl').textContent = metricas.conteoTallas.XL || 0;

        dibujarBurndownSVG(metricas);
        
        if (notasBurndown) {
            notasBurndown.textContent = metricas.advertencias?.[0] || '';
        }

        if (metricas.tareasEnProgreso && metricas.tareasEnProgreso.length > 0) {
            tablaProgreso.innerHTML = metricas.tareasEnProgreso.map((t) => `
                <tr>
                    <td>${UI.escapar(t.responsable)}</td>
                    <td>${UI.escapar(t.titulo)}</td>
                    <td><span class="insignia insignia--activo">${UI.escapar(t.estado)}</span></td>
                </tr>
            `).join('');
        } else {
            tablaProgreso.innerHTML = '<tr><td colspan="3" class="texto-suave">No hay tareas en progreso actualmente.</td></tr>';
        }

        Icons.hidratar();
    }

    function dibujarBurndownSVG(m) {
        if (!m.datosSuficientes) {
            contenedorSvg.innerHTML = '<span class="texto-suave">Sin datos suficientes para graficar.</span>';
            return;
        }

        const ancho = 450;
        const alto = 180;
        const padIzq = 40;
        const padDer = 25;
        const padArr = 20;
        const padAba = 30;

        const maxHoras = Math.max(1, ...m.serieIdeal, ...m.serieReal);
        const n = m.etiquetasDias.length;

        const cX = (i) => padIzq + (i * (ancho - padIzq - padDer)) / Math.max(1, n - 1);
        const cY = (v) => alto - padAba - (v * (alto - padArr - padAba)) / maxHoras;

        const puntosIdeal = m.serieIdeal.map((v, i) => `${cX(i)},${cY(v)}`).join(' ');
        const puntosReal = m.serieReal.map((v, i) => `${cX(i)},${cY(v)}`).join(' ');

        const paso = Math.max(1, Math.floor((n - 1) / 3));
        const indicesFechas = [0];
        for (let idx = paso; idx < n - 1; idx += paso) {
            indicesFechas.push(idx);
        }
        if (!indicesFechas.includes(n - 1)) indicesFechas.push(n - 1);

        contenedorSvg.innerHTML = `
        <svg viewBox="0 0 ${ancho} ${alto}" style="width: 100%; height: 100%; font-family: inherit;">
            <line x1="${padIzq}" y1="${alto - padAba}" x2="${ancho - padDer}" y2="${alto - padAba}" stroke="#cbd5e1" stroke-width="1.5"/>
            <line x1="${padIzq}" y1="${padArr}" x2="${padIzq}" y2="${alto - padAba}" stroke="#cbd5e1" stroke-width="1.5"/>

            <text x="${padIzq - 6}" y="${padArr + 4}" font-size="10" fill="#64748b" text-anchor="end">${maxHoras}h</text>
            <text x="${padIzq - 6}" y="${alto - padAba}" font-size="10" fill="#64748b" text-anchor="end">0h</text>

            ${indicesFechas.map(idx => `
            <text x="${cX(idx)}" y="${alto - padAba + 18}" font-size="10" fill="#475569" text-anchor="middle" font-weight="500">
                ${m.etiquetasDias[idx] || ''}
            </text>
            `).join('')}

            <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4" points="${puntosIdeal}"/>
            <polyline fill="none" stroke="#10b981" stroke-width="2.5" points="${puntosReal}"/>

            ${m.serieReal.map((v, i) => `
            <circle cx="${cX(i)}" cy="${cY(v)}" r="3.5" fill="#10b981">
                <title>${m.etiquetasDias[i]}: ${v}h pendientes</title>
            </circle>
            `).join('')}
        </svg>
        `;
    }

    selectProyecto.addEventListener('change', cambiarProyecto);
    selectSprint.addEventListener('change', () => cargarMetricas(selectSprint.value));

    async function descargarReporte(idSprint, formato = 'pdf', alcance = 'sprint') {
        const idProyecto = selectProyecto.value;
        if (!idProyecto || (alcance === 'sprint' && !idSprint)) return UI.toast('Selecciona un proyecto y un Sprint.', 'error');
        try {
            const base = `/api/metrics/proyectos/${encodeURIComponent(idProyecto)}`;
            const url = alcance === 'proyecto' ? `${base}/exportar?formato=${formato}` : `${base}/sprints/${encodeURIComponent(idSprint)}/exportar?formato=${formato}`;
            const respuesta = await fetch(url, { credentials: 'same-origin' });
            if (!respuesta.ok) {
                const error = await respuesta.json().catch(() => ({}));
                throw new Error(error.mensaje || 'No se pudo generar el reporte.');
            }
            const blob = await respuesta.blob();
            const enlace = document.createElement('a');
            const objeto = URL.createObjectURL(blob);
            enlace.href = objeto;
            enlace.download = `reporte-${idProyecto}-${alcance === 'proyecto' ? 'proyecto-completo' : idSprint}.${formato}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
            document.body.appendChild(enlace);
            enlace.click(); 
            enlace.remove();
            setTimeout(() => URL.revokeObjectURL(objeto), 10000);
        } catch (e) { 
            UI.toast(e.message || 'Error al descargar el reporte.', 'error'); 
        }
    }

    document.getElementById('btn-descargar-pdf-completo')?.addEventListener('click', () => descargarReporte(null, formatoReporte?.value || 'pdf', 'proyecto'));
    document.getElementById('btn-exportar')?.addEventListener('click', () => descargarReporte(selectSprint.value, formatoReporte?.value || 'pdf', 'sprint'));

    document.addEventListener('click', e => {
        const boton = e.target.closest('[data-sprint-pdf]');
        if (boton) descargarReporte(boton.dataset.sprintPdf, formatoReporte?.value || 'pdf', 'sprint');
    });

    await inicializar();
})();