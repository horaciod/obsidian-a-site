const fs = require('fs');
const path = require('path');

// CLI Arguments Parser
const args = process.argv.slice(2);
let originDir = '';
let destDir = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o') {
    originDir = args[i + 1];
    i++;
  } else if (args[i] === '-d') {
    destDir = args[i + 1];
    i++;
  }
}

if (!originDir || !destDir) {
  console.error('\x1b[31mError: Parámetros incorrectos o insuficientes.\x1b[0m');
  console.error('\x1b[33mUso correcto: node exporter-obsidian/build.js -o <carpeta_origen> -d <carpeta_destino>\x1b[0m');
  console.error('  -o : Directorio que contiene las notas Markdown (.md) y los recursos.');
  console.error('  -d : Directorio destino donde se generará la web autocontenida para producción.');
  process.exit(1);
}

const resolvedOrigin = path.resolve(originDir);
const resolvedDest = path.resolve(destDir);
const templatesDir = __dirname; // Inside exporter-obsidian/

function run() {
  console.log(`\n\x1b[36m⚡ Iniciando Exportador de Obsidian a Wiki HTML interactivo...\x1b[0m`);
  console.log(`📂 Directorio Origen: ${resolvedOrigin}`);
  console.log(`🎯 Directorio Destino: ${resolvedDest}`);

  // Validate origin
  if (!fs.existsSync(resolvedOrigin)) {
    console.error(`\x1b[31mError: El directorio de origen no existe: ${resolvedOrigin}\x1b[0m`);
    process.exit(1);
  }

  // Create destination folder recursively
  if (!fs.existsSync(resolvedDest)) {
    fs.mkdirSync(resolvedDest, { recursive: true });
    console.log(`\x1b[32m✔ Creada carpeta de destino: ${resolvedDest}\x1b[0m`);
  }

  // 1. Copy Frontend Template Assets to destination
  const templates = ['index.html', 'styles.css', 'app.js'];
  let templatesCopied = 0;
  templates.forEach(file => {
    const srcPath = path.join(templatesDir, file);
    const destPath = path.join(resolvedDest, file);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      templatesCopied++;
    } else {
      console.warn(`\x1b[33m⚠ Advertencia: Plantilla no encontrada: ${file}\x1b[0m`);
    }
  });
  console.log(`\x1b[32m✔ Copiadas ${templatesCopied}/${templates.length} plantillas de interfaz a destino.\x1b[0m`);

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
}

run();
