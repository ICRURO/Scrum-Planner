    const express = require('express');
    const { readDB } = require('../../config/db');
    const { requiereSesion } = require('../../middleware/auth');
    const { esParticipante } = require('../../middleware/permisos');

    const router = express.Router();
    router.use(requiereSesion);

    const ESTIMACIONES = ['XS', 'S', 'M', 'L', 'XL'];

    function calcularDias(inicio, fin) {
    const diff = new Date(fin).getTime() - new Date(inicio).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    }

    // GET /api/metrics/proyectos/:idProyecto/sprints/:idSprint
    router.get('/proyectos/:idProyecto/sprints/:idSprint', (req, res) => {
    const db = readDB();
    const { idProyecto, idSprint } = req.params;
    const usuario = req.usuario;

    const proyecto = (db.proyectos || []).find((p) => p.id === idProyecto);
    if (!proyecto) {
        return res.status(404).json({ mensaje: 'No se encontró el proyecto.' });
    }

    if (usuario.rolGlobal !== 'administrador' && !esParticipante(usuario, idProyecto, db)) {
        return res.status(403).json({ mensaje: 'No tienes permisos para consultar este proyecto.' });
    }

    // 1. Obtener únicamente los sprints pertenecientes a ESTE proyecto
    const sprintsProyecto = (db.sprints || []).filter((s) => s.idProyecto === idProyecto);
    const sprint = sprintsProyecto.find((s) => s.id === idSprint);

    // 2. Historias exclusivas de este proyecto y sprint
    const historias = (db.historiasUsuario || []).filter(
        (h) => h.idProyecto === idProyecto && (sprint ? h.idSprint === sprint.id : false)
    );

    // 3. Tareas exclusivas: si el sprint no pertenece a este proyecto, no se cargan tareas
    const tareas = sprint
        ? (db.tareas || []).filter((t) => t.idSprint === sprint.id)
        : [];

    // HU-44/HU-46: Conteo por tallas
    const conteoTallas = { XS: 0, S: 0, M: 0, L: 0, XL: 0, sinEstimar: 0 };
    historias.forEach((h) => {
        if (h.estimacion && ESTIMACIONES.includes(h.estimacion)) {
        conteoTallas[h.estimacion]++;
        } else {
        conteoTallas.sinEstimar++;
        }
    });

    // HU-43/HU-45: Parámetros del Burndown Chart
    const fechaInicio = sprint?.fechaInicio || proyecto.fechaInicio;
    const fechaFin = sprint?.fechaFin || proyecto.fechaFin;
    const totalDias = calcularDias(fechaInicio, fechaFin);
    const totalHoras = tareas.reduce((acc, t) => acc + (Number(t.horasEstimadas) || 1), 0);

    // Validación estricta: Solo hay datos suficientes si existe el Sprint en este proyecto y tiene tareas
    const datosSuficientes = Boolean(sprint) && tareas.length > 0 && totalDias > 0;

    let serieIdeal = [];
    let serieReal = [];
    let etiquetasDias = [];

    if (datosSuficientes) {
        const reduccionIdeal = totalHoras / totalDias;
        const hoyISO = new Date().toISOString().split('T')[0];

        for (let i = 0; i <= totalDias; i++) {
        const fechaCorte = new Date(fechaInicio + 'T00:00:00');
        fechaCorte.setDate(fechaCorte.getDate() + i);
        const corteISO = fechaCorte.toISOString().split('T')[0];

        const fechaCorta = fechaCorte.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        etiquetasDias.push(fechaCorta);

        serieIdeal.push(Math.max(0, parseFloat((totalHoras - (reduccionIdeal * i)).toFixed(1))));

        const completadas = tareas
            .filter((t) => (t.estado === 'terminado' || t.estado === 'Finalizado') && t.fechaTerminado && t.fechaTerminado <= corteISO)
            .reduce((acc, t) => acc + (Number(t.horasEstimadas) || 1), 0);

        if (corteISO <= hoyISO) {
            serieReal.push(Math.max(0, parseFloat((totalHoras - completadas).toFixed(1))));
        }
        }
    }

    const tareasEnProgreso = tareas
        .filter((t) => t.estado === 'en_progreso' || t.estado === 'En progreso')
        .map((t) => {
        const responsable = (db.usuarios || []).find((u) => u.id === t.idResponsable || u.id === t.idUsuario);
        return {
            id: t.id,
            titulo: t.titulo || t.descripcion || 'Tarea sin título',
            responsable: responsable ? `${responsable.nombre} ${responsable.apellidos}` : 'Sin asignar',
            estado: 'En progreso'
        };
        });

    res.json({
        proyecto: { id: proyecto.id, nombre: proyecto.nombre },
        sprintsDisponibles: sprintsProyecto.map((s) => ({ id: s.id, nombre: s.nombre })),
        sprint: sprint || null,
        metricas: {
        datosSuficientes,
        totalHoras,
        totalDias,
        etiquetasDias,
        serieIdeal,
        serieReal,
        conteoTallas,
        tareasEnProgreso
        }
    });
    });

    module.exports = router;