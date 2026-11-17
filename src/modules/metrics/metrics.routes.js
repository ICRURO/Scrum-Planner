    const express = require('express');
    const { readDB } = require('../../config/db');
    const { requiereSesion } = require('../../middleware/auth');
    const { esParticipante } = require('../../middleware/permisos');
    const { obtenerDatos, obtenerReporteProyecto, resumenProyecto, normalizar } = require('./metrics.service');
    const { crearPDF, crearTexto } = require('./metrics.report');
    const router = express.Router();
    router.use(requiereSesion);
    function contexto(req, res) {
    const db = readDB();
    const proyecto = (db.proyectos || []).find(p => p.id === req.params.idProyecto);
    if (!proyecto) { res.status(404).json({ mensaje: 'No se encontró el proyecto.' }); return null; }
    if (req.usuario.rolGlobal !== 'administrador' && !esParticipante(req.usuario, proyecto.id, db)) {
        res.status(403).json({ mensaje: 'No tienes permisos para consultar este proyecto.' }); return null;
    }
    return { db, proyecto, sprints: (db.sprints || []).filter(s => s.idProyecto === proyecto.id) };
    }
    router.get('/proyectos/:idProyecto/sprints/:idSprint', (req, res) => {
    const c = contexto(req, res); if (!c) return;
    const id = req.params.idSprint;
    const sprint = id === 'ACTUAL' ? c.sprints.find(s => normalizar(s.estado) === 'activo') || [...c.sprints].sort((a,b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio)))[0] : c.sprints.find(s => s.id === id);
    if (!sprint && !['ACTUAL', 'NINGUNO'].includes(id)) return res.status(404).json({ mensaje: 'No se encontró el Sprint en este proyecto.' });
    res.json({ ...obtenerDatos(c.db, c.proyecto, sprint), resumenProyecto: resumenProyecto(c.db, c.proyecto), sprintsDisponibles: c.sprints.map(s => ({ id: s.id, nombre: s.nombre })) });
    });
    function descargar(req, res, next, datos) {
    const formato = req.query.formato || 'txt';
    if (!['txt', 'pdf'].includes(formato)) return res.status(400).json({ mensaje: 'Formato no válido. Usa pdf o txt.' });
    const nombre = `reporte-${datos.proyecto.id}-${datos.sprint?.id || 'proyecto-completo'}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.attachment(`${nombre}.${formato}`);
    if (formato === 'txt') return res.type('text/plain; charset=utf-8').send(crearTexto(datos));
    res.type('application/pdf');
    try {
        const doc = crearPDF(datos); doc.on('error', next); doc.pipe(res); doc.end();
    } catch (e) { next(e); }
    }
    router.get('/proyectos/:idProyecto/sprints/:idSprint/exportar', (req, res, next) => {
    const c = contexto(req, res); if (!c) return;
    const sprint = c.sprints.find(s => s.id === req.params.idSprint);
    if (!sprint) return res.status(404).json({ mensaje: 'No se encontró el Sprint en este proyecto.' });
    descargar(req, res, next, obtenerDatos(c.db, c.proyecto, sprint));
    });
    router.get('/proyectos/:idProyecto/exportar', (req, res, next) => {
    const c = contexto(req, res); if (!c) return;
    descargar(req, res, next, obtenerReporteProyecto(c.db, c.proyecto));
    });
    router.get('/proyectos/:idProyecto/historial-sprints', (req, res) => {
    const c = contexto(req, res); if (!c) return;
    res.json({ ok: true, sprints: c.sprints.filter(s => ['finalizado', 'completado', 'terminado'].includes(normalizar(s.estado))).map(s => ({
        id: s.id, nombre: s.nombre, estado: s.estado,
        fechaCierre: s.fechaCierre || null, fechaFin: s.fechaFin || null
    })) });
    });
    module.exports = router;
