/* Fechas civiles de México; no se inventan cierres ni estimaciones faltantes. */
const ZONA = 'America/Mexico_City';
const normalizar = (v) => String(v || '').trim().toLowerCase().replaceAll('_', ' ');
const terminada = (v) => ['terminado', 'finalizado', 'completado', 'terminada', 'completada'].includes(normalizar(v));
function dia(valor) {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const d = new Date(valor + 'T00:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === valor ? valor : null;
  }
  const d = new Date(valor);
  if (!Number.isFinite(+d)) return null;
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  return ['year', 'month', 'day'].map(k => partes.find(p => p.type === k).value).join('-');
}
function horas(t) {
  if (t.horasEstimadas === null || t.horasEstimadas === undefined || String(t.horasEstimadas).trim() === '') return null;
  const n = Number(t.horasEstimadas);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const redondear = n => Math.round((n + Number.EPSILON) * 100) / 100;
function obtenerDatos(db, proyecto, sprint, ahora = new Date()) {
  const historias = (db.historiasUsuario || []).filter(h => h.idProyecto === proyecto.id && sprint &&
    (h.idSprint === sprint.id || (sprint.historiasAsignadas || []).includes(h.id)));
  // La colección raíz es la fuente de tareas que mantiene projects.routes.js.
  const tareas = sprint ? (db.tareas || []).filter(t => t.idSprint === sprint.id) : [];
  const responsable = t => {
    const id = t.idResponsable || t.idUsuarioResponsable || t.idUsuario;
    const u = (db.usuarios || []).find(u => u.id === id);
    return u ? [u.nombre, u.apellidos].filter(Boolean).join(' ') : 'Sin asignar';
  };
  const conteoTallas = { XS: 0, S: 0, M: 0, L: 0, XL: 0, sinEstimar: 0 };
  historias.forEach(h => { conteoTallas[Object.hasOwn(conteoTallas, h.estimacion) ? h.estimacion : 'sinEstimar']++; });
  const inicio = dia(sprint?.fechaInicio), fin = dia(sprint?.fechaFin), hoy = dia(ahora);
  const duracion = inicio && fin ? Math.round((Date.parse(fin) - Date.parse(inicio)) / 86400000) : -1;
  const totalHoras = redondear(tareas.reduce((s, t) => s + (horas(t) ?? 0), 0));
  const advertencias = [];
  const sinEstimacion = tareas.filter(t => horas(t) === null);
  if (sinEstimacion.length) advertencias.push(`${sinEstimacion.length} tarea(s) sin estimación válida; no se les asignaron horas ficticias.`);
  const eventos = new Map(tareas.map(t => [t.id, (db.historial || []).filter(h => h.entidad === 'tarea' && h.idEntidad === t.id && h.campo === 'estado' && dia(h.fecha))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))]));
  function completadaEn(t, corte) {
    const cambios = eventos.get(t.id);
    if (cambios.length) {
      const anteriores = cambios.filter(e => dia(e.fecha) <= corte);
      const estado = anteriores.length ? anteriores.at(-1).valorNuevo : cambios[0].valorAnterior;
      return terminada(typeof estado === 'object' ? estado?.estado : estado);
    }
    return terminada(t.estado) && dia(t.fechaTerminado) !== null && dia(t.fechaTerminado) <= corte;
  }
  const sinFecha = tareas.filter(t => terminada(t.estado) && !dia(t.fechaTerminado) && !eventos.get(t.id).length);
  if (sinFecha.length) advertencias.push(`${sinFecha.length} tarea(s) terminada(s) sin fecha ni historial: no es posible ubicar su reducción en la curva.`);
  const tardias = tareas.filter(t => terminada(t.estado) && fin && dia(t.fechaTerminado) > fin);
  if (tardias.length) advertencias.push(`${tardias.length} tarea(s) con cierre posterior al fin del Sprint; no se descuentan antes de su fecha.`);
  advertencias.push('Curva reconstruida con las tareas y estimaciones actuales, fechas de término e historial de estados disponible. No hay una línea base histórica de cambios de alcance o estimación.');
  const datosSuficientes = Boolean(sprint) && tareas.length > 0 && duracion >= 0 && duracion <= 3660 && totalHoras > 0;
  const fechas = [], etiquetasDias = [], serieIdeal = [], serieReal = [];
  if (datosSuficientes) {
    // Inicio = línea base. Para un Sprint de un día se agregan inicio y cierre.
    const pasos = Math.max(1, duracion);
    for (let i = 0; i <= pasos; i++) {
      const fecha = new Date(Date.parse(inicio) + (duracion === 0 ? 0 : i) * 86400000).toISOString().slice(0, 10);
      fechas.push(fecha);
      etiquetasDias.push(duracion === 0 ? (i === 0 ? 'Inicio' : 'Cierre') : new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-MX', { timeZone: 'UTC', day: '2-digit', month: 'short' }));
      serieIdeal.push(redondear(totalHoras * (1 - i / pasos)));
      if (fecha <= hoy) {
        // El primer punto es previo al trabajo del primer día.
        const corte = i === 0 ? new Date(Date.parse(inicio) - 86400000).toISOString().slice(0, 10) : fecha;
        const completas = tareas.reduce((s, t) => s + (completadaEn(t, corte) ? (horas(t) ?? 0) : 0), 0);
        serieReal.push(redondear(Math.max(0, totalHoras - completas)));
      }
    }
  } else if (sprint) advertencias.push('Sin curva: se requieren fechas válidas y horas estimadas positivas (periodo máximo: 10 años).');
  return { ...datosComplementarios(db, proyecto, sprint), proyecto: { ...proyecto }, sprint: sprint || null, historias,
    tareas: tareas.map(t => ({ ...t, responsable: responsable(t), horasReporte: horas(t) })),
    metricas: { datosSuficientes, totalHoras, totalDias: Math.max(0, duracion), fechas, etiquetasDias, serieIdeal, serieReal, conteoTallas,
      fechaConsulta: hoy, fechaCorte: fin && hoy > fin ? fin : hoy, advertencias,
      totalTareas: tareas.length, terminadasActuales: tareas.filter(t => terminada(t.estado)).length,
      horasPendientesActuales: redondear(tareas.reduce((s, t) => s + (terminada(t.estado) ? 0 : (horas(t) ?? 0)), 0)),
      tareasEnProgreso: tareas.filter(t => ['en progreso', 'en revisión', 'en revision'].includes(normalizar(t.estado))).map(t => ({ id: t.id, titulo: t.titulo || t.descripcion || 'Sin título', responsable: responsable(t), estado: t.estado })) } };
}
function datosComplementarios(db, proyecto, sprint) {
  const nombre = id => {
    const u = (db.usuarios || []).find(u => u.id === id);
    return u ? [u.nombre, u.apellidos].filter(Boolean).join(' ') : 'Sin asignar';
  };
  const propios = lista => (lista || []).filter(x => x.idProyecto === proyecto.id);
  return { esPrueba: Boolean(proyecto.datosPrueba),
    equipo: propios(db.participantes).map(p => ({ ...p, nombre: nombre(p.idUsuario) })),
    dods: propios(db.dods),
    impedimentos: propios(db.impedimentos).map(i => ({ ...i, responsable: nombre(i.idResponsable) })),
    riesgos: propios(db.riesgos).map(r => ({ ...r, responsable: nombre(r.idResponsable) })),
    reuniones: propios(db.reuniones).filter(r => !sprint || r.idSprint === sprint.id).map(r => ({ ...r,
      acuerdos: (r.acuerdos || []).map(a => ({ ...a, responsable: nombre(a.idResponsable) })) })) };
}
function resumenProyecto(db, proyecto) {
  const sprints = (db.sprints || []).filter(s => s.idProyecto === proyecto.id);
  const historias = (db.historiasUsuario || []).filter(h => h.idProyecto === proyecto.id);
  const idsS = new Set(sprints.map(s => s.id)), idsH = new Set(historias.map(h => h.id));
  const tareas = (db.tareas || []).filter(t => idsS.has(t.idSprint) || idsH.has(t.idHistoria));
  const terminadas = tareas.filter(t => terminada(t.estado)).length;
  const sprintsFinalizados = sprints.filter(s => terminada(s.estado)).length;
  const listoParaCerrar = tareas.length > 0 && historias.length > 0 && sprints.length > 0 && tareas.length === terminadas && sprintsFinalizados === sprints.length;
  return { estado: proyecto.estado, fechaCierre: proyecto.fechaCierre || null, totalSprints: sprints.length,
    sprintsFinalizados, totalHistorias: historias.length, totalTareas: tareas.length, tareasTerminadas: terminadas,
    porcentajeTareas: tareas.length ? redondear(terminadas * 100 / tareas.length) : 0,
    totalHoras: redondear(tareas.reduce((n, t) => n + (horas(t) ?? 0), 0)),
    listoParaCerrar, cierreCoherente: normalizar(proyecto.estado) === 'finalizado' && listoParaCerrar };
}
function obtenerReporteProyecto(db, proyecto, ahora = new Date()) {
  const sprints = (db.sprints || []).filter(s => s.idProyecto === proyecto.id).sort((a,b) => String(a.fechaInicio).localeCompare(String(b.fechaInicio)));
  const informes = sprints.map(s => obtenerDatos(db, proyecto, s, ahora));
  const historias = (db.historiasUsuario || []).filter(h => h.idProyecto === proyecto.id);
  const idsS = new Set(sprints.map(s => s.id)), idsH = new Set(historias.map(h => h.id));
  const equipo = datosComplementarios(db, proyecto);
  const nombre = id => { const u = (db.usuarios || []).find(u => u.id === id); return u ? [u.nombre, u.apellidos].filter(Boolean).join(' ') : 'Sin asignar'; };
  const tareas = (db.tareas || []).filter(t => idsS.has(t.idSprint) || idsH.has(t.idHistoria)).map(t => ({ ...t,
    horasReporte: horas(t), responsable: nombre(t.idResponsable || t.idUsuarioResponsable || t.idUsuario) }));
  const resumen = resumenProyecto(db, proyecto), conteoTallas = { XS:0, S:0, M:0, L:0, XL:0, sinEstimar:0 };
  historias.forEach(h => conteoTallas[Object.hasOwn(conteoTallas, h.estimacion) ? h.estimacion : 'sinEstimar']++);
  const advertencias = [...new Set(informes.flatMap(i => i.metricas.advertencias))];
  if (normalizar(proyecto.estado) === 'finalizado' && !resumen.cierreCoherente) advertencias.unshift('El proyecto está marcado finalizado, pero tiene tareas o Sprints pendientes, o carece de datos para comprobar su cierre.');
  return { ...equipo, alcance: 'proyecto', proyecto: { ...proyecto }, sprint: null, historias, tareas,
    informesSprints: informes, resumenProyecto: resumen,
    metricas: { datosSuficientes: false, totalHoras: resumen.totalHoras, totalTareas: tareas.length,
      terminadasActuales: resumen.tareasTerminadas, horasPendientesActuales: redondear(tareas.reduce((n,t) => n + (terminada(t.estado) ? 0 : (horas(t) ?? 0)), 0)),
      conteoTallas, fechaConsulta: dia(ahora), advertencias, serieReal: [], serieIdeal: [], fechas: [], etiquetasDias: [] } };
}
module.exports = { obtenerDatos, obtenerReporteProyecto, resumenProyecto, dia, horas, normalizar };
