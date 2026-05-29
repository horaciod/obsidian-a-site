const { Plugin, PluginSettingTab, Setting, Notice, Modal, TFolder } = require('obsidian');
const path = require('path');
const fs = require('fs');

const DEFAULT_SETTINGS = {
  originDir: '',
  destDir: '',
  siteTitle: 'Mi Obsidian Wiki',
  siteSubtitle: 'Notas y Relaciones',
  siteDescription: 'Portal interactivo de notas exportadas desde mi bóveda de Obsidian.',
  homeNote: 'index',
  includeOrphans: true
};

class ObsidianSitePlugin extends Plugin {
  async onload() {
    console.log('Cargando plugin Obsidian-a-Site');
    await this.loadSettings();

    // Ribbon icon on left bar
    this.addRibbonIcon('share-2', 'Exportar Wiki Estática (Obsidian-a-Site)', () => {
      this.openExportModal();
    });

    // Register Command in Command Palette
    this.addCommand({
      id: 'build-static-wiki',
      name: 'Compilar y Exportar Wiki Estática',
      callback: () => {
        this.openExportModal();
      }
    });

    // Add Settings Tab
    this.addSettingTab(new ObsidianSiteSettingTab(this.app, this));

    // Register context menu for File Explorer folders
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle('⚡ Exportar carpeta como Wiki')
              .setIcon('share-2')
              .onClick(() => {
                this.openExportModalForFolder(file.path);
              });
          });
        }
      })
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  openExportModal() {
    new ExportModal(this.app, this).open();
  }

  openExportModalForFolder(folderPath) {
    const modal = new ExportModal(this.app, this);
    // Pre-populate Origin Directory with the right-clicked folder path
    // If it's the root '/', leave it empty so it defaults to the whole vault
    modal.settings.originDir = folderPath === '/' ? '' : folderPath;
    modal.open();
  }

  async buildSite() {
    const vaultPath = this.app.vault.adapter.getBasePath();
    
    // Resolve origin directory
    let originDir = this.settings.originDir.trim();
    if (!originDir) {
      originDir = vaultPath;
    } else if (!path.isAbsolute(originDir)) {
      originDir = path.resolve(vaultPath, originDir);
    }

    // Resolve destination directory
    let destDir = this.settings.destDir.trim();
    if (!destDir) {
      destDir = path.join(vaultPath, 'wiki-dist');
    } else if (!path.isAbsolute(destDir)) {
      destDir = path.resolve(vaultPath, destDir);
    }

    // Show export notification
    new Notice('⚡ Obsidian-a-Site: Iniciando exportación...');

    // Resolve build.js path dynamically based on vault path and plugin directory
    const pluginPath = path.join(vaultPath, this.manifest.dir);
    const buildScriptPath = path.join(pluginPath, 'build.js');
    
    // Avoid require cache in Node.js/Electron for dynamic script updates
    if (require.cache[buildScriptPath]) {
      delete require.cache[buildScriptPath];
    }

    let runBuild;
    try {
      // Try standard Node require with dynamic absolute path
      const buildModule = require(buildScriptPath);
      runBuild = buildModule.runBuild;
    } catch (e) {
      // Fallback: try window.require (original Electron Node require)
      try {
        const buildModule = (typeof window !== 'undefined' && window.require)
          ? window.require(buildScriptPath)
          : require('./build.js');
        runBuild = buildModule.runBuild;
      } catch (e2) {
        console.error('Error loading build.js:', e, e2);
        new Notice(`❌ Error: No se pudo cargar el script de compilación build.js.\nAsegúrate de que build.js existe en: ${buildScriptPath}`, 10000);
        return;
      }
    }

    try {
      // Run compiler programmatically
      const result = runBuild({
        originDir,
        destDir,
        siteTitle: this.settings.siteTitle,
        siteSubtitle: this.settings.siteSubtitle,
        siteDescription: this.settings.siteDescription,
        homeNote: this.settings.homeNote,
        includeOrphans: this.settings.includeOrphans
      });

      if (result && result.success) {
        new Notice(`🎉 ¡Exportación exitosa!\nNotas compiladas: ${result.notesCount}\nGuardado en: ${destDir}`, 8000);
      } else {
        new Notice('⚠ La exportación terminó, pero no retornó confirmación.');
      }
    } catch (error) {
      console.error('Error durante la exportación de Obsidian-a-Site:', error);
      new Notice(`❌ Error en exportación:\n${error.message}`, 10000);
    }
  }
}

class ObsidianSiteSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Ajustes de Obsidian-a-Site' });
    containerEl.createEl('p', { 
      text: 'Configura las carpetas de compilación, título de la web y la página inicial para tu exportación Glassmorphism.',
      cls: 'setting-item-description'
    });

    // 1. Origin Directory setting
    new Setting(containerEl)
      .setName('Directorio de Notas (.md)')
      .setDesc('Ruta absoluta o relativa del origen de las notas. Si se deja en blanco, se exportará toda tu bóveda de Obsidian.')
      .addText(text => text
        .setPlaceholder('Ej: notas/o dejar vacío')
        .setValue(this.plugin.settings.originDir)
        .onChange(async (value) => {
          this.plugin.settings.originDir = value;
          await this.plugin.saveSettings();
        })
      );

    // 2. Destination Directory setting
    new Setting(containerEl)
      .setName('Directorio de Salida (Web)')
      .setDesc('Ruta de salida absoluta o relativa para las páginas web compiladas. Si se deja vacío se creará la carpeta "wiki-dist" dentro de tu bóveda.')
      .addText(text => text
        .setPlaceholder('Ej: /var/www/mi-wiki o wiki-dist')
        .setValue(this.plugin.settings.destDir)
        .onChange(async (value) => {
          this.plugin.settings.destDir = value;
          await this.plugin.saveSettings();
        })
      );

    // 3. Site Title setting
    new Setting(containerEl)
      .setName('Título del Sitio')
      .setDesc('Título principal que se mostrará en el encabezado y en el título HTML (<title>).')
      .addText(text => text
        .setPlaceholder('Ej: Mi Wiki Personal')
        .setValue(this.plugin.settings.siteTitle)
        .onChange(async (value) => {
          this.plugin.settings.siteTitle = value;
          await this.plugin.saveSettings();
        })
      );

    // 4. Site Subtitle / Logo Subtext setting
    new Setting(containerEl)
      .setName('Subtítulo del Sitio')
      .setDesc('Texto corto descriptivo debajo del título principal en el panel lateral.')
      .addText(text => text
        .setPlaceholder('Ej: Documentos y Enlaces')
        .setValue(this.plugin.settings.siteSubtitle)
        .onChange(async (value) => {
          this.plugin.settings.siteSubtitle = value;
          await this.plugin.saveSettings();
        })
      );

    // 5. Site SEO Meta Description setting
    new Setting(containerEl)
      .setName('Descripción SEO Meta')
      .setDesc('Descripción meta para SEO usada en la cabecera de las páginas web.')
      .addText(text => text
        .setPlaceholder('Ej: Portal interactivo de notas estáticas...')
        .setValue(this.plugin.settings.siteDescription)
        .onChange(async (value) => {
          this.plugin.settings.siteDescription = value;
          await this.plugin.saveSettings();
        })
      );

    // 6. Home Note / Landing Note setting
    new Setting(containerEl)
      .setName('Página Inicial / Nota Inicial')
      .setDesc('El nombre del archivo Markdown (ID de la nota sin extensión .md) que servirá como portada de aterrizaje por defecto.')
      .addText(text => text
        .setPlaceholder('Ej: index o Home o README')
        .setValue(this.plugin.settings.homeNote)
        .onChange(async (value) => {
          this.plugin.settings.homeNote = value;
          await this.plugin.saveSettings();
        })
      );

    // 7. Include Orphans setting
    new Setting(containerEl)
      .setName('Incluir Notas Huérfanas')
      .setDesc('Si se activa, se incluirán las notas que no tienen enlaces entrantes en tu bóveda. Si se desactiva, se excluirán por completo de la wiki.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeOrphans)
        .onChange(async (value) => {
          this.plugin.settings.includeOrphans = value;
          await this.plugin.saveSettings();
        })
      );
  }
}

class ExportModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    // Clone settings locally for temporary editing
    this.settings = Object.assign({}, plugin.settings);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '⚡ Exportar Wiki Estática' });
    contentEl.createEl('p', { 
      text: 'Configura o valida las siguientes opciones antes de ejecutar la compilación de tu sitio web.',
      cls: 'setting-item-description'
    });

    // 1. Origin Directory setting
    new Setting(contentEl)
      .setName('Directorio de Notas (.md)')
      .setDesc('Origen de notas. Vacío para exportar toda tu bóveda.')
      .addText(text => text
        .setPlaceholder('Ej: notas/ o dejar vacío')
        .setValue(this.settings.originDir)
        .onChange(value => this.settings.originDir = value)
      );

    // 2. Destination Directory setting
    new Setting(contentEl)
      .setName('Directorio de Salida (Web)')
      .setDesc('Destino de la web. Vacío para usar la carpeta "wiki-dist" en tu bóveda.')
      .addText(text => text
        .setPlaceholder('Ej: /var/www/wiki o wiki-dist')
        .setValue(this.settings.destDir)
        .onChange(value => this.settings.destDir = value)
      );

    // 3. Site Title setting
    new Setting(contentEl)
      .setName('Título del Sitio')
      .setDesc('Título principal en el encabezado y barra de título.')
      .addText(text => text
        .setPlaceholder('Ej: Mi Wiki')
        .setValue(this.settings.siteTitle)
        .onChange(value => this.settings.siteTitle = value)
      );

    // 4. Site Subtitle setting
    new Setting(contentEl)
      .setName('Subtítulo del Sitio')
      .setDesc('Subtexto descriptivo lateral.')
      .addText(text => text
        .setPlaceholder('Ej: Notas y Enlaces')
        .setValue(this.settings.siteSubtitle)
        .onChange(value => this.settings.siteSubtitle = value)
      );

    // 5. Site SEO Meta Description setting
    new Setting(contentEl)
      .setName('Descripción SEO Meta')
      .addText(text => text
        .setPlaceholder('Ej: Portal de notas...')
        .setValue(this.settings.siteDescription)
        .onChange(value => this.settings.siteDescription = value)
      );

    // 6. Home Note / Landing Note setting
    new Setting(contentEl)
      .setName('Página Inicial')
      .setDesc('Nombre de la nota inicial (sin extensión .md).')
      .addText(text => text
        .setPlaceholder('Ej: index')
        .setValue(this.settings.homeNote)
        .onChange(value => this.settings.homeNote = value)
      );

    // 7. Include Orphans setting
    new Setting(contentEl)
      .setName('Incluir Notas Huérfanas')
      .setDesc('Incluir notas desconectadas sin enlaces entrantes en el compilado.')
      .addToggle(toggle => toggle
        .setValue(this.settings.includeOrphans)
        .onChange(value => this.settings.includeOrphans = value)
      );

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '20px';

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancelar' });
    cancelBtn.addEventListener('click', () => this.close());

    const exportBtn = buttonContainer.createEl('button', { 
      text: '⚡ Exportar y Compilar', 
      cls: 'mod-cta' 
    });
    exportBtn.addEventListener('click', async () => {
      // Save settings to plugin
      this.plugin.settings = Object.assign(this.plugin.settings, this.settings);
      await this.plugin.saveSettings();
      
      // Close modal
      this.close();
      
      // Run export
      this.plugin.buildSite();
    });
  }
}

module.exports = ObsidianSitePlugin;
