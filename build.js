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
 * @param {boolean} [config.includeOrphans] Whether to include orphan notes (default: true).
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
    console.error('  --title       : Título del sitio web (para <title> y el panel lateral).');
    console.error('  --subtitle    : Subtítulo o texto descriptivo en el panel lateral.');
    console.error('  --home        : Nota de inicio (sin extensión .md, ej. "Home" o "README").');
    console.error('  --desc        : Meta descripción para SEO.');
    console.error('  --no-orphans  : Excluir las notas huérfanas (sin enlaces entrantes) del sitio generado.');
    
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
  const includeOrphans = config.includeOrphans !== false; // default to true

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

  // 2. Scan resolvedOrigin recursively up to 4 levels of depth
  const mdFiles = [];     // Array of objects: { relativePath, absolutePath, noteName }
  const assetFiles = [];  // Array of objects: { relativePath, absolutePath, filename }
  
  // Supported web formats for copying
  const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.mp4', '.mp3'];
  const ignoredDirs = new Set(['.git', 'node_modules', '.obsidian', 'wiki-dist', 'dist', 'dist-test', 'dist-test-custom', path.basename(resolvedDest)]);

  function walk(currentDir, depth = 0) {
    if (depth > 4) return;

    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      const absPath = path.join(currentDir, item.name);
      const relPath = path.relative(resolvedOrigin, absPath);

      if (item.isDirectory()) {
        if (ignoredDirs.has(item.name) || absPath === resolvedDest) continue;
        walk(absPath, depth + 1);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (ext === '.md') {
          // Ignore the root README.md specifically
          if (relPath === 'README.md') continue;

          const noteName = path.basename(item.name, '.md');
          mdFiles.push({
            relativePath: relPath,
            absolutePath: absPath,
            noteName: noteName
          });
        } else if (assetExtensions.includes(ext)) {
          assetFiles.push({
            relativePath: relPath,
            absolutePath: absPath,
            filename: item.name
          });
        }
      }
    }
  }

  // Start walking origin folder recursively
  walk(resolvedOrigin, 0);
  console.log(`\x1b[32m✔ Escaneo completado: detectados ${mdFiles.length} archivos Markdown y ${assetFiles.length} recursos hasta 4 niveles de profundidad.\x1b[0m`);

  const notes = {};
  const graphNodes = [];
  const graphLinks = [];

  // Extract valid internal notes Set
  const validNotes = new Set();
  mdFiles.forEach(info => {
    validNotes.add(info.noteName);
  });

  // Parse notes contents & relations
  mdFiles.forEach(info => {
    const filePath = info.absolutePath;
    const content = fs.readFileSync(filePath, 'utf8');
    const noteName = info.noteName;

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
      filename: info.relativePath, // Keep relative path in database
      links: links,
      images: images,
      isOrphan: false // Will be updated below
    };
  });

  // Calculate incoming links (in-degree) for each note to find orphans
  const inDegree = {};
  validNotes.forEach(noteName => {
    inDegree[noteName] = 0;
  });

  Object.keys(notes).forEach(noteName => {
    const note = notes[noteName];
    note.links.forEach(target => {
      if (inDegree[target] !== undefined) {
        inDegree[target]++;
      }
    });
  });

  // Filter and build final notes
  const finalNotes = {};
  const activeValidNotes = new Set();

  Object.keys(notes).forEach(noteName => {
    const note = notes[noteName];
    const isOrphan = (inDegree[noteName] === 0 && noteName !== homeNote);

    if (isOrphan) {
      note.isOrphan = true;
      if (!includeOrphans) {
        // Skip compile if we don't want orphans
        return;
      }
    }

    finalNotes[noteName] = note;
    activeValidNotes.add(noteName);
    graphNodes.push({ 
      id: noteName, 
      label: noteName,
      isOrphan: note.isOrphan
    });
  });

  // Build connection links (filtering only included notes)
  Object.keys(finalNotes).forEach(noteName => {
    const note = finalNotes[noteName];
    note.links.forEach(target => {
      if (activeValidNotes.has(target)) {
        graphLinks.push({
          source: noteName,
          target: target
        });
      }
    });
  });

  const output = {
    notes: finalNotes,
    graph: {
      nodes: graphNodes,
      links: graphLinks
    }
  };

  // Save compiled data database
  fs.writeFileSync(path.join(resolvedDest, 'data.json'), JSON.stringify(output, null, 2), 'utf8');
  console.log(`\x1b[32m✔ Compilado base de datos data.json con ${graphNodes.length} notas y ${graphLinks.length} conexiones. (${mdFiles.length - graphNodes.length} notas huérfanas filtradas).\x1b[0m`);

  // 3. Sync source images and document assets to destination folder (flat copying)
  let copiedAssets = 0;
  assetFiles.forEach(info => {
    const srcPath = info.absolutePath;
    const destPath = path.join(resolvedDest, info.filename);
    
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
    homeNote: '',
    includeOrphans: true
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
    } else if (args[i] === '--no-orphans') {
      config.includeOrphans = false;
    } else if (args[i] === '--orphans') {
      config.includeOrphans = true;
    }
  }

  runBuild(config);
} else {
  // Export programmatic interface
  module.exports = { runBuild };
}
