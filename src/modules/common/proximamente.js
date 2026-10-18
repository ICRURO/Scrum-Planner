// Muestra el nombre de la sección pedida 
const seccion = new URLSearchParams(window.location.search).get('s');
if (seccion) document.getElementById('titulo-seccion').textContent = `${seccion} estará disponible pronto`;
