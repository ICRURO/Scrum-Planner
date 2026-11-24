const PDFDocument = require('pdfkit');

function enviarPDF(res, datos, secciones = null) {
  const { proyecto, sprint, burndown, metricas } = datos;
  const alcance = sprint?.nombre || 'General del proyecto';
  const titulo = secciones ? `Reporte completo · ${proyecto.nombre}` : `Burndown · ${proyecto.nombre} · ${alcance}`;
  const nombre = `${secciones ? 'reporte' : 'burndown'}-${proyecto.id}-${sprint?.id || 'general'}.pdf`.replace(/[^\w.-]/g, '_');
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: titulo } });
  doc.on('error', error => res.destroy(error));
  res.attachment(nombre).type('application/pdf');
  doc.pipe(res);

  doc.fontSize(18).text(titulo).moveDown(0.5);
  doc.fontSize(10).text(`Consulta: ${metricas.fechaConsulta} · Horas reales registradas: ${burndown.horas.invertidas} h`).moveDown();
  dibujarSerie(doc, 'Burndown por puntos de historia', burndown.puntos, burndown.etiquetasDias);
  dibujarSerie(doc, 'Burndown por horas', burndown.horas, burndown.etiquetasDias);
  doc.fontSize(9).fillColor('#334155');
  for (const aviso of burndown.advertencias) doc.text(aviso);
  if (secciones) {
    for (const [tituloSeccion, filas] of secciones) {
      if (doc.y + 55 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.moveDown().fontSize(13).text(tituloSeccion);
      doc.fontSize(10);
      for (const fila of filas.length ? filas : ['Sin registros']) doc.text(fila);
    }
  }
  doc.end();
}

function dibujarSerie(doc, titulo, serie, etiquetas) {
  if (doc.y + 165 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.fontSize(13).text(titulo);
  if (!serie.disponible || !etiquetas.length) {
    doc.fontSize(10).text('Sin estimaciones o fechas suficientes.').moveDown();
    return;
  }
  doc.fontSize(9).fillColor('#334155').text('Ideal (gris) · Real (verde)');
  const izquierda = doc.page.margins.left + 33;
  const arriba = doc.y + 10;
  const ancho = doc.page.width - doc.page.margins.right - izquierda;
  const alto = 85;
  const x = i => izquierda + i * ancho / (etiquetas.length - 1);
  const y = v => arriba + alto * (1 - v / Math.max(1, serie.total));
  doc.moveTo(izquierda, arriba).lineTo(izquierda, arriba + alto)
    .lineTo(izquierda + ancho, arriba + alto).stroke('#cbd5e1');
  for (const [valores, color] of [[serie.serieIdeal, '#64748b'], [serie.serieReal, '#047857']]) {
    valores.forEach((v, i) => i === 0 ? doc.moveTo(x(i), y(v)) : doc.lineTo(x(i), y(v)));
    if (valores.length > 1) doc.stroke(color);
    if (valores.length === 1) doc.circle(x(0), y(valores[0]), 2).fill(color);
  }
  doc.fillColor('#334155').text(String(Math.max(1, serie.total)), izquierda - 31, arriba, { width: 28, align: 'right' });
  doc.text('0', izquierda - 31, arriba + alto - 8, { width: 28, align: 'right' });
  doc.text(etiquetas[0], izquierda, arriba + alto + 5, { lineBreak: false });
  const indices = [...new Set([Math.floor((etiquetas.length - 1) / 3),
    Math.floor((etiquetas.length - 1) * 2 / 3), etiquetas.length - 1])].filter(i => i > 0);
  indices.forEach(i => doc.text(etiquetas[i], Math.min(x(i) - 28, izquierda + ancho - 56),
    arriba + alto + 5, { width: 56, align: 'center' }));
  doc.x = doc.page.margins.left;
  doc.y = arriba + alto + 24;
}

module.exports = { enviarPDF };