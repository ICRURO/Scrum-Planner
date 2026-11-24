/* Cálculo de métricas a partir del alcance actual, fechas y registros reales. */
const DAY = 86400000;
const redondear = n => Math.round(n * 100) / 100;
function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dia(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const n = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === s ? n : null;
}
const iso = n => new Date(n).toISOString().slice(0,10);
const terminado = s => ['terminado','finalizado','completada','completado'].includes(String(s || '').toLowerCase());
const positivo = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
function tareasHistoria(db, h) {
  const mapa = new Map((h.tareas || []).map(t => [t.id,t]));
  for (const t of db.tareas || []) if (t.idHistoria === h.id) mapa.set(t.id,{...mapa.get(t.id),...t});
  return [...mapa.values()].filter(t => t.id);
}
function estadoEnFecha(db,t,fecha,historia,hoy) {
  const eventos = (db.historial || []).filter(e => e.entidad === 'tarea' && e.idEntidad === t.id && e.campo === 'estado' && e.fecha && (!e.valorNuevo?.idHistoria || e.valorNuevo.idHistoria === historia.id))
    .map(e => ({fecha:fechaLocal(new Date(e.fecha)),orden:e.fecha,antes:typeof e.valorAnterior === 'object' ? e.valorAnterior?.estado : e.valorAnterior,despues:typeof e.valorNuevo === 'object' ? e.valorNuevo?.estado : e.valorNuevo}))
    .filter(e => dia(e.fecha)!==null && e.despues).sort((a,b)=>a.orden.localeCompare(b.orden));
  if (eventos.length) {
    const prev = eventos.filter(e=>e.fecha <= fecha).at(-1);
    // En el último día disponible, el estado actual manda si no coincide con el historial.
    if (fecha >= hoy) return terminado(t.estado);
    if (prev) return terminado(prev.despues);
    // No inventar fecha de terminación anterior al primer evento conocido.
    return terminado(eventos[0].antes) && dia(t.fechaTerminado)!==null && t.fechaTerminado<=fecha;
  }
  return terminado(t.estado) && dia(t.fechaTerminado)!==null && t.fechaTerminado<=fecha;
}
function alcance(db, proyecto, sprint) {
  return (db.historiasUsuario || []).filter(h => h.idProyecto === proyecto.id && (!sprint || h.idSprint === sprint.id || (sprint.historiasAsignadas || []).includes(h.id)));
}
function calcular(db, proyecto, sprint = null, hoy = fechaLocal()) {
  const historias = alcance(db, proyecto, sprint);
  const datos = historias.map(h => ({h,tareas:tareasHistoria(db,h)}));
  const puntos = historias.filter(h=>positivo(h.puntosHistoria));
  const horas = historias.filter(h=>positivo(h.horasEstimadas) && h.horasEstimadas>0);
  const totalPuntos = puntos.reduce((n,h)=>n+h.puntosHistoria,0);
  const totalHoras = horas.reduce((n,h)=>n+h.horasEstimadas,0);
  const registros = (db.registrosHoras || []).filter(r=>r.idProyecto === proyecto.id && (!sprint || r.idSprint===sprint.id) && dia(r.fecha)!==null && r.fecha<=hoy && positivo(r.horas) && r.horas>0);
  const inicio = dia(sprint?.fechaInicio || proyecto.fechaInicio), fin = dia(sprint?.fechaFin || proyecto.fechaFin), ahora = dia(hoy);
  const advertencias = [];
  if (puntos.length < historias.length) advertencias.push(`${historias.length-puntos.length} historia(s) sin puntos de Planning Poker; no se cuentan como cero.`);
  if (horas.length < historias.length) advertencias.push(`${historias.length-horas.length} historia(s) sin horas estimadas de Planning Poker.`);
  if (datos.some(x=>positivo(x.h.puntosHistoria)&&!x.tareas.length)) advertencias.push('Las historias sin tareas no se consideran terminadas.');
  if (!registros.length) advertencias.push('No hay horas reales registradas en este alcance.');
  const invertidas = redondear(registros.reduce((n,r)=>n+r.horas,0));
  const resultado = {etiquetasDias:[],puntos:{total:totalPuntos,pendientes:null,serieIdeal:[],serieReal:[],disponible:false},horas:{total:totalHoras,invertidas,pendientes:null,exceso:Math.max(0,redondear(invertidas-totalHoras)),serieIdeal:[],serieReal:[],disponible:false},advertencias};
  if (inicio===null || fin===null || ahora===null || fin<inicio || (fin-inicio)/DAY>3660) { advertencias.push('Fechas del alcance inválidas o demasiado extensas.'); return resultado; }
  const cierre = dia(sprint?.fechaCierre || (sprint ? null : proyecto.fechaCierre));
  const eventosTardios = datos.flatMap(x=>x.tareas.map(t=>dia(t.fechaTerminado))).filter(n=>n!==null && n<=ahora);
  const idsTareas = new Set(datos.flatMap(x=>x.tareas.map(t=>t.id)));
  for (const e of db.historial||[]) if(e.entidad==='tarea' && e.campo==='estado' && idsTareas.has(e.idEntidad) && e.fecha){const n=dia(fechaLocal(new Date(e.fecha)));if(n!==null&&n<=ahora)eventosTardios.push(n);}
  const ultimoRegistro = Math.max(inicio,...registros.map(r=>dia(r.fecha)));
  const ultimoReal = Math.min(ahora,Math.max(fin,cierre??fin,ultimoRegistro,...eventosTardios));
  const ultimo = Math.max(fin,ultimoReal);
  if ((ultimo-inicio)/DAY>3660) { advertencias.push('El rango de fechas supera diez años.'); return resultado; }
  resultado.puntos.disponible = puntos.length>0;
  resultado.horas.disponible = horas.length>0;
  // Día inicial de referencia antes del trabajo; después, cierres diarios.
  resultado.etiquetasDias.push('Inicio');
  resultado.puntos.serieIdeal.push(totalPuntos); resultado.horas.serieIdeal.push(totalHoras);
  if (ahora>=inicio) {resultado.puntos.serieReal.push(totalPuntos);resultado.horas.serieReal.push(totalHoras);}
  const dias = Math.round((fin-inicio)/DAY)+1;
  for(let n=inicio,i=1;n<=ultimo;n+=DAY,i++) {
    const fecha=iso(n); resultado.etiquetasDias.push(fecha);
    resultado.puntos.serieIdeal.push(redondear(totalPuntos*Math.max(0,1-i/dias)));
    resultado.horas.serieIdeal.push(redondear(totalHoras*Math.max(0,1-i/dias)));
    if(n<=ultimoReal && n<=ahora) {
      const completados=datos.reduce((sum,x)=>sum+(positivo(x.h.puntosHistoria)&&x.tareas.length&&x.tareas.every(t=>estadoEnFecha(db,t,fecha,x.h,hoy))?x.h.puntosHistoria:0),0);
      const trabajadas=registros.filter(r=>r.fecha<=fecha).reduce((sum,r)=>sum+r.horas,0);
      resultado.puntos.serieReal.push(redondear(Math.max(0,totalPuntos-completados)));
      resultado.horas.serieReal.push(redondear(Math.max(0,totalHoras-trabajadas)));
    }
  }
  if(ahora>=inicio) {
    resultado.puntos.pendientes=resultado.puntos.serieReal.at(-1)??null;
    resultado.horas.pendientes=resultado.horas.serieReal.at(-1)??null;
  }
  if(registros.some(r=>dia(r.fecha)<inicio)) advertencias.push('Hay registros anteriores al inicio; se descuentan en el primer corte.');
  advertencias.push('Series reconstruidas con el alcance y las estimaciones actuales; no son una línea base histórica inmutable.');
  return resultado;
}
module.exports={calcular,alcance,tareasHistoria,fechaLocal,dia};
