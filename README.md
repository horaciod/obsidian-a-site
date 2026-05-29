# Obsidian-a-Site ⚡


> **Obsidian-a-Site** es una herramienta CLI extremadamente ligera, de alto rendimiento y **sin dependencias externas** para exportar cualquier bóveda o carpeta de notas de Obsidian a un sitio web estático interactivo estilo Wiki personal (similar a la vista original de Obsidian).



El resultado es una **Single Page Application (SPA)** ultra-moderna, con estética *Glassmorphism* (modo oscuro), un grafo interactivo de relaciones basado en física de partículas, buscador en tiempo real, retroenlaces (*backlinks*) automáticos y transiciones fluidas.

> Ejemplo : [DEMO](https://docs.draphp.com)
---

## ✨ Características Principales

*   🚀 **Sin Dependencias en Servidor (Zero-Dependency CLI)**: Desarrollado puramente en Node.js de forma nativa. No requiere instalar ningún paquete de `npm` para realizar la exportación.
*   🌐 **Sitio Web 100% Autocontenido**: El directorio de destino generado (`dist/` u otro) incluye el visor HTML, estilos, scripts y copias sincronizadas de tus recursos. Está listo para subirse directamente a GitHub Pages, Vercel, Netlify o cualquier servidor web (Nginx/Apache).
*   🕸️ **Grafo de Relaciones Interactivo (Física en Canvas)**: Motor de física personalizado en HTML5 Canvas (sin librerías pesadas) que simula fuerzas físicas (repulsión magnética, tensión elástica y gravedad central). Soporta:
    *   Arrastre de nodos (*Drag & Drop*).
    *   Zoom con la rueda del ratón y paneo con arrastre libre de pantalla.
    *   Filtros visuales activos y de adyacencia según la nota seleccionada.
    *   *Modo de ahorro de CPU*: La física entra en modo de reposo automático cuando los nodos se estabilizan.
*   🔮 **Estética Glassmorphic Premium**: Interfaz moderna de modo oscuro con efectos de desenfoque de fondo (`backdrop-filter`), gradientes de neón indigo/púrpura y orbes luminosos flotantes.
*   💫 **Navegación Fluida (View Transitions API)**: Cambios de nota inmediatos y elegantes con morphing visual nativo gracias al uso de la moderna API de transiciones del navegador.
*   📝 **Soporte Completo de Obsidian**:
    *   Wikilinks de doble corchete: `[[Nombre Nota]]` o `[[Nombre Nota|Etiqueta Personalizada]]`.
    *   Imágenes integradas de Obsidian con tamaño máximo: `![[imagen.png|325]]` (redimensiona responsivamente y previene deformaciones de relación de aspecto).
    *   Copiador de código de un solo clic y resaltado de sintaxis (Nginx, Bash, YAML, etc.) mediante Prism.js.
    *   Visor Lightbox en pantalla completa al hacer clic sobre cualquier imagen del documento.
*   🔗 **Retroenlaces Dinámicos (Backlinks)**: Detecta y genera automáticamente en el pie de página qué otros documentos del sistema hacen referencia al artículo actual.
*   🔍 **Búsqueda Global Instantánea**: Buscador en tiempo real que filtra en segundos tanto los títulos como el contenido completo de todas tus notas.

---

## 📂 Estructura del Proyecto

Una vez que clonas este repositorio, dispondrás de los siguientes archivos plantilla:

```
obsidian-a-site/
├── build.js         # Script CLI compilador y exportador (Node.js)
├── index.html       # Plantilla base HTML de la Wiki
├── styles.css       # Hoja de estilos del sistema de diseño Glassmorphic
├── app.js           # Motor de la SPA, Markdown renderer y física del Canvas
└── README.md        # Esta guía de documentación
```

Al ejecutar la herramienta, se generará una carpeta de destino autocontenida para producción con la siguiente estructura:

```
carpeta_destino/
├── index.html       # Visor web de producción
├── styles.css       # Estilos web copiados
├── app.js           # Lógica interactiva copiada
├── data.json        # Base de datos JSON con las notas y conexiones compiladas
└── *.png/*.jpg      # Todos tus recursos e imágenes sincronizados automáticamente
```

---

## 🚀 Guía de Inicio Rápido

### 1. Clonar el repositorio
Clona el proyecto en tu máquina local:
```bash
git clone https://github.com/horaciod/obsidian-a-site.git
cd obsidian-a-site
```

### 2. Exportar tus notas de Obsidian
Ejecuta el script `build.js` pasándole la ruta de la carpeta que tiene tus notas y recursos (`-o`) y la carpeta de destino donde deseas compilar el sitio web (`-d`):

```bash
node build.js -o /ruta/a/tus/notas/obsidian -d ./dist
```

*   **`-o`**: Carpeta de origen con tus notas `.md` e imágenes.
*   **`-d`**: Carpeta de destino donde se generará la aplicación estática lista para producción.

### 3. Servir el sitio web localmente
Debido a que la aplicación carga la base de datos `data.json` de forma asíncrona mediante `fetch()`, el sitio web debe abrirse a través de un servidor HTTP local (para evitar restricciones de CORS del navegador al abrir archivos locales `file://`).

Puedes usar cualquiera de los siguientes comandos rápidos en tu terminal:

**Con Python 3:**
```bash
cd dist
python3 -m http.server 8000
```

**Con Node.js (sin instalar nada):**
```bash
npx http-server dist -p 8000
```

Abre tu navegador y entra a: `http://localhost:8000`

---

## 🛠️ Tecnologías Utilizadas

Para garantizar un peso mínimo y máxima velocidad, el proyecto se construyó utilizando tecnología web nativa clásica y moderna:
*   **Frontend**: HTML5 Semántico, CSS3 Vanilla (Custom Properties, Flexbox, Grid, Backdrop-Filters) y Vanilla JavaScript (ES6+).
*   **Compilador CLI**: Node.js puro (módulos nativos `fs` y `path`).
*   **Librerías externas (cargadas vía CDN)**:
    *   [marked](https://github.com/markedjs/marked) - Renderizador rápido de Markdown.
    *   [Prism.js](https://prismjs.com/) - Resaltador de sintaxis para bloques de código técnico.
    *   [Lucide](https://lucide.dev/) - Iconografía moderna y minimalista.

---

## ⚙️ Personalización y Ajustes

### Ajustar el estilo y colores
Todos los tokens visuales y variables de color están declarados en la sección `:root` de `styles.css`. Puedes cambiar los colores de neón, el desenfoque de los paneles o los radios de los bordes fácilmente:
```css
:root {
  --primary: #6366f1;       /* Indigo Glow (Color principal) */
  --secondary: #a855f7;     /* Purple Glow (Color secundario / Nota activa) */
  --bg-dark-base: #070913;  /* Color del fondo profundo */
}
```

### Modificar las fuerzas físicas del Grafo
Si deseas que los nodos se repelan más, estén más juntos o se muevan más rápido, puedes modificar las propiedades de configuración dentro del objeto `PHYSICS` en el archivo `app.js`:
```javascript
const PHYSICS = {
  repulsion: 1500,       // Fuerza de repulsión entre notas
  linkStrength: 0.08,    // Fuerza de tensión de los enlaces
  linkDistance: 120,      // Distancia ideal entre nodos conectados
  damping: 0.85,         // Fricción / desaceleración física (0 a 1)
};
```

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Siéntete libre de clonarlo, modificarlo y usarlo para documentar tus propios desarrollos.
