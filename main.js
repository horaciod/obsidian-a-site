const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');
const path = require('path');
const fs = require('fs');

const DEFAULT_SETTINGS = {
  originDir: '',
  destDir: '',
  siteTitle: 'Mi Obsidian Wiki',
  siteSubtitle: 'Notas y Relaciones',
  siteDescription: 'Portal interactivo de notas exportadas desde mi bóveda de Obsidian.',
  homeNote: 'index'
};

class ObsidianSitePlugin extends Plugin {
  async onload() {
    console.log('Cargando plugin Obsidian-a-Site');
    await this.loadSettings();

    // Ribbon icon on left bar
    this.addRibbonIcon('share-2', 'Exportar Wiki Estática (Obsidian-a-Site)', () => {
      this.buildSite();
    });

    // Register Command in Command Palette
    this.addCommand({
      id: 'build-static-wiki',
      name: 'Compilar y Exportar Wiki Estática',
      callback: () => {
        this.buildSite();
      }
    });

    // Add Settings Tab
    this.addSettingTab(new ObsidianSiteSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
        homeNote: this.settings.homeNote
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
  }
}

module.exports = ObsidianSitePlugin;
