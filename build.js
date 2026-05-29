const fs = require('fs');
const path = require('path');

/**
 * Core build/export logic.
 * Can be called via CLI or programmatically (e.g. from an Obsidian plugin).
 * 
 * @param {Object} config Build configurations.
 * @param {string} config.originDir Path to Markdown notes folder.
 * @param {string} config.destDir Path to output static website folder.
 * @param {string} [config.siteTitle] Title of the site.
 * @param {string} [config.siteLogoText] Text for the logo in sidebar.
 * @param {string} [config.siteSubtitle] Subtitle or description in sidebar.
 * @param {string} [config.siteDescription] SEO Meta Description.
 * @param {string} [config.homeNote] Landing/Index note ID (without .md).
 * @param {string} [config.breadcrumbHomeText] Breadcrumbs home node name.
 */
function runBuild(config) {
  const originDir = config.originDir;
  const destDir = config.destDir;

  if (!originDir || !destDir) {
    console.error('\x1b[31mError: Parámetros incorrectos o insuficientes.\x1b[0m');
    console.error('\x1b[33mUso correcto: node build.js -o <carpeta_origen> -d <carpeta_destino> [opciones]\x1b[0m');
    console.error('  -o : Directorio que contiene las notas Markdown (.md) y los recursos.');
    console.error('  -d : Directorio destino donde se generará la web autocontenida para producción.');
    console.error('Opciones opcionales:');
    console.error('  --title    : Título del sitio web (para <title> y el panel lateral).');
    console.error('  --subtitle : Subtítulo o texto descriptivo en el panel lateral.');
    console.error('  --home     : Nota de inicio (sin extensión .md, ej. "Home" o "README").');
    console.error('  --desc     : Meta descripción para SEO.');
    
    if (require.main === module) {
      process.exit(1);
    } else {
      throw new Error('Faltan carpetas de origen o destino en la configuración.');
    }
  }

  const resolvedOrigin = path.resolve(originDir);
  const resolvedDest = path.resolve(destDir);
  const templatesDir = path.join(__dirname, 'templates');

  console.log(`\n\x1b[36m⚡ Iniciando Exportador de Obsidian a Wiki HTML interactivo...\x1b[0m`);
  console.log(`📂 Directorio Origen: ${resolvedOrigin}`);
  console.log(`🎯 Directorio Destino: ${resolvedDest}`);

  // Validate origin
  if (!fs.existsSync(resolvedOrigin)) {
    const errorMsg = `El directorio de origen no existe: ${resolvedOrigin}`;
    console.error(`\x1b[31mError: ${errorMsg}\x1b[0m`);
    if (require.main === module) {
      process.exit(1);
    } else {
      throw new Error(errorMsg);
    }
  }

  // Create destination folder recursively
  if (!fs.existsSync(resolvedDest)) {
    fs.mkdirSync(resolvedDest, { recursive: true });
    console.log(`\x1b[32m✔ Creada carpeta de destino: ${resolvedDest}\x1b[0m`);
  }

  // Setup configuration options with backwards-compatible fallbacks
  const siteTitle = config.siteTitle || 'SIG Wiki - Documentación e Implementación de WAF';
  const siteLogoText = config.siteLogoText || config.siteTitle || 'hDOCS';
  const siteLogoSubtext = config.siteSubtitle || 'Anubis y Proxy Manager';
  const siteDescription = config.siteDescription || 'Portal interactivo de documentación para la implementación del SIG, ProxyManager y Anubis. Visualiza notas de forma dinámica y explora sus relaciones.';
  const homeNote = config.homeNote || 'index';
  const breadcrumbHomeText = config.breadcrumbHomeText || (config.siteTitle ? config.siteTitle.split(' ')[0] : 'SIG');

  // 1. Process and copy Template Assets to destination with placeholders replaced
  const textTemplates = ['index.html', 'app.js'];
  const binaryTemplates = ['styles.css'];

  // Process text templates (with placeholder replacement using callbacks to avoid replacement character interpretation issues)
  textTemplates.forEach(file => {
    const srcPath = path.join(templatesDir, file);
    const destPath = path.join(resolvedDest, file);

    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf8');

      // Replace placeholders
      content = content
        .replace(/{{SITE_TITLE}}/g, () => siteTitle)
        .replace(/{{SITE_DESCRIPTION}}/g, () => siteDescription)
        .replace(/{{SITE_LOGO_TEXT}}/g, () => siteLogoText)
        .replace(/{{SITE_LOGO_SUBTEXT}}/g, () => siteLogoSubtext)
        .replace(/{{HOME_NOTE}}/g, () => homeNote)
        .replace(/{{BREADCRUMB_HOME_TEXT}}/g, () => breadcrumbHomeText);

      fs.writeFileSync(destPath, content, 'utf8');
      console.log(`\x1b[32m✔ Procesada y copiada plantilla de texto: ${file}\x1b[0m`);
    } else {
      console.warn(`\x1b[33m⚠ Advertencia: Plantilla de texto no encontrada: ${file}\x1b[0m`);
    }
  });

  // Process static/binary templates (direct copy)
  binaryTemplates.forEach(file => {
    const srcPath = path.join(templatesDir, file);
    const destPath = path.join(resolvedDest, file);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`\x1b[32m✔ Copiada plantilla estática: ${file}\x1b[0m`);
    } else {
      console.warn(`\x1b[33m⚠ Advertencia: Plantilla estática no encontrada: ${file}\x1b[0m`);
    }
  });

  // 2. Scan resolvedOrigin for Markdown and Asset files
  const files = fs.readdirSync(resolvedOrigin);
  const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');
  
  // Supported web formats for copying
  const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.mp4', '.mp3'];
  const assetFiles = files.filter(f => assetExtensions.includes(path.extname(f).toLowerCase()));

  const notes = {};
  const graphNodes = [];
  const graphLinks = [];

  // Extract valid internal notes Set
  const validNotes = new Set();
  mdFiles.forEach(file => {
    const noteName = path.basename(file, '.md');
    validNotes.add(noteName);
  });

  // Parse notes contents & relations
  mdFiles.forEach(file => {
    const filePath = path.join(resolvedOrigin, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const noteName = path.basename(file, '.md');

    // Extract wikilinks
    const wikilinkRegex = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
    const links = [];
    let match;
    while ((match = wikilinkRegex.exec(content)) !== null) {
      const target = match[1].trim();
      if (validNotes.has(target) && !links.includes(target)) {
        links.push(target);
      }
    }

    // Extract Obsidian image embeds
    const imageEmbedRegex = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
    const images = [];
    while ((match = imageEmbedRegex.exec(content)) !== null) {
      const imgName = match[1].trim();
      const width = match[2] ? match[2].trim() : null;
      images.push({ name: imgName, width });
    }

    notes[noteName] = {
      title: noteName,
      content: content,
      filename: file,
      links: links,
      images: images
    };

    graphNodes.push({ id: noteName, label: noteName });
  });

  // Build connection links
  mdFiles.forEach(file => {
    const noteName = path.basename(file, '.md');
    const note = notes[noteName];
    if (note) {
      note.links.forEach(target => {
        graphLinks.push({
          source: noteName,
          target: target
        });
      });
    }
  });

  const output = {
    notes,
    graph: {
      nodes: graphNodes,
      links: graphLinks
    }
  };

  // Save compiled data database
  fs.writeFileSync(path.join(resolvedDest, 'data.json'), JSON.stringify(output, null, 2), 'utf8');
  console.log(`\x1b[32m✔ Compilado base de datos data.json con ${graphNodes.length} notas y ${graphLinks.length} conexiones.\x1b[0m`);

  // 3. Sync source images and document assets to destination folder
  let copiedAssets = 0;
  assetFiles.forEach(file => {
    const srcPath = path.join(resolvedOrigin, file);
    const destPath = path.join(resolvedDest, file);
    
    fs.copyFileSync(srcPath, destPath);
    copiedAssets++;
  });
  console.log(`\x1b[32m✔ Sincronizados ${copiedAssets} archivos de recursos (imágenes/documentos) en la carpeta de destino.\x1b[0m`);
  console.log(`\x1b[32;1m🎉 ¡Exportación completada con éxito! Visita la carpeta de destino para subirla a tu servidor.\x1b[0m\n`);

  return {
    success: true,
    notesCount: graphNodes.length,
    linksCount: graphLinks.length,
    assetsCount: copiedAssets
  };
}

// Determine if we are running directly from CLI or being imported
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = {
    originDir: '',
    destDir: '',
    siteTitle: '',
    siteLogoText: '',
    siteSubtitle: '',
    siteDescription: '',
    homeNote: ''
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o') {
      config.originDir = args[i + 1];
      i++;
    } else if (args[i] === '-d') {
      config.destDir = args[i + 1];
      i++;
    } else if (args[i] === '--title') {
      config.siteTitle = args[i + 1];
      config.siteLogoText = args[i + 1]; // CLI default logo text to title
      i++;
    } else if (args[i] === '--subtitle') {
      config.siteSubtitle = args[i + 1];
      i++;
    } else if (args[i] === '--home') {
      config.homeNote = args[i + 1];
      i++;
    } else if (args[i] === '--desc') {
      config.siteDescription = args[i + 1];
      i++;
    }
  }

  runBuild(config);
} else {
  // Export programmatic interface
  module.exports = { runBuild };
}
