# Rediseño e Implementación: De Script CLI a Plugin de Obsidian

Este documento registra el plan de rediseño y la estrategia de implementación para convertir el proyecto de generación de wikis estáticas **Obsidian-a-Site** en un plugin nativo de Obsidian. Se mantiene al mismo tiempo la funcionalidad actual por línea de comandos (CLI) y se añaden capacidades de personalización para el título del sitio, página inicial, y carpetas de origen y destino.

---

## 🏗️ 1. Estructura del Proyecto Propuesta

Para evitar colisiones de estilos en Obsidian (ya que Obsidian carga automáticamente el archivo `styles.css` del plugin en toda la app) y organizar mejor el código del compilador, se moverán las plantillas del sitio web a una carpeta `templates/`.

El repositorio tendrá la siguiente estructura tras los cambios:

```
obsidian-a-site/
├── templates/               # NUEVO: Carpeta contenedora de las plantillas del sitio web estático
│   ├── index.html           # Plantilla base (con placeholders para título, subtexto, etc.)
│   ├── styles.css           # Estilos estáticos
│   └── app.js               # Lógica interactiva del cliente (con placeholder para nota inicial)
├── manifest.json            # NUEVO: Metadatos del plugin de Obsidian
├── main.js                  # NUEVO: Código principal del plugin (UI, configuración, eventos)
├── build.js                 # Compilador adaptado (soporta ejecución CLI y programmatic import)
├── REDISIGN-PLUGIN-OBSIDIAN.md # Este documento de planificación
├── README.md                # Documentación actualizada
└── LICENSE                  # Licencia del proyecto
```

---

## ⚙️ 2. Plantillas Dinámicas y Placeholders

Modificaremos las plantillas para permitir la inyección de configuraciones personalizadas en tiempo de compilación.

### A. En `templates/index.html`
*   Reemplazar `<title>SIG Wiki - Documentación...</title>` con `<title>{{SITE_TITLE}}</title>`.
*   Reemplazar `<meta name="description" content="...">` con `<meta name="description" content="{{SITE_DESCRIPTION}}">`.
*   Reemplazar `<h1 class="logo-text">hDOCS</h1>` con `<h1 class="logo-text">{{SITE_LOGO_TEXT}}</h1>`.
*   Reemplazar `<span class="logo-subtext">...</span>` con `<span class="logo-subtext">{{SITE_LOGO_SUBTEXT}}</span>`.
*   Reemplazar `<a href="#" class="breadcrumb-item" data-target="index">SIG</a>` con `<a href="#" class="breadcrumb-item" data-target="{{HOME_NOTE}}">{{BREADCRUMB_HOME_TEXT}}</a>`.

### B. En `templates/app.js`
*   Reemplazar `activeNoteId: '01-index',` con `activeNoteId: '{{HOME_NOTE}}',`.
*   Reemplazar las búsquedas / caídas hacia `'index'` por `'{{HOME_NOTE}}'` en la lógica de navegación por hash para que la nota principal sea configurable.

---

## ⚡ 3. Adaptación de `build.js` (CLI & Programático)

Modificaremos `build.js` para que funcione con el siguiente patrón híbrido (CommonJS):

```javascript
// Si se ejecuta directamente por CLI
if (require.main === module) {
  const config = parseCliArgs();
  runBuild(config);
} else {
  // Exportar función para ser usada por el plugin de Obsidian
  module.exports = { runBuild };
}
```

### Mejoras en `build.js`:
1.  **Nuevos Argumentos CLI**:
    *   `--title "Mi Wiki"`: Título del sitio web (reemplaza `{{SITE_TITLE}}`, `{{SITE_LOGO_TEXT}}`).
    *   `--subtitle "Mi Subtítulo"`: Subtexto del logo (reemplaza `{{SITE_LOGO_SUBTEXT}}`).
    *   `--home "mi-nota-inicial"`: Nota que actúa como página de aterrizaje (reemplaza `{{HOME_NOTE}}`).
2.  **Valores por Defecto**:
    *   Si no se proveen argumentos, se mantendrán exactamente los valores hardcoded actuales, garantizando **retrocompatibilidad del 100%**.
3.  **Procesador de Plantillas**:
    *   En lugar de un simple `fs.copyFileSync()`, `build.js` leerá `index.html` y `app.js` como texto, aplicará el reemplazo de placeholders con expresiones regulares, y guardará los archivos compilados en la carpeta de destino.

---

## 🔌 4. Desarrollo del Plugin de Obsidian (`main.js` & `manifest.json`)

Crearemos los archivos requeridos para que Obsidian detecte y ejecute la herramienta como un plugin oficial de escritorio:

### A. `manifest.json`
Define el ID del plugin, versión, nombre del autor y requisitos mínimos.
```json
{
  "id": "obsidian-a-site",
  "name": "Obsidian-a-Site",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Exporta tus notas de Obsidian a un sitio web interactivo y auto-contenido con estética Glassmorphism.",
  "author": "Horacio Degiorgi",
  "authorUrl": "https://pinkary.com/@horaciod",
  "isDesktopOnly": true
}
```

### B. `main.js` (Lógica del Plugin)
1.  **Clase `ObsidianSitePlugin`**:
    *   Registra configuraciones (`originDir`, `destDir`, `siteTitle`, `siteSubtitle`, `homeNote`).
    *   Añade un botón en la barra lateral izquierda (Ribbon Icon) para disparar la exportación rápidamente con un solo clic.
    *   Registra el comando "Build Static Wiki" en la paleta de comandos (`Ctrl/Cmd + P`).
    *   **Carga Dinámica Resiliente**: Para evitar que la carga del plugin falle por restricciones del sistema de módulos de Obsidian al iniciar (`onload`), `build.js` se importa dinámicamente utilizando la ruta absoluta calculada mediante `vault.adapter.getBasePath()` y `this.manifest.dir` al momento de ejecutar la exportación.
    *   Ejecuta la función `runBuild(config)` importada desde `build.js`.
    *   Muestra notificaciones nativas de Obsidian (`new Notice()`) sobre el estado de la compilación.
2.  **Clase `ObsidianSiteSettingTab`**:
    *   Genera un panel visual de configuración en los ajustes de Obsidian.
    *   **Directorio Origen**: Input de texto. Por defecto usa la raíz de la bóveda (`vault.adapter.getBasePath()`) si se deja vacío.
    *   **Directorio Destino**: Input de texto. Por defecto usa `<Vault>/wiki-dist/` si se deja vacío.
    *   **Título del Sitio**: Input de texto.
    *   **Subtítulo del Sitio**: Input de texto.
    *   **Página Inicial (Home Note)**: Input de texto.

