Carpeta common es para que puedan visualizar todos los componentes y tomar los que vayan en sus pantallas. Es mera guía para nosotros y así todos ocupemos lo mismo. El código de próximamente también es para que lo pongan en las pantallas cuyas funcionalidades aún no desarrollen (le cambian el texto según su pantalla)

Acceden con: 
http://localhost:3000/componentes
http://localhost:3000/proximamente

La carpeta shared tiene precisamente los archivos base de estilo para que todos los manden a llamar en sus pantallas y mantengamos un mismo orden, y ya no estar repitiendo código

La bd está organizada en: usuarios, proyectos, participantes, historiasUsuario e historial. Cada historia de usuario se asocia a un proyecto y contiene sus criterios de aceptación en formato Dado/Cuando/Entonces. El Product Owner y el administrador pueden ordenar el Product Backlog; ese orden se conserva en cada historia. Los participantes del proyecto autorizados pueden agregar comentarios, que quedan asociados a su usuario y a la historia. La prioridad, edición y comentarios relevantes también se registran en el historial. Un usuario puede participar en varios proyectos y puede tener un rol diferente en cada uno.

No se eliminan registros (porque así lo piden las historias). Se desactivan cuentas o se archivan proyectos. La bd si puede guardar cambios (crear proyecto, editar, desactivar) pero, aún no se habilitan esos botones. Sin embargo writeDB() ya existe y funciona. 

Esto es importante porque, a pesar de que tendremos opciones de eliminar, las historias de nuestras épicas dice (de manera general) que:

“Las acciones de desactivar, archivar, reabrir y cancelar conservan la información y el historial asociados; los registros del historial no se modifican con las operaciones normales de edición.”

Por eso no desaparece por completo, cambia su estado

De momento estamos todos nosotros con nuestros respectivos roles, y, aparte, los roles tal cual para hacer pruebas
