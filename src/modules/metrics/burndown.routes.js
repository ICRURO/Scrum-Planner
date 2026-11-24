/* Doble Burndown y registro de horas. No sustituye la API original de métricas. */
const express=require('express');
const crypto=require('crypto');
const {readDB,writeDB}=require('../../config/db');
const {registrarHistorial}=require('../../config/historial');
const {requiereSesion}=require('../../middleware/auth');
const {puede,rolEnProyecto}=require('../../middleware/permisos');
const {calcular,alcance,tareasHistoria,fechaLocal,dia}=require('./burndown.logic');
const router=express.Router();
router.use(requiereSesion);
function contexto(req,res){
  const db=readDB();
  const proyecto=(db.proyectos||[]).find(p=>p.id===req.params.idProyecto);
  if(!proyecto){res.status(404).json({mensaje:'Proyecto no encontrado.'});return null;}
  if(!puede(req.usuario,'consultar_proyecto',proyecto.id,db)){res.status(403).json({mensaje:'No tienes acceso a este proyecto.'});return null;}
  return {db,proyecto,rol:rolEnProyecto(req.usuario,proyecto.id,db)};
}
function reporte(ctx,sprint){
  const {db,proyecto}=ctx;
  const historias=alcance(db,proyecto,sprint);
  const conteoTallas={XS:0,S:0,M:0,L:0,XL:0,sinEstimar:0};
  historias.forEach(h=>{if(['XS','S','M','L','XL'].includes(h.estimacion))conteoTallas[h.estimacion]++;else conteoTallas.sinEstimar++;});
  const tareasEnProgreso=historias.flatMap(h=>tareasHistoria(db,h)).filter(t=>['en progreso','en_progreso'].includes(String(t.estado).toLowerCase())).map(t=>{const u=(db.usuarios||[]).find(u=>u.id===(t.idResponsable||t.idUsuarioResponsable||t.idUsuario));return {id:t.id,titulo:t.titulo||'Tarea',responsable:u?`${u.nombre} ${u.apellidos}`:'Sin asignar',estado:'En progreso'};});
  const burndown=calcular(db,proyecto,sprint);
  return {proyecto:{id:proyecto.id,nombre:proyecto.nombre},sprint,burndown,metricas:{datosSuficientes:burndown.puntos.disponible||burndown.horas.disponible,conteoTallas,tareasEnProgreso,fechaConsulta:fechaLocal(),advertencias:burndown.advertencias}};
}
router.get('/proyectos/:idProyecto/burndown/:alcance',(req,res)=>{
  const ctx=contexto(req,res);if(!ctx)return;
  const sprint=req.params.alcance==='TODOS'?null:(ctx.db.sprints||[]).find(s=>s.id===req.params.alcance&&s.idProyecto===ctx.proyecto.id);
  if(req.params.alcance!=='TODOS'&&!sprint)return res.status(404).json({mensaje:'Sprint no encontrado en el proyecto.'});
  const datos=reporte(ctx,sprint);
  if(req.query.formato==='txt'){
    const b=datos.burndown;
    const filas=b.etiquetasDias.map((d,i)=>[d,b.puntos.disponible?b.puntos.serieIdeal[i]:'N/D',b.puntos.disponible?b.puntos.serieReal[i]??'N/D':'N/D',b.horas.disponible?b.horas.serieIdeal[i]:'N/D',b.horas.disponible?b.horas.serieReal[i]??'N/D':'N/D'].join('\t'));
    const seguro=s=>String(s).replace(/[^a-zA-Z0-9_-]/g,'_');
    res.setHeader('Content-Disposition',`attachment; filename="burndown-${seguro(ctx.proyecto.id)}-${seguro(req.params.alcance)}.txt"`);
    return res.type('text/plain').send(['DOBLE BURNDOWN',ctx.proyecto.nombre,sprint?sprint.nombre:'General del proyecto',`Puntos estimados: ${b.puntos.disponible?b.puntos.total:'N/D'}`,`Horas estimadas: ${b.horas.disponible?b.horas.total:'N/D'}`,`Horas registradas: ${b.horas.invertidas}`,`Exceso: ${b.horas.disponible?b.horas.exceso:'N/D'}`,'Fecha\tPuntos ideal\tPuntos real\tHoras ideal\tHoras real',...filas,'',...b.advertencias].join('\n'));
  }
  res.json(datos);
});
router.get('/proyectos/:idProyecto/horas',(req,res)=>{
  const ctx=contexto(req,res);if(!ctx)return;
  const totales=Object.create(null);
  for(const r of ctx.db.registrosHoras||[]){if(r.idProyecto!==ctx.proyecto.id)continue;const k=`${r.idHistoria}:${r.idTarea}`;totales[k]=Math.round(((totales[k]||0)+r.horas)*100)/100;}
  res.json({totales});
});
router.post('/proyectos/:idProyecto/horas',(req,res)=>{
  const ctx=contexto(req,res);if(!ctx)return;
  const {db,proyecto,rol}=ctx;
  if(rol!=='Developer')return res.status(403).json({mensaje:'Solo el Developer responsable puede registrar sus horas.'});
  if(proyecto.archivado||String(proyecto.estado).toLowerCase()==='finalizado')return res.status(409).json({mensaje:'El proyecto no admite registros.'});
  const {idHistoria,idTarea,horas,fecha,idSolicitud}=req.body||{};
  const h=(db.historiasUsuario||[]).find(h=>h.id===idHistoria&&h.idProyecto===proyecto.id);
  const t=h&&tareasHistoria(db,h).find(t=>t.id===idTarea);
  if(!t)return res.status(404).json({mensaje:'La tarea no pertenece al proyecto y a la historia indicados.'});
  if((t.idResponsable||t.idUsuarioResponsable||t.idUsuario)!==req.usuario.id)return res.status(403).json({mensaje:'Solo puedes registrar horas de tus tareas asignadas.'});
  if(typeof horas!=='number'||!Number.isFinite(horas)||horas<=0||horas>24||Math.abs(horas*100-Math.round(horas*100))>1e-7)return res.status(400).json({mensaje:'Registra entre 0.01 y 24 horas, con máximo dos decimales.'});
  if(dia(fecha)===null||fecha>fechaLocal()||(dia(proyecto.fechaInicio)!==null&&fecha<proyecto.fechaInicio))return res.status(400).json({mensaje:'La fecha debe ser válida, no futura y posterior o igual al inicio del proyecto.'});
  if(typeof idSolicitud!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(idSolicitud))return res.status(400).json({mensaje:'Identificador de solicitud inválido.'});
  const sprints=(db.sprints||[]).filter(s=>s.idProyecto===proyecto.id);
  const asignados=sprints.filter(s=>s.id===h.idSprint||s.id===t.idSprint||(s.historiasAsignadas||[]).includes(h.id));
  const sprint=asignados.find(s=>s.id===t.idSprint)||asignados.find(s=>s.id===h.idSprint)||(asignados.length===1?asignados[0]:null);
  if(!sprint&&asignados.length>1)return res.status(409).json({mensaje:'La historia tiene varios sprints; corrige su asignación.'});
  if(sprint&&['cancelado','cancelada'].includes(String(sprint.estado).toLowerCase()))return res.status(409).json({mensaje:'El sprint está cancelado.'});
  if(sprint&&dia(sprint.fechaInicio)!==null&&fecha<sprint.fechaInicio)return res.status(400).json({mensaje:'La fecha no puede ser anterior al inicio del sprint.'});
  if(!db.registrosHoras)db.registrosHoras=[];
  const anterior=db.registrosHoras.find(r=>r.idUsuario===req.usuario.id&&r.idSolicitud===idSolicitud);
  if(anterior){if(anterior.idProyecto!==proyecto.id||anterior.idHistoria!==idHistoria||anterior.idTarea!==idTarea||anterior.horas!==horas||anterior.fecha!==fecha)return res.status(409).json({mensaje:'La solicitud ya fue utilizada.'});return res.json({mensaje:'Registro ya guardado.',registro:anterior});}
  const diaUsuario=db.registrosHoras.filter(r=>r.idUsuario===req.usuario.id&&r.fecha===fecha).reduce((n,r)=>n+r.horas,0);
  if(diaUsuario+horas>24.000001)return res.status(400).json({mensaje:'El total de horas del usuario en ese día supera 24.'});
  const registro={id:crypto.randomUUID(),idSolicitud,idProyecto:proyecto.id,idSprint:sprint?.id||null,idHistoria,idTarea,idUsuario:req.usuario.id,horas,fecha,fechaRegistro:new Date().toISOString()};
  db.registrosHoras.push(registro);
  registrarHistorial(db,{idUsuario:req.usuario.id,entidad:'proyecto',idEntidad:proyecto.id,campo:'horas_reales',valorNuevo:`${idTarea}: ${horas} h (${fecha})`});
  writeDB(db);
  res.status(201).json({mensaje:'Horas reales registradas correctamente.',registro});
});
module.exports=router;
