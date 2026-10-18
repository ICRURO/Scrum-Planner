/*

  OBJETO API CON LOS MÉTODOS:

  * GET
  * POST
  * PUT
  * DELETE
  
  Devuelve: ok, status, datos. Nunca lanza errores y así cada pantalla decide
  como mostrar el fallo

  Se implementó para no tener que usar fetch en cada pantalla y así tener 
  menos código

*/

const Api = {
  async pedir(metodo, url, cuerpo) {
    try {
      const resp = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        credentials: 'same-origin'
      });
      let datos = null;
      try { datos = await resp.json(); } catch (e) { /* respuesta sin cuerpo */ }
      return { ok: resp.ok, status: resp.status, datos };
    } catch (e) {
      return { ok: false, status: 0, datos: { mensaje: 'No se pudo conectar con el servidor.' } };
    }
  },
  get(url) { return this.pedir('GET', url); },
  post(url, cuerpo = {}) { return this.pedir('POST', url, cuerpo); },
  put(url, cuerpo = {}) { return this.pedir('PUT', url, cuerpo); },
  delete(url) { return this.pedir('DELETE', url); }
};
