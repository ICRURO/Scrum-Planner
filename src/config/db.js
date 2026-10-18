/* Archivo de la base de datos donde se definen las funciones de lectura y escritura de database.json, 
para que otros archivos del servidor las importen y las usen. */

const fs = require('fs');
const path = require('path');

const RUTA = path.join(__dirname, '..', '..', 'database.json');

function readDB() {
  return JSON.parse(fs.readFileSync(RUTA, 'utf8'));
}

function writeDB(data) {
  const temporal = RUTA + '.tmp';
  fs.writeFileSync(temporal, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporal, RUTA);
}

module.exports = { readDB, writeDB };