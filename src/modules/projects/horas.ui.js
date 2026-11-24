/* Registro de horas reales en tarjetas Kanban. */
const HorasUI={
  proyecto:null,totales:{},sesion:null,repintar:null,ocupado:false,
  async cargar(id,sesion,repintar){
    this.proyecto=id;this.sesion=sesion;this.repintar=repintar;
    const r=await Api.get(`/api/metrics/proyectos/${encodeURIComponent(id)}/horas`);
    this.totales=r.ok?r.datos.totales||{}:{};
    this.error=!r.ok;
  },
  tarjeta(t,rol,archivado){
    const key=`${t.idHistoria}:${t.id}`;
    const total=Number(this.totales[key]||0);
    const propia=rol==='Developer'&&!archivado&&this.sesion?.usuario?.id===(t.idResponsable||t.idUsuarioResponsable||t.idUsuario);
    return `<div class="registro-horas-tarjeta"><small>${this.error?'Horas no disponibles':`${total} h reales registradas`}</small>${propia?`<button class="btn btn-secundario btn-chico" type="button" data-horas-historia="${UI.escapar(t.idHistoria)}" data-horas-tarea="${UI.escapar(t.id)}">Registrar horas</button>`:''}</div>`;
  },
  async abrir(boton){
    if(this.ocupado||!this.proyecto)return;
    const dialog=document.getElementById('dialogo-horas');
    document.getElementById('horas-tarea-id').value=boton.dataset.horasTarea;
    document.getElementById('horas-historia-id').value=boton.dataset.horasHistoria;
    document.getElementById('horas-titulo').textContent=`Registrar horas · ${boton.dataset.horasTarea}`;
    const d=new Date();const hoy=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const f=document.getElementById('horas-fecha');f.max=hoy;f.value=hoy;
    document.getElementById('horas-cantidad').value='';
    document.getElementById('horas-error').textContent='';
    this.idSolicitud=crypto.randomUUID();dialog.showModal();
  },
  async guardar(e){
    e.preventDefault();if(this.ocupado)return;
    const boton=document.getElementById('horas-guardar');this.ocupado=true;boton.disabled=true;
    const datos={idHistoria:document.getElementById('horas-historia-id').value,idTarea:document.getElementById('horas-tarea-id').value,horas:Number(document.getElementById('horas-cantidad').value),fecha:document.getElementById('horas-fecha').value,idSolicitud:this.idSolicitud};
    try{
      const r=await Api.post(`/api/metrics/proyectos/${encodeURIComponent(this.proyecto)}/horas`,datos);
      if(!r.ok){document.getElementById('horas-error').textContent=r.datos?.mensaje||'No se pudo registrar.';return;}
      document.getElementById('dialogo-horas').close();
      await this.cargar(this.proyecto,this.sesion,this.repintar);this.repintar?.();UI.toast(r.datos.mensaje,'exito');
    }finally{this.ocupado=false;boton.disabled=false;}
  }
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-horas-tarea]');if(b)HorasUI.abrir(b);});
document.getElementById('form-horas-reales')?.addEventListener('submit',e=>HorasUI.guardar(e));
document.getElementById('horas-cancelar')?.addEventListener('click',()=>{if(!HorasUI.ocupado)document.getElementById('dialogo-horas').close();});
