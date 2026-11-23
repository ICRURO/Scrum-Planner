/* Validación compartida para las historias de usuario y las épicas. */
function validarReferenciaEpica(db, idProyecto, idEpica, obligatoria = false) {
  if (idEpica === undefined || idEpica === null || idEpica === '') {
    return obligatoria ? 'Debes seleccionar una épica para la historia de usuario.' : null;
  }
  if (typeof idEpica !== 'string') return 'El identificador de la épica no es válido.';
  const existe = (db.epicas || []).some((epica) =>
    epica.id === idEpica && epica.idProyecto === idProyecto
  );
  return existe ? null : 'La épica seleccionada no pertenece a este proyecto.';
}
module.exports = { validarReferenciaEpica };
