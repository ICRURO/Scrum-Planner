/* Gráficas SVG sin dependencias externas. */
const BurndownUI = {
  idProyecto:null, idSprint:null,
  dibujar(id,serie,fechas,unidad){
    const el=document.getElementById(id);
    if(!serie?.disponible||!fechas?.length){el.textContent='Sin estimaciones suficientes de Planning Poker.';return;}
    const W=540,H=250,L=54,R=26,T=18,B=42;
    const max=Math.max(1,...serie.serieIdeal,...serie.serieReal);
    const x=i=>L+i*(W-L-R)/Math.max(1,fechas.length-1);
    const y=v=>H-B-v*(H-T-B)/max;
    const esc=s=>UI.escapar(String(s));
    const linea=values=>values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
    const indices=[...new Set([0,Math.floor((fechas.length-1)/3),Math.floor((fechas.length-1)*2/3),fechas.length-1])];
    const etiqueta=d=>d==='Inicio'?d:d.slice(8,10)+'/'+d.slice(5,7);
    const ticks=Array.from({length:5},(_,i)=>max*i/4);
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Burndown ${esc(unidad)}: ideal y real" style="width:100%;height:auto;display:block">
    ${ticks.map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#475569">${Number(v.toFixed(2))}</text>`).join('')}
    <text x="${L}" y="12" font-size="11" fill="#475569">${esc(unidad)} pendientes</text>
    ${indices.map(i=>`<text x="${x(i)}" y="${H-B+20}" text-anchor="middle" font-size="11" fill="#475569">${esc(etiqueta(fechas[i]))}</text>`).join('')}
    <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4" points="${linea(serie.serieIdeal)}"/>
    <polyline fill="none" stroke="#19854e" stroke-width="3" points="${linea(serie.serieReal)}"/>
    ${serie.serieReal.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="${fechas.length>60?1.5:3.3}" fill="#19854e"><title>${esc(fechas[i])}: ${v} ${esc(unidad)} pendientes</title></circle>`).join('')}
    </svg>`;
  },
  pintar(b,idProyecto,idSprint){
    this.idProyecto=idProyecto;this.idSprint=idSprint;
    if(!b){this.limpiar();return;}
    this.dibujar('grafico-burndown',b.horas,b.etiquetasDias,'h');
    this.dibujar('grafico-burndown-puntos',b.puntos,b.etiquetasDias,'pts');
    const mostrar=(v,disp)=>disp&&v!=null?v:'—';
    document.getElementById('burndown-resumen-puntos').textContent=`${mostrar(b.puntos.pendientes,b.puntos.disponible)} / ${mostrar(b.puntos.total,b.puntos.disponible)} pts pendientes`;
    document.getElementById('burndown-resumen-horas').textContent=`${mostrar(b.horas.pendientes,b.horas.disponible)} / ${mostrar(b.horas.total,b.horas.disponible)} h del presupuesto · ${b.horas.invertidas} h registradas`+(b.horas.disponible&&b.horas.exceso?` · Exceso: ${b.horas.exceso} h`:'');
    document.getElementById('notas-doble-burndown').textContent=b.advertencias.join(' ');
    document.getElementById('btn-burndown-txt').disabled=false;
  },
  limpiar(){
    this.idProyecto=null;this.idSprint=null;
    for(const id of ['grafico-burndown','grafico-burndown-puntos'])document.getElementById(id).textContent='Selecciona un proyecto o sprint.';
    for(const id of ['burndown-resumen-puntos','burndown-resumen-horas','notas-doble-burndown'])document.getElementById(id).textContent='';
    document.getElementById('btn-burndown-txt').disabled=true;
  },
  exportar(){if(this.idProyecto&&this.idSprint)window.location.href=`/api/metrics/proyectos/${encodeURIComponent(this.idProyecto)}/burndown/${encodeURIComponent(this.idSprint)}?formato=txt`;}
};
document.getElementById('btn-burndown-txt')?.addEventListener('click',()=>BurndownUI.exportar());
document.getElementById('btn-burndown-pdf')?.addEventListener('click',()=>window.print());
