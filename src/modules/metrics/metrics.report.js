const PDFDocument = require('pdfkit');
const mostrar = v => v === null || v === undefined || v === '' ? 'Sin registrar' : String(v);
function secciones(d) {
  const m = d.metricas, esProyecto = d.alcance === 'proyecto';
  const secciones = [
    ['Identificación', [
      ...(d.esPrueba ? ['DATOS SIMULADOS: escenario de prueba del proyecto 1; no acredita una entrega real.'] : []),
      `Proyecto: ${d.proyecto.id} - ${d.proyecto.nombre}`,
      `Estado del proyecto: ${mostrar(d.proyecto.estado)} | Cierre registrado: ${mostrar(d.proyecto.fechaCierre)}`,
      `Objetivo del proyecto: ${mostrar(d.proyecto.objetivo)}`,
      ...(esProyecto ? [`Alcance: proyecto completo | Periodo programado: ${mostrar(d.proyecto.fechaInicio)} a ${mostrar(d.proyecto.fechaFin)}`] : [
        `Sprint: ${d.sprint.id} - ${d.sprint.nombre}`, `Objetivo: ${mostrar(d.sprint.objetivo)}`,
        `Periodo: ${mostrar(d.sprint.fechaInicio)} a ${mostrar(d.sprint.fechaFin)} | Cierre: ${mostrar(d.sprint.fechaCierre)}`,
        `Estado del Sprint: ${mostrar(d.sprint.estado)}`]),
      `Fecha de consulta (México): ${m.fechaConsulta}`]],
    ['Resumen de resultados', [
      `Tareas: ${m.totalTareas} | Terminadas: ${m.terminadasActuales} | Avance por tareas: ${m.totalTareas ? Math.round(m.terminadasActuales * 10000 / m.totalTareas) / 100 : 0}%`,
      `Horas estimadas registradas: ${m.totalHoras} h | Estimación pendiente actual: ${m.horasPendientesActuales} h`,
      'Las horas son estimaciones; no representan horas efectivamente trabajadas.',
      ...(esProyecto ? [
        `Sprints finalizados: ${d.resumenProyecto.sprintsFinalizados} de ${d.resumenProyecto.totalSprints}`,
        `Cierre coherente con tareas y Sprints: ${d.resumenProyecto.cierreCoherente ? 'Sí' : 'No comprobado'}`
      ] : [`Pendiente al último corte del burndown: ${m.serieReal.length ? m.serieReal.at(-1) + ' h' : 'Sin datos'}.`])]],
    ['Historias por talla de estimación', [
      `XS: ${m.conteoTallas.XS} | S: ${m.conteoTallas.S} | M: ${m.conteoTallas.M} | L: ${m.conteoTallas.L} | XL: ${m.conteoTallas.XL} | Sin estimar: ${m.conteoTallas.sinEstimar}`,
      'Se cuentan historias; las tallas no se suman ni se convierten a horas.']],
    ['Equipo del proyecto', (d.equipo || []).map(p => `${p.nombre} | ${p.rol}`)],
    ['Definition of Done', (d.dods || []).map(x => `${x.id} | ${x.tipo}: ${x.descripcion}`)],
    ['Confirmaciones DoD de las tareas', d.tareas.map(t => `${t.id}: ${(t.dodsConfirmados || []).join(', ') || 'Sin confirmación almacenada'}`)],
    ['Observaciones de los datos', m.advertencias],
  ];
  if (esProyecto) secciones.push(['Resumen por Sprint', d.informesSprints.map(i =>
    `${i.sprint.nombre} | ${i.sprint.fechaInicio} a ${i.sprint.fechaFin} | ${i.sprint.estado} | ${i.metricas.totalHoras} h estimadas | ${i.metricas.terminadasActuales}/${i.metricas.totalTareas} tareas terminadas | Pendiente al corte: ${i.metricas.serieReal.at(-1) ?? 'Sin datos'} h`)]);
  secciones.push(
    ['Historias y criterios de aceptación', d.historias.flatMap(h => [
      `${h.id} - ${mostrar(h.titulo)} | Sprint: ${mostrar(h.idSprint)} | Talla: ${mostrar(h.estimacion)} | Estado: ${mostrar(h.estado)}`,
      mostrar(h.descripcion),
      ...(h.criterios || []).map(c => `${c.id}: Dado ${mostrar(c.dado)}; cuando ${mostrar(c.cuando)}; entonces ${mostrar(c.entonces)}. Cumplimiento registrado: ${c.cumplido === true ? 'Sí' : 'Sin confirmar'}.`)
    ])],
    ['Detalle de tareas', d.tareas.flatMap(t => [
      `${t.id} - ${mostrar(t.titulo)} (Historia: ${mostrar(t.idHistoria)} | Sprint: ${mostrar(t.idSprint)})`,
      `Responsable: ${t.responsable} | Estado: ${mostrar(t.estado)}`,
      `Estimación: ${t.horasReporte === null ? 'Sin estimar' : t.horasReporte + ' h'} | Fecha de término: ${mostrar(t.fechaTerminado)}`
    ])],
    ['Impedimentos del proyecto', (d.impedimentos || []).flatMap(i => [
      `${i.id}: ${i.descripcion} | Estado: ${i.estado} | Responsable: ${i.responsable}`,
      ...(i.acciones || []).map(a => `Acción: ${a.descripcion} | ${mostrar(a.fecha)}`)
    ])],
    ['Riesgos del proyecto', (d.riesgos || []).map(r => `${r.id}: ${r.descripcion} | Probabilidad: ${r.probabilidad} | Estado: ${r.estado} | Responsable: ${r.responsable} | Respuesta: ${mostrar(r.accionesRespuesta)} | Revisión: ${mostrar(r.fechaRevision)}`)],
    ['Reviews, retrospectivas y acuerdos', (d.reuniones || []).flatMap(r => [
      `${r.tipo} | ${r.idSprint} | ${r.fecha}: ${mostrar(r.observaciones)}`,
      ...(r.acuerdos || []).map(a => `Acuerdo: ${a.descripcion} | ${a.responsable} | ${a.estado} | Compromiso: ${mostrar(a.fechaCompromiso)}`)
    ])]
  );
  for (const informe of esProyecto ? d.informesSprints : [d]) {
    const m = informe.metricas;
    secciones.push([`Burndown diario: ${informe.sprint.nombre}`, m.datosSuficientes ? [
      'Primer punto: línea base previa al trabajo del día de inicio. Los siguientes puntos son cortes diarios. Días naturales.',
      'Fecha / punto | Ideal (h) | Pendiente (h)',
      ...m.fechas.map((f, i) => `${f}${i === 0 ? ' (inicio)' : ''} | ${m.serieIdeal[i]} | ${i < m.serieReal.length ? m.serieReal[i] : 'Sin observación (futuro)'}`)
    ] : ['Sin datos suficientes para calcular el burndown.']]);
  }
  return secciones.map(([titulo,lineas]) => [titulo,lineas.length ? lineas : ['Sin registros.']]);
}
function crearTexto(datos) {
  return 'SCRUM MANAGER - REPORTE DE SEGUIMIENTO\n\n' + secciones(datos).map(([titulo, lineas]) => titulo.toUpperCase() + '\n' + lineas.join('\n')).join('\n\n') + '\n';
}
function crearPDF(datos) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `Reporte ${datos.sprint?.nombre || datos.proyecto.nombre}`, Author: 'Scrum Manager' } });
  const ancho = doc.page.width - 96;
  doc.font('Helvetica-Bold').fontSize(21).fillColor('#194d40').text('SCRUM MANAGER');
  doc.font('Helvetica').fontSize(13).fillColor('#334155').text(datos.alcance === 'proyecto' ? 'Reporte completo del proyecto' : 'Reporte de seguimiento del Sprint');
  doc.moveDown();
  for (const [titulo, lineas] of secciones(datos)) {
    if (doc.y > doc.page.height - 130) doc.addPage();
    doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).fillColor('#194d40').text(titulo, { width: ancho });
    doc.moveDown(0.4).font('Helvetica').fontSize(10).fillColor('#243343');
    for (const [indice, linea] of lineas.entries()) {
      if (titulo === 'Detalle de tareas' && indice % 3 === 0 && doc.y > doc.page.height - 150) doc.addPage();
      const alto = doc.heightOfString(String(linea), { width: ancho, lineGap: 3 });
      if (doc.y + alto > doc.page.height - 64 && alto < doc.page.height - 112) doc.addPage();
      doc.text(String(linea), { width: ancho, lineGap: 3 });
      doc.moveDown(0.3);
    }
  }
  for (const informe of datos.alcance === 'proyecto' ? datos.informesSprints : [datos]) {
  const m = informe.metricas;
  if (!m.datosSuficientes) continue;
  {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#194d40').text(`Burndown: ${informe.sprint.nombre}`);
    doc.moveDown().font('Helvetica').fontSize(10).fillColor('#334155').text('Ideal: gris. Pendiente observado: verde. Unidad: horas estimadas.');
    const x = 80, y = doc.y + 28, w = 430, h = 210;
    const max = Math.max(1, ...m.serieIdeal, ...m.serieReal);
    const cx = i => x + i * w / Math.max(1, m.fechas.length - 1);
    const cy = v => y + h - v * h / max;
    doc.lineWidth(0.6).strokeColor('#cbd5e1');
    for (let k = 0; k <= 4; k++) {
      const v = max * k / 4;
      doc.moveTo(x, cy(v)).lineTo(x + w, cy(v)).stroke();
      doc.fontSize(9).fillColor('#475569').text(`${Math.round(v * 10) / 10}`, 40, cy(v) - 4, { width: 33, align: 'right' });
    }
    function curva(serie, color, punteada) {
      if (!serie.length) return;
      doc.strokeColor(color).lineWidth(1.8);
      if (punteada) doc.dash(4, { space: 3 }); else doc.undash();
      doc.moveTo(cx(0), cy(serie[0]));
      serie.slice(1).forEach((v, i) => doc.lineTo(cx(i + 1), cy(v)));
      doc.stroke().undash();
    }
    curva(m.serieIdeal, '#94a3b8', true); curva(m.serieReal, '#059669', false);
    m.serieReal.forEach((v, i) => doc.circle(cx(i), cy(v), 2).fill('#059669'));
    const indices = [...new Set([0, Math.floor((m.fechas.length - 1) / 2), m.fechas.length - 1])];
    indices.forEach(i => doc.fontSize(8).fillColor('#475569').text(m.fechas[i], cx(i) - 35, y + h + 12, { width: 70, align: 'center' }));
    doc.fontSize(10).fillColor('#334155').text('La curva permanece horizontal mientras no se registra una tarea terminada. Los cambios de estado disponibles en el historial permiten reflejar reaperturas. No se proyectan valores reales a futuro.', 48, y + h + 52, { width: ancho });
  }
  }
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(i);
    // El pie queda dentro del margen inferior para evitar páginas adicionales.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`Scrum Manager | ${datos.metricas.fechaConsulta} | Página ${i + 1} de ${paginas.count}`, 48, doc.page.height - 45, { width: ancho, lineBreak: false });
    doc.page.margins.bottom = margenInferior;
  }
  return doc;
}
module.exports = { crearPDF, crearTexto };
