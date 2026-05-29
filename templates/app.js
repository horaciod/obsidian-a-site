/**
 * SIG Wiki - Interactive Client-Side Engine
 * Features: SPA Navigation, Obsidian-style Wikilinks parser, Prism highlights,
 * custom physics-based Canvas graph, and View Transitions API animations.
 */

// Application State
const state = {
  notes: {},       // Notes directory map
  graph: { nodes: [], links: [] }, // Graph visualization nodes & edges
  activeNoteId: '{{HOME_NOTE}}',           // Default landing note
  searchQuery: '',                 // Current search string
};

// Physics Simulation Constants
const PHYSICS = {
  repulsion: 1500,     // Repulsion strength between nodes
  linkStrength: 0.08,   // Attraction strength of link edges
  linkDistance: 120,    // Desired link distance
  gravity: 0.02,       // Pull towards canvas center
  damping: 0.85,       // Velocity friction (0-1)
  nodeRadius: 8,       // Base radius of note nodes
  activeNodeRadius: 12, // Radius of currently viewed node
  minSpeedToSimulate: 0.01 // Speed threshold to pause calculation (performance)
};

// Canvas Engine State
const graphState = {
  canvas: null,
  ctx: null,
  nodes: [],
  links: [],
  panX: 0,
  panY: 0,
  zoom: 1,
  draggedNode: null,
  hoveredNode: null,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  isSimulating: true,
  width: 0,
  height: 0
};

// Initialize Application on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

/**
 * Main Initialization Pipeline
 */
async function initApp() {
  try {
    // 1. Fetch raw database compile with cache busting
    const response = await fetch(`data.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('No se pudo cargar data.json');
    
    const db = await response.json();
    state.notes = db.notes;
    state.graph = db.graph;

    // 2. Setup Lucide Icons
    lucide.createIcons();

    // 3. Initialize interactive DOM listeners
    setupEventListeners();

    // 4. Populate note navigation list
    renderNotesList();

    // 5. Parse window hash or load default landing note
    const initialHash = window.location.hash ? decodeURIComponent(window.location.hash.substring(1)) : '{{HOME_NOTE}}';
    const startNote = state.notes[initialHash] ? initialHash : '{{HOME_NOTE}}';
    
    // Initial DOM update (without transition on load)
    updateActiveNoteDOM(startNote);

    // 6. Initialize Canvas Node Graph
    initGraph();

    // 7. Update status label
    document.getElementById('statsLabel').textContent = `${Object.keys(state.notes).length} documentos listos`;
  } catch (error) {
    console.error('Inicialización de Wiki fallida:', error);
    document.getElementById('noteBody').innerHTML = `
      <div class="empty-state" style="border-color: var(--error); color: var(--error);">
        <p><strong>Error cargando la base de conocimiento interactiva:</strong></p>
        <p>${error.message}</p>
        <p style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">
          Asegúrate de haber ejecutado <code>node build.js</code> para compilar la base de datos y estar sirviendo los archivos a través de un servidor HTTP local.
        </p>
      </div>
    `;
  }
}

/**
 * Setup Global UI and Event Listeners
 */
function setupEventListeners() {
  // Sidebar toggles
  const sidebar = document.getElementById('sidebar');
  const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
  const sidebarTrigger = document.getElementById('sidebarTrigger');
  
  sidebarCollapseBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    sidebarTrigger.style.display = 'flex';
    // Trigger graph canvas resize to match new spacing
    setTimeout(resizeCanvas, 310);
  });

  sidebarTrigger.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    sidebarTrigger.style.display = 'none';
    setTimeout(resizeCanvas, 310);
  });

  // Graph panel toggle
  const graphPanel = document.getElementById('graphPanel');
  const toggleGraphBtn = document.getElementById('toggleGraphBtn');
  const closeGraphBtn = document.getElementById('closeGraphBtn');

  toggleGraphBtn.addEventListener('click', () => {
    graphPanel.classList.toggle('collapsed');
    setTimeout(resizeCanvas, 310);
  });

  closeGraphBtn.addEventListener('click', () => {
    graphPanel.classList.add('collapsed');
    setTimeout(resizeCanvas, 310);
  });

  // Search filter inputs
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    if (state.searchQuery) {
      clearSearchBtn.style.display = 'block';
    } else {
      clearSearchBtn.style.display = 'none';
    }
    renderNotesList();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderNotesList();
    searchInput.focus();
  });

  // Graph centering control
  document.getElementById('graphResetBtn').addEventListener('click', centerGraph);

  // Keyboard accessibility listeners (e.g. closing lightbox via Escape)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
    }
  });

  // Handle SPA history back/forward operations
  window.addEventListener('popstate', (e) => {
    const noteId = window.location.hash ? decodeURIComponent(window.location.hash.substring(1)) : '{{HOME_NOTE}}';
    if (state.notes[noteId]) {
      navigateTo(noteId, false);
    }
  });

  // Lightbox close button
  document.getElementById('lightboxCloseBtn').addEventListener('click', closeLightbox);
  document.getElementById('imageLightbox').addEventListener('click', (e) => {
    if (e.target.id === 'imageLightbox') {
      closeLightbox();
    }
  });
}

/**
 * Handle SPA navigation wrapper (View Transitions API integrated)
 * @param {string} targetNoteId 
 * @param {boolean} pushState Whether to add record to browser history
 */
function navigateTo(targetNoteId, pushState = true) {
  if (!state.notes[targetNoteId]) return;
  if (state.activeNoteId === targetNoteId) return;

  state.activeNoteId = targetNoteId;

  // History management
  if (pushState) {
    window.history.pushState({ noteId: targetNoteId }, '', `#${encodeURIComponent(targetNoteId)}`);
  }

  // Check support for View Transitions API
  if (!document.startViewTransition) {
    updateActiveNoteDOM(targetNoteId);
    triggerA11yFocus();
    wakeSimulation();
  } else {
    // Elegant transition morphing
    const transition = document.startViewTransition(() => {
      updateActiveNoteDOM(targetNoteId);
    });
    
    transition.finished.finally(() => {
      triggerA11yFocus();
      wakeSimulation();
    });
  }
}

/**
 * Set programmatic screen reader focus to active note title for a11y compatibility
 */
function triggerA11yFocus() {
  const noteTitle = document.getElementById('noteTitle');
  if (noteTitle) noteTitle.focus();
}

/**
 * Perform note list rendering with matching filters
 */
function renderNotesList() {
  const notesList = document.getElementById('notesList');
  notesList.innerHTML = '';

  const listItems = Object.keys(state.notes)
    .sort()
    .filter(noteId => {
      if (!state.searchQuery) return true;
      const note = state.notes[noteId];
      return note.title.toLowerCase().includes(state.searchQuery) ||
             note.content.toLowerCase().includes(state.searchQuery);
    });

  if (listItems.length === 0) {
    notesList.innerHTML = `
      <li class="empty-state" style="border-style: none; text-align: center;">
        No hay coincidencias
      </li>
    `;
    return;
  }

  listItems.forEach(noteId => {
    const note = state.notes[noteId];
    const li = document.createElement('li');
    
    const a = document.createElement('a');
    a.className = `notes-item ${noteId === state.activeNoteId ? 'active' : ''} ${note.isOrphan ? 'is-orphan' : ''}`;
    a.href = `#${encodeURIComponent(noteId)}`;
    
    const orphanBadge = note.isOrphan 
      ? ' <i data-lucide="link-2-off" class="orphan-indicator-icon" title="Nota huérfana (sin enlaces entrantes)" style="width: 13px; height: 13px; margin-left: auto;"></i>' 
      : '';
    a.innerHTML = `<i data-lucide="file"></i> <span>${note.title}</span>${orphanBadge}`;
    
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(noteId);
    });

    li.appendChild(a);
    notesList.appendChild(li);
  });

  lucide.createIcons({ attrs: { class: 'notes-item-icon' } });
}

/**
 * Core rendering pipeline of raw note contents into structured HTML elements
 * Handles markdown formatting, custom wikilinks and Obsidian images embeds.
 */
function updateActiveNoteDOM(noteId) {
  const note = state.notes[noteId];
  if (!note) return;

  // Sync state values
  state.activeNoteId = noteId;

  // Highlight active sidebar item
  document.querySelectorAll('.notes-item').forEach(item => {
    const isCurrent = item.getAttribute('href') === `#${encodeURIComponent(noteId)}`;
    item.classList.toggle('active', isCurrent);
  });

  // Update Breadcrumbs
  document.getElementById('currentBreadcrumb').textContent = note.title;

  // Render main titles
  document.getElementById('noteTitle').textContent = note.title;
  document.getElementById('noteFilename').textContent = note.filename;

  // Custom pre-processor for Obsidian Markdown structures before feeding to marked
  let processedMarkdown = note.content;

  // 1. Double bracket wikilinks: [[Note Name]] or [[Note Name|Display Label]]
  // Replace with standard links targeting SPA action triggers
  processedMarkdown = processedMarkdown.replace(/(?<!\!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (match, noteTarget, customLabel) => {
    const targetName = noteTarget.trim();
    const label = customLabel ? customLabel.trim() : targetName;
    
    if (state.notes[targetName]) {
      return `<a href="#" class="wikilink" data-target="${targetName}">${label}</a>`;
    } else {
      // Dead link display
      return `<span class="wikilink dead-link" title="La nota '${targetName}' aún no ha sido creada">${label}</span>`;
    }
  });

  // 2. Obsidian image embeds: ![[Image.png]] or ![[Image.png|width]]
  processedMarkdown = processedMarkdown.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, imgName, size) => {
    const name = imgName.trim();
console.log(name);
    const widthStyle = size ? `style="width: 100%; max-width: ${size.trim()}px; height: auto;"` : 'style="height: auto;"';
    return `<img src="${name}" alt="${name}" class="embedded-image" ${widthStyle} />`;
  });

  // Render markdown HTML utilizing marked library
  const bodyContainer = document.getElementById('noteBody');
  
  if (window.marked) {
    bodyContainer.innerHTML = marked.parse(processedMarkdown);
  } else {
    // Robust fallback string conversion in case CDN fails
    bodyContainer.innerHTML = `<pre>${processedMarkdown}</pre>`;
  }

  // 3. Apply Prism Syntax Highlights to code blocks
  if (window.Prism) {
    Prism.highlightAllUnder(bodyContainer);
    
    // Add beautiful wrappers and copy buttons for code blocks
    document.querySelectorAll('.markdown-body pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.innerHTML = `<i data-lucide="copy" style="width: 13px; height: 13px;"></i> Copiar`;
      wrapper.appendChild(copyBtn);

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(code.innerText).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `<i data-lucide="check" style="width: 13px; height: 13px;"></i> ¡Copiado!`;
          lucide.createIcons();
          
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `<i data-lucide="copy" style="width: 13px; height: 13px;"></i> Copiar`;
            lucide.createIcons();
          }, 2000);
        });
      });
    });
  }

  // Attach navigation listeners for dynamically created wikilinks in content
  bodyContainer.querySelectorAll('a.wikilink[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      navigateTo(target);
    });
  });

  // Attach Lightbox click triggers to images
  bodyContainer.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => {
      openLightbox(img.src, img.alt || 'Visualización de documento');
    });
  });

  // 4. Calculate Backlinks & Outgoing links
  updateRelationsPanel(noteId);

  // Setup lucide icons on dynamic content elements
  lucide.createIcons();
}

/**
 * Compiles and lists connections dynamically on active note page footer
 */
function updateRelationsPanel(noteId) {
  const currentNote = state.notes[noteId];
  const backlinksList = document.getElementById('backlinksList');
  const outgoingLinksList = document.getElementById('outgoingLinksList');

  // Backlinks
  backlinksList.innerHTML = '';
  const backlinks = Object.keys(state.notes).filter(nId => {
    return state.notes[nId].links.includes(noteId);
  });

  if (backlinks.length === 0) {
    backlinksList.innerHTML = `<li class="empty-state">Ningún documento conecta con esta nota.</li>`;
  } else {
    backlinks.forEach(bId => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="#" class="relation-item-link" data-target="${bId}">
          <i data-lucide="file-text"></i>
          <span>${state.notes[bId].title}</span>
        </a>
      `;
      li.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(bId);
      });
      backlinksList.appendChild(li);
    });
  }

  // Outgoing Links
  outgoingLinksList.innerHTML = '';
  if (!currentNote.links || currentNote.links.length === 0) {
    outgoingLinksList.innerHTML = `<li class="empty-state">Esta nota no contiene enlaces salientes.</li>`;
  } else {
    currentNote.links.forEach(oId => {
      if (!state.notes[oId]) return; // Safeguard if invalid
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="#" class="relation-item-link" data-target="${oId}">
          <i data-lucide="file-text"></i>
          <span>${state.notes[oId].title}</span>
        </a>
      `;
      li.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(oId);
      });
      outgoingLinksList.appendChild(li);
    });
  }
}

/**
 * Fullscreen Image Lightbox controls
 */
function openLightbox(src, alt) {
  const lightbox = document.getElementById('imageLightbox');
  const img = document.getElementById('lightboxImage');
  const caption = document.getElementById('lightboxCaption');

  img.src = src;
  caption.textContent = alt;
  
  lightbox.classList.add('active');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // Lock scrolling
  document.getElementById('lightboxCloseBtn').focus();
}

function closeLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  if (!lightbox.classList.contains('active')) return;

  lightbox.classList.remove('active');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; // Unlock scrolling
}

// ==========================================================================
// Physics-Based Interactive Canvas Node Graph Engine
// ==========================================================================

function initGraph() {
  graphState.canvas = document.getElementById('graphCanvas');
  graphState.ctx = graphState.canvas.getContext('2d');

  // Load Graph Data
  const sourceNodes = state.graph.nodes;
  const sourceLinks = state.graph.links;

  // Instanciate simulation objects with physical attributes
  graphState.nodes = sourceNodes.map((n, i) => {
    // Arrange in circle to avoid initial overlapping collapse
    const angle = (i / sourceNodes.length) * Math.PI * 2;
    const r = 100;
    return {
      id: n.id,
      label: n.label,
      isOrphan: n.isOrphan,
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      vx: 0,
      vy: 0,
      radius: PHYSICS.nodeRadius
    };
  });

  // Map string pointers to actual node object references
  graphState.links = sourceLinks.map(l => {
    return {
      source: graphState.nodes.find(n => n.id === l.source),
      target: graphState.nodes.find(n => n.id === l.target)
    };
  }).filter(l => l.source && l.target); // Safeguard

  // Attach Canvas Listeners
  setupCanvasListeners();

  // Resize canvas for high DPI
  resizeCanvas();

  // Draw initial state & run physics Loop
  centerGraph();
  requestAnimationFrame(simulationLoop);
}

/**
 * Handle High-DPI screens and canvas scaling resizing
 */
function resizeCanvas() {
  const container = document.getElementById('canvasContainer');
  if (!container || !graphState.canvas) return;

  const rect = container.getBoundingClientRect();
  graphState.width = rect.width;
  graphState.height = rect.height;

  // Scale for retina displays
  const dpr = window.devicePixelRatio || 1;
  graphState.canvas.width = rect.width * dpr;
  graphState.canvas.height = rect.height * dpr;
  
  graphState.ctx.scale(dpr, dpr);
  
  wakeSimulation();
}

// Keep resize synchronized with window dimensions
window.addEventListener('resize', resizeCanvas);

/**
 * Coordinates graph offset to center layout smoothly
 */
function centerGraph() {
  graphState.panX = graphState.width / 2;
  graphState.panY = graphState.height / 2;
  graphState.zoom = 1;
  updateZoomIndicator();
  wakeSimulation();
}

function updateZoomIndicator() {
  const indicator = document.getElementById('zoomIndicator');
  if (indicator) {
    indicator.textContent = `${Math.round(graphState.zoom * 100)}%`;
  }
}

/**
 * Canvas Drag, Hover, Zoom, and Pan events
 */
function setupCanvasListeners() {
  const canvas = graphState.canvas;

  // Transform coordinates from Screen to Simulated Canvas space
  function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - graphState.panX) / graphState.zoom;
    const y = (event.clientY - rect.top - graphState.panY) / graphState.zoom;
    return { x, y };
  }

  canvas.addEventListener('mousedown', (e) => {
    const coords = getCanvasCoords(e);
    
    // Check if clicked inside any node circle
    const clickedNode = graphState.nodes.find(node => {
      const radius = node.id === state.activeNoteId ? PHYSICS.activeNodeRadius : PHYSICS.nodeRadius;
      const dx = node.x - coords.x;
      const dy = node.y - coords.y;
      return (dx * dx + dy * dy) < (radius + 6) * (radius + 6); // Add 6px click padding
    });

    if (clickedNode) {
      graphState.draggedNode = clickedNode;
      wakeSimulation();
    } else {
      // Initiate canvas panning
      graphState.isPanning = true;
      graphState.panStartX = e.clientX - graphState.panX;
      graphState.panStartY = e.clientY - graphState.panY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!graphState.canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    if (graphState.draggedNode) {
      // Keep node stuck to drag coordinates
      const coords = getCanvasCoords(e);
      graphState.draggedNode.x = coords.x;
      graphState.draggedNode.y = coords.y;
      graphState.draggedNode.vx = 0;
      graphState.draggedNode.vy = 0;
      wakeSimulation();
    } else if (graphState.isPanning) {
      // Pan canvas offset
      graphState.panX = e.clientX - graphState.panStartX;
      graphState.panY = e.clientY - graphState.panStartY;
      wakeSimulation();
    } else {
      // Hover detection
      const coords = getCanvasCoords(e);
      const hoverNode = graphState.nodes.find(node => {
        const radius = node.id === state.activeNoteId ? PHYSICS.activeNodeRadius : PHYSICS.nodeRadius;
        const dx = node.x - coords.x;
        const dy = node.y - coords.y;
        return (dx * dx + dy * dy) < (radius + 6) * (radius + 6);
      });

      if (hoverNode !== graphState.hoveredNode) {
        graphState.hoveredNode = hoverNode;
        canvas.style.cursor = hoverNode ? 'pointer' : (graphState.isPanning ? 'grabbing' : 'grab');
        wakeSimulation();
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (graphState.draggedNode) {
      // Trigger navigation if dragging was minimal (essentially a click)
      const coords = getCanvasCoords(e);
      const dx = graphState.draggedNode.x - coords.x;
      const dy = graphState.draggedNode.y - coords.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 3) {
        navigateTo(graphState.draggedNode.id);
      }
      
      graphState.draggedNode = null;
    }
    graphState.isPanning = false;
  });

  // Wheel zoom controls
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // Zoom focus remains under mouse cursor
    const mouseX = e.clientX - canvas.getBoundingClientRect().left;
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;
    
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(graphState.zoom * zoomFactor, 0.3), 3.0);
    
    // Smooth zoom adjustment
    graphState.panX = mouseX - (mouseX - graphState.panX) * (newZoom / graphState.zoom);
    graphState.panY = mouseY - (mouseY - graphState.panY) * (newZoom / graphState.zoom);
    graphState.zoom = newZoom;
    
    updateZoomIndicator();
    wakeSimulation();
  });
}

/**
 * Wake simulation calculations from sleep mode
 */
function wakeSimulation() {
  if (!graphState.isSimulating) {
    graphState.isSimulating = true;
    requestAnimationFrame(simulationLoop);
  }
}

/**
 * Core physics and render loop (requestAnimationFrame run)
 */
function simulationLoop() {
  if (!graphState.canvas) return;

  // 1. Calculate Custom Forces (Coulomb / Hooke)
  let totalSpeed = 0;

  if (graphState.isSimulating) {
    const nodes = graphState.nodes;
    const links = graphState.links;

    // Node Repulsion Force (Coulomb's Law style)
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy + 0.1; // Offset to prevent divide-by-zero
        const dist = Math.sqrt(distSq);

        if (dist < 300) {
          // Push force
          const force = PHYSICS.repulsion / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (n1 !== graphState.draggedNode) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (n2 !== graphState.draggedNode) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }
    }

    // Link Tension Forces (Hooke's Law style attraction)
    links.forEach(l => {
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      
      const force = (dist - PHYSICS.linkDistance) * PHYSICS.linkStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (l.source !== graphState.draggedNode) {
        l.source.vx += fx;
        l.source.vy += fy;
      }
      if (l.target !== graphState.draggedNode) {
        l.target.vx -= fx;
        l.target.vy -= fy;
      }
    });

    // Central Gravity and Friction Damping Apply
    nodes.forEach(n => {
      if (n === graphState.draggedNode) return;

      // Weak gravity force pulling to center
      n.vx -= n.x * PHYSICS.gravity;
      n.vy -= n.y * PHYSICS.gravity;

      // Apply velocities
      n.x += n.vx;
      n.y += n.vy;

      // Damp velocities
      n.vx *= PHYSICS.damping;
      n.vy *= PHYSICS.damping;

      // Accruing motion indicator to decide sleep threshold
      totalSpeed += Math.sqrt(n.vx * n.vx + n.vy * n.vy);
    });

    // Performance Sleep: Stop calculations if movement is microscopic
    if (totalSpeed < PHYSICS.minSpeedToSimulate && !graphState.draggedNode) {
      graphState.isSimulating = false;
    }
  }

  // 2. Render Screen Frame
  renderGraphFrame();

  if (graphState.isSimulating || graphState.draggedNode) {
    requestAnimationFrame(simulationLoop);
  }
}

/**
 * Visual Render Frame execution to output glowing components to Canvas
 */
function renderGraphFrame() {
  const ctx = graphState.ctx;
  
  // Clear screen context
  ctx.clearRect(0, 0, graphState.width, graphState.height);

  ctx.save();
  // Apply pan and zoom offsets
  ctx.translate(graphState.panX, graphState.panY);
  ctx.scale(graphState.zoom, graphState.zoom);

  // A. Draw connection links
  graphState.links.forEach(l => {
    const isActiveLink = l.source.id === state.activeNoteId || l.target.id === state.activeNoteId;
    
    ctx.beginPath();
    ctx.moveTo(l.source.x, l.source.y);
    ctx.lineTo(l.target.x, l.target.y);
    
    if (isActiveLink) {
      // Glow active connections Indigo
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.lineWidth = 2;
    } else {
      // Default connection lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
    }
    ctx.stroke();
  });

  // B. Draw nodes (Glow and Fill circles)
  graphState.nodes.forEach(n => {
    const isActive = n.id === state.activeNoteId;
    const isHovered = n === graphState.hoveredNode;
    const isConnected = !isActive && graphState.links.some(l => 
      (l.source.id === n.id && l.target.id === state.activeNoteId) ||
      (l.target.id === n.id && l.source.id === state.activeNoteId)
    );

    const r = isActive ? PHYSICS.activeNodeRadius : PHYSICS.nodeRadius;

    // Draw glowing shadow background for active note
    if (isActive) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.fill();
    }

    if (isConnected || isHovered) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
      ctx.fill();
    }

    // Main Circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    
    // Choose colors matching theme rules
    if (isActive) {
      ctx.fillStyle = '#a855f7';  // Neon Purple
      ctx.strokeStyle = '#f5f3ff';
      ctx.lineWidth = 2.5;
    } else if (isConnected) {
      ctx.fillStyle = '#6366f1';  // Neon Indigo
      ctx.strokeStyle = '#e0e7ff';
      ctx.lineWidth = 2;
    } else if (isHovered) {
      ctx.fillStyle = '#06b6d4';  // Cyan hover
      ctx.strokeStyle = '#ecfeff';
      ctx.lineWidth = 2;
    } else if (n.isOrphan) {
      ctx.fillStyle = '#1e293b';  // Slate Gray
      ctx.strokeStyle = '#f59e0b'; // Amber warning stroke
      ctx.lineWidth = 1.8;
    } else {
      ctx.fillStyle = '#1e293b';  // Slate Gray
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
    }

    ctx.fill();
    ctx.stroke();

    // C. Draw text labels next to nodes
    ctx.font = `500 ${isActive ? '13px' : '11px'} var(--font-body)`;
    
    // Active / Hovered nodes have high contrast white text
    if (isActive || isHovered) {
      ctx.fillStyle = '#f8fafc';
    } else if (isConnected) {
      ctx.fillStyle = '#cbd5e1';
    } else {
      ctx.fillStyle = '#64748b';
    }

    // Offset label position to avoid overlap
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // Add subtle drop shadow to text for premium canvas contrast
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    
    ctx.fillText(n.label, n.x + r + 8, n.y);
    
    // Reset shadows
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  });

  ctx.restore();
}
