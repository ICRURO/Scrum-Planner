    const express = require('express');
    const { readDB, writeDB } = require('../../config/db');
    const { requiereSesion } = require('../../middleware/auth');

    const router = express.Router();
    router.use(requiereSesion);

    router.get('/progreso', (req, res) => {
    const db = readDB();
    const idUsuario = req.usuario.id;

    if (!db.capacitacionProgreso) db.capacitacionProgreso = [];
    let progreso = db.capacitacionProgreso.find((p) => p.idUsuario === idUsuario);
    
    if (!progreso) {
        progreso = { idUsuario, porcentaje: 0, pasoIndex: 0, moduloActual: 'Épica 1', completado: false };
        db.capacitacionProgreso.push(progreso);
        writeDB(db);
    }

    res.json({ progreso });
    });

    router.put('/progreso', (req, res) => {
    const db = readDB();
    const idUsuario = req.usuario.id;
    const { porcentaje, pasoIndex, moduloActual, completado } = req.body;

    if (!db.capacitacionProgreso) db.capacitacionProgreso = [];
    let progreso = db.capacitacionProgreso.find((p) => p.idUsuario === idUsuario);
    
    if (!progreso) {
        progreso = { idUsuario, porcentaje: 0, pasoIndex: 0, moduloActual: 'Épica 1', completado: false };
        db.capacitacionProgreso.push(progreso);
    }

    if (porcentaje !== undefined) progreso.porcentaje = Number(porcentaje);
    if (pasoIndex !== undefined) progreso.pasoIndex = Number(pasoIndex);
    if (moduloActual !== undefined) progreso.moduloActual = moduloActual;
    if (completado !== undefined) progreso.completado = Boolean(completado);
    progreso.ultimaActualizacion = new Date().toISOString().split('T')[0];

    writeDB(db);
    res.json({ mensaje: 'Progreso actualizado.', progreso });
    });

    router.get('/admin/avances', (req, res) => {
    const db = readDB();
    if (req.usuario.rolGlobal !== 'administrador') {
        return res.status(403).json({ mensaje: 'No autorizado.' });
    }

    const usuarios = db.usuarios || [];
    const progresos = db.capacitacionProgreso || [];

    const avances = usuarios.map((u) => {
        const prog = progresos.find((p) => p.idUsuario === u.id) || { porcentaje: 0, pasoIndex: 0, moduloActual: 'Épica 1', completado: false };
        return {
        idUsuario: u.id,
        nombre: `${u.nombre} ${u.apellidos}`,
        correo: u.correo,
        ...prog
        };
    });

    res.json({ avances });
    });

    module.exports = router;