const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../config/db');
const { registrarHistorial } = require('../../config/historial');
const { requiereSesion } = require('../../middleware/auth');
const { puede, rolEnProyecto } = require('../../middleware/permisos');

// Verifica si un usuario puede administrar el equipo de un proyecto.
function puedeAdministrarEquipo(usuario, idProyecto, db) {
    if (usuario.rolGlobal === 'administrador') {
        return true;
    }

    const rol = rolEnProyecto(usuario, idProyecto, db);
    return rol === 'Scrum Master' || rol === 'Product Owner';
}

// GET /api/equipos -> Consultar los equipos de los proyectos autorizados.
router.get('/', requiereSesion, (req, res) => {
    const db = readDB();

    // Mostrar solamente los participantes de proyectos a los que puede acceder.
    const participantes = (db.participantes || db.equipos || []).filter(p => {
        const idProyecto = p.idProyecto || p.proyectoId;
        const existeProyecto = (db.proyectos || []).some(pr => pr.id === idProyecto);
        return existeProyecto && puede(req.usuario, 'consultar_proyecto', idProyecto, db);
    });

    const resultado = participantes.map(p => {
        const idProyecto = p.idProyecto || p.proyectoId;
        const idUsuario = p.idUsuario || p.usuarioId;
        const usuario = (db.usuarios || []).find(u => u.id === idUsuario);
        const proyecto = (db.proyectos || []).find(pr => pr.id === idProyecto);

        return {
            id: p.id,
            idProyecto: idProyecto,
            nombreProyecto: proyecto ? proyecto.nombre : idProyecto,
            usuarioId: idUsuario,
            nombreUsuario: usuario ? `${usuario.nombre} ${usuario.apellidos}` : idUsuario,
            correo: usuario ? usuario.correo : '',
            rol: p.rol,
            estado: usuario ? (usuario.estado === 'activo' ? 'Activo' : usuario.estado) : 'Activo'
        };
    });

    res.json(resultado);
});

// GET /api/equipos/proyectos/:idProyecto/participantes -> Consultar un equipo concreto.
router.get('/proyectos/:idProyecto/participantes', requiereSesion, (req, res) => {
    const db = readDB();
    const idProyecto = req.params.idProyecto;

    // Comprobar que el proyecto exista.
    const proyecto = (db.proyectos || []).find(p => p.id === idProyecto);
    if (!proyecto) {
        return res.status(404).json({ mensaje: 'El proyecto no existe.' });
    }

    // Impedir consultar equipos de proyectos ajenos.
    if (!puede(req.usuario, 'consultar_proyecto', idProyecto, db)) {
        return res.status(403).json({ mensaje: 'No tienes permisos para consultar este equipo.' });
    }

    // Filtrar exclusivamente los participantes de ESTE proyecto.
    const participantes = (db.participantes || db.equipos || []).filter(
        p => (p.idProyecto || p.proyectoId) === idProyecto
    );

    const resultado = participantes.map(p => {
        const idUsuario = p.idUsuario || p.usuarioId;
        const usuario = (db.usuarios || []).find(u => u.id === idUsuario);

        return {
            id: p.id,
            usuarioId: idUsuario,
            nombreUsuario: usuario ? `${usuario.nombre} ${usuario.apellidos}` : idUsuario,
            correo: usuario ? usuario.correo : '',
            rol: p.rol,
            rolScrum: p.rol,
            estado: usuario ? (usuario.estado === 'activo' ? 'Activo' : usuario.estado) : 'Activo'
        };
    });

    res.json(resultado);
});

// POST /api/equipos -> Agregar integrante a un proyecto
router.post('/', requiereSesion, (req, res) => {

    const { idProyecto, idUsuario, rol } = req.body || {};

    // Validar campos obligatorios
    if (!idProyecto || !idUsuario || !rol) {
        return res.status(400).json({
            mensaje: 'Proyecto, usuario y rol son obligatorios.'
        });
    }

    const db = readDB();

    // Verificar que el proyecto exista
    const proyecto = (db.proyectos || []).find(
        p => p.id === idProyecto
    );

    if (!proyecto) {
        return res.status(404).json({
            mensaje: 'El proyecto no existe.'
        });
    }

    // Comprobar permisos del usuario que realiza la operación
    if (!puedeAdministrarEquipo(req.usuario, idProyecto, db)) {
        return res.status(403).json({
            mensaje: 'No tienes permisos para agregar participantes.'
        });
    }

    // No permitir modificaciones en proyectos archivados
    if (proyecto.archivado) {
        return res.status(409).json({
            mensaje: 'No se pueden agregar integrantes a un proyecto archivado.'
        });
    }

    // Verificar que el usuario exista y esté activo
    const usuario = (db.usuarios || []).find(
        u => u.id === idUsuario
    );

    if (!usuario || usuario.estado !== 'activo') {
        return res.status(400).json({
            mensaje: 'El usuario no existe o no está activo.'
        });
    }

    // Roles Scrum permitidos
    const rolesPermitidos = [
        'Scrum Master',
        'Product Owner',
        'Developer',
        'Interesado'
    ];

    if (!rolesPermitidos.includes(rol)) {
        return res.status(400).json({
            mensaje: 'El rol seleccionado no es válido.'
        });
    }

    if (!db.participantes) {
        db.participantes = [];
    }

    // Evitar usuarios repetidos dentro del proyecto
    const yaExiste = db.participantes.some(p =>
        (p.idProyecto || p.proyectoId) === idProyecto &&
        (p.idUsuario || p.usuarioId) === idUsuario
    );

    if (yaExiste) {
        return res.status(409).json({
            mensaje: 'El usuario ya pertenece a este proyecto.'
        });
    }

    // Generar identificador del participante
    const max = db.participantes.reduce((m, p) => {
        const numero = parseInt(String(p.id).split('-')[1], 10);
        return Math.max(m, numero || 0);
    }, 0);

    const nuevoParticipante = {
        id: `PAR-${String(max + 1).padStart(3, '0')}`,
        idProyecto: idProyecto,
        idUsuario: idUsuario,
        rol: rol
    };

    // Guardar participante
    db.participantes.push(nuevoParticipante);

    // Registrar operación en el historial
    registrarHistorial(db, {
        idUsuario: req.usuario.id,
        entidad: 'proyecto',
        idEntidad: idProyecto,
        campo: 'participante',
        valorAnterior: null,
        valorNuevo: `${idUsuario} (${rol})`
    });

    writeDB(db);

    return res.status(201).json({
        mensaje: 'Participante agregado correctamente.',
        participante: nuevoParticipante
    });
});

module.exports = router;