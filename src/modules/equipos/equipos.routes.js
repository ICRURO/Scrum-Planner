const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Ruta a la base de datos
const dbPath = path.join(__dirname, '../../../database.json');
const leerDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const guardarDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// HU-14 y HU-15: Agregar participante y asignar rol Scrum
router.post('/proyectos/:proyectoId/participantes', (req, res) => {
    const { proyectoId } = req.params;
    const { usuarioId, rolScrum } = req.body;

    const db = leerDB();
    const proyecto = db.proyectos.find(p => p.id === proyectoId);
    
    if (!proyecto) {
        return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // HU-15: Identificar roles Scrum válidos
    const rolesValidos = ['Product Owner', 'Scrum Master', 'Developer', 'Interesado'];
    if (!rolesValidos.includes(rolScrum)) {
        return res.status(400).json({ error: 'Rol Scrum no válido' });
    }

    // Asegurar que el array de equipo exista
    if (!proyecto.equipo) proyecto.equipo = [];

    // HU-14: No se generan asignaciones duplicadas
    const existeDuplicado = proyecto.equipo.find(miembro => miembro.usuarioId === usuarioId);
    if (existeDuplicado) {
        return res.status(400).json({ error: 'El usuario ya forma parte del equipo de este proyecto' });
    }

    const nuevoParticipante = {
        usuarioId,
        rolScrum,
        estado: 'Activo',
        fechaAsignacion: new Date().toISOString()
    };

    proyecto.equipo.push(nuevoParticipante);
    guardarDB(db);

    res.status(201).json({ mensaje: 'Participante agregado y rol asignado con éxito', participante: nuevoParticipante });
});

module.exports = router;