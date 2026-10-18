/* Pantalla "Permisos de acceso": dibuja la matriz que viene de permisos.js */
(async function () {
  const sesion = await Layout.listo;
  if (!sesion) return;

  const NOMBRES_ROL = { administrador: 'Admin', 'Product Owner': 'Product Owner', 'Scrum Master': 'Scrum Master', Developer: 'Developer', Interesado: 'Interesado' };

  const r = await Api.get('/api/auth/permisos');
  if (!r.ok) return UI.toast(r.datos?.mensaje || 'No se pudo cargar la matriz.', 'error');
  const { roles, matriz } = r.datos;

  document.getElementById('matriz-cabecera').innerHTML =
    `<tr><th>Acción</th>${roles.map((rol) => `<th class="tabla__centro">${UI.escapar(NOMBRES_ROL[rol] || rol)}</th>`).join('')}</tr>`;

  document.getElementById('matriz-cuerpo').innerHTML = matriz.map((fila) => `
    <tr>
      <td>${UI.escapar(fila.texto)}</td>
      ${roles.map((rol) => fila.roles.includes(rol)
        ? `<td class="tabla__centro"><span class="si" title="Permitido">${Icons.get('check', 20)}</span><span class="solo-lectores">Permitido</span></td>`
        : `<td class="tabla__centro"><span class="no" aria-hidden="true">—</span><span class="solo-lectores">No permitido</span></td>`).join('')}
    </tr>`).join('');

  Icons.hidratar();
})();
