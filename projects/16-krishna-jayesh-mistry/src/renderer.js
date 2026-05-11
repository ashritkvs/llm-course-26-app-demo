/* ============================================================
   DBSchemaViz — renderer.js
   Everything that touches the DOM:
     - Grid layout computation
     - Table node rendering
     - SVG relationship lines (bezier, crow-foot markers)
     - Drag-and-drop
     - Tooltips
     - Toolbar actions (layout, zoom, theme, types)
     - Schema health analysis panel
     - Export (SVG / PNG)
     - Loading overlay & error toasts
   ============================================================ */

/* ── Shared state (read/written by parser.js & examples.js) ── */
let tables        = [];
let relationships = [];
let showTypes     = true;
let isDark        = true;
let dragging      = null;
let dragOffX      = 0;
let dragOffY      = 0;

/* ============================================================
   LAYOUT
   ============================================================ */

/**
 * Assign (x, y) positions to each table in a grid layout.
 * Called once on initial render and on "Auto Layout".
 */
function computeLayout(tbls) {
  const cols   = Math.ceil(Math.sqrt(tbls.length));
  const padX   = 280, padY   = 60;
  const startX = 40,  startY = 40;

  return tbls.map((t, i) => {
    const col    = i % cols;
    const row    = Math.floor(i / cols);
    const height = 44 + t.columns.length * 27;
    return {
      ...t,
      x: startX + col * (240 + padX),
      y: startY + row * (height + padY),
    };
  });
}

/* ============================================================
   RENDER — Table Nodes
   ============================================================ */

function render() {
  const canvas     = document.getElementById('canvas');
  const svg        = document.getElementById('schema-svg');
  const emptyState = document.getElementById('empty-state');
  const legend     = document.getElementById('legend');

  // Clear previous nodes
  canvas.querySelectorAll('.table-node').forEach(n => n.remove());
  svg.innerHTML = '';

  if (tables.length === 0) {
    emptyState.style.display = 'flex';
    legend.style.display     = 'none';
    return;
  }

  emptyState.style.display = 'none';
  legend.style.display     = 'flex';

  // Expand canvas to fit all nodes
  const maxX = Math.max(...tables.map(t => t.x + 240)) + 80;
  const maxY = Math.max(...tables.map(t => t.y + 44 + t.columns.length * 27)) + 80;
  canvas.style.width  = Math.max(maxX, 800) + 'px';
  canvas.style.height = Math.max(maxY, 600) + 'px';
  svg.setAttribute('width',  Math.max(maxX, 800));
  svg.setAttribute('height', Math.max(maxY, 600));

  // Create one card per table
  tables.forEach(t => {
    const node = document.createElement('div');
    node.className = 'table-node';
    node.id        = 'table-' + t.name;
    node.style.left = t.x + 'px';
    node.style.top  = t.y + 'px';

    // Optional schema badge (purple pill)
    const schemaBadge = t.schema
      ? `<span style="font-family:var(--mono);font-size:9px;padding:2px 5px;` +
        `border:1px solid rgba(124,58,237,0.4);border-radius:3px;` +
        `color:#a78bfa;background:rgba(124,58,237,0.1);margin-right:6px">${t.schema}</span>`
      : '';

    const header = `
      <div class="table-header">
        <div class="table-icon"></div>
        <div class="table-name">${schemaBadge}${t.name}</div>
        <div class="table-row-count">${t.columns.length} cols</div>
      </div>`;

    const colRows = t.columns.map(col => {
      // Badge: K = Primary Key, F = Foreign Key, I = Unique/Index
      let keyClass = 'none', keyLabel = '·';
      if      (col.isPK)     { keyClass = 'pk';  keyLabel = 'K'; }
      else if (col.isFK)     { keyClass = 'fk';  keyLabel = 'F'; }
      else if (col.isUnique) { keyClass = 'idx'; keyLabel = 'I'; }

      const nameClass  = col.isNullable ? 'col-name nullable' : 'col-name';
      const typeStr    = showTypes ? `<span class="col-type">${col.type}</span>` : '';
      const nullBadge  = col.isNullable
        ? ' <span style="font-size:9px;color:var(--muted);opacity:0.6">null</span>'
        : '';
      const fkTarget   = col.fkRef ? `${col.fkRef.refTable}.${col.fkRef.refCol}` : '';

      return `<div class="col-row"
                   data-table="${t.name}"
                   data-col="${col.name}"
                   data-type="${col.type}"
                   data-nullable="${col.isNullable}"
                   data-fk="${fkTarget}">
        <div class="col-key ${keyClass}">${keyLabel}</div>
        <span class="${nameClass}">${col.name}${nullBadge}</span>
        ${typeStr}
      </div>`;
    }).join('');

    node.innerHTML = header + `<div class="table-columns">${colRows}</div>`;
    canvas.appendChild(node);

    node.addEventListener('mousedown', startDrag);
    node.querySelectorAll('.col-row').forEach(row => {
      row.addEventListener('mousemove',  showTooltip);
      row.addEventListener('mouseleave', hideTooltip);
    });
  });

  // Relationships need the nodes to be in the DOM first
  setTimeout(() => drawRelationships(), 50);
  updateAnalysis();
}

/* ============================================================
   RENDER — Relationship Lines (SVG)
   ============================================================ */

function drawRelationships() {
  const svg = document.getElementById('schema-svg');
  svg.innerHTML = '';
  if (!relationships.length) return;

  const NS = 'http://www.w3.org/2000/svg';

  // ── SVG Defs: markers + glow filter ──────────────────────
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `
    <!-- Solid arrowhead at the PARENT end (FK points TO here) -->
    <marker id="arr-end" markerWidth="12" markerHeight="10"
            refX="11" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,1 L10,5 L0,9 L2.5,5 Z" fill="#a78bfa"/>
    </marker>
    <!-- Crow-foot "many" tick at the CHILD end (where FK column lives) -->
    <marker id="arr-start" markerWidth="10" markerHeight="12"
            refX="1" refY="6" orient="auto" markerUnits="userSpaceOnUse">
      <line x1="1" y1="1" x2="1" y2="11" stroke="#a78bfa" stroke-width="2"   stroke-linecap="round"/>
      <line x1="4" y1="1" x2="4" y2="11" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
    </marker>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  svg.appendChild(defs);

  // Lines behind labels
  const lineGroup  = document.createElementNS(NS, 'g');
  const labelGroup = document.createElementNS(NS, 'g');
  svg.appendChild(lineGroup);
  svg.appendChild(labelGroup);

  // Track connections per side to offset parallel lines
  const sideCount = {};

  for (const rel of relationships) {
    const fromNode = document.getElementById('table-' + rel.from);
    const toNode   = document.getElementById('table-' + rel.to);
    if (!fromNode || !toNode) continue;

    const fR = nodeRect(fromNode);
    const tR = nodeRect(toNode);

    const { x1, y1, x2, y2, side1 } = bestEdgePoints(fR, tR);

    // Spread parallel connections on the same side
    const k1 = `${rel.from}-${side1}`;
    sideCount[k1] = (sideCount[k1] || 0) + 1;

    const d = buildPath(x1, y1, x2, y2, side1,
      bestEdgePoints(fR, tR).side2);

    // Glow shadow (wide, low-opacity)
    const shadow = document.createElementNS(NS, 'path');
    shadow.setAttribute('d',              d);
    shadow.setAttribute('fill',           'none');
    shadow.setAttribute('stroke',         '#7c3aed');
    shadow.setAttribute('stroke-width',   '5');
    shadow.setAttribute('opacity',        '0.18');
    shadow.setAttribute('stroke-linecap', 'round');
    lineGroup.appendChild(shadow);

    // Main line — child end (crow-foot) to parent end (arrow)
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d',            d);
    path.setAttribute('class',        'rel-line');
    path.setAttribute('marker-end',   'url(#arr-end)');
    path.setAttribute('marker-start', 'url(#arr-start)');
    lineGroup.appendChild(path);

    // ── Pill label ──────────────────────────────────────────
    const lx        = x1 + (x2 - x1) * 0.42;
    const ly        = y1 + (y2 - y1) * 0.42 - 2;
    const labelText = `${rel.fromCol} → ${rel.toCol}`;
    const pillW     = labelText.length * 6.5 + 16;
    const pillH     = 18;

    const pill = document.createElementNS(NS, 'rect');
    pill.setAttribute('x',            lx - pillW / 2);
    pill.setAttribute('y',            ly - pillH + 4);
    pill.setAttribute('width',        pillW);
    pill.setAttribute('height',       pillH);
    pill.setAttribute('rx',           9);
    pill.setAttribute('fill',         '#1a1025');
    pill.setAttribute('stroke',       '#7c3aed');
    pill.setAttribute('stroke-width', '1');
    pill.setAttribute('opacity',      '0.95');
    labelGroup.appendChild(pill);

    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x',                  lx);
    txt.setAttribute('y',                  ly);
    txt.setAttribute('text-anchor',        'middle');
    txt.setAttribute('dominant-baseline',  'auto');
    txt.setAttribute('font-family',        'Space Mono, monospace');
    txt.setAttribute('font-size',          '10');
    txt.setAttribute('fill',               '#c4b5fd');
    txt.setAttribute('font-weight',        '600');
    txt.textContent = labelText;
    labelGroup.appendChild(txt);
  }
}

/* ── Geometry helpers ─────────────────────────────────────── */

/** Get bounding box of a positioned table node. */
function nodeRect(node) {
  return {
    x: parseInt(node.style.left),
    y: parseInt(node.style.top),
    w: node.offsetWidth  || 220,
    h: node.offsetHeight || 120,
  };
}

/**
 * Pick the two edge attachment points that make the cleanest line.
 * Lines exit/enter from the side that most directly faces the target.
 */
function bestEdgePoints(fR, tR) {
  const fCx = fR.x + fR.w / 2, fCy = fR.y + fR.h / 2;
  const tCx = tR.x + tR.w / 2, tCy = tR.y + tR.h / 2;
  const dx  = tCx - fCx, dy = tCy - fCy;

  let side1, side2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    side1 = dx > 0 ? 'right' : 'left';
    side2 = dx > 0 ? 'left'  : 'right';
  } else {
    side1 = dy > 0 ? 'bottom' : 'top';
    side2 = dy > 0 ? 'top'    : 'bottom';
  }

  return {
    x1: sideX(fR, side1), y1: sideY(fR, side1),
    x2: sideX(tR, side2), y2: sideY(tR, side2),
    side1, side2,
  };
}

function sideX(r, side) {
  if (side === 'left')  return r.x;
  if (side === 'right') return r.x + r.w;
  return r.x + r.w / 2; // top / bottom
}

function sideY(r, side) {
  if (side === 'top')    return r.y;
  if (side === 'bottom') return r.y + r.h;
  return r.y + r.h / 2; // left / right
}

/**
 * Build a smooth cubic bezier between two side-attached edge points.
 * Control-point arms extend outward from each side's tangent direction.
 */
function buildPath(x1, y1, x2, y2, side1, side2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const arm  = Math.max(40, dist * 0.38);

  const tangent = { left:[-1,0], right:[1,0], top:[0,-1], bottom:[0,1] };
  const [t1x, t1y] = tangent[side1];
  const [t2x, t2y] = tangent[side2];

  const cpx1 = x1 + t1x * arm;
  const cpy1 = y1 + t1y * arm;
  const cpx2 = x2 + t2x * arm;
  const cpy2 = y2 + t2y * arm;

  return `M ${x1} ${y1} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${x2} ${y2}`;
}

/* ============================================================
   DRAG & DROP
   ============================================================ */

function startDrag(e) {
  if (e.target.closest('.col-row')) return; // don't drag on column hover
  dragging = e.currentTarget;

  const canvasRect = document.getElementById('canvas').getBoundingClientRect();
  const wrapper    = document.getElementById('canvas-wrapper');
  dragOffX = e.clientX - parseInt(dragging.style.left) - canvasRect.left + wrapper.scrollLeft;
  dragOffY = e.clientY - parseInt(dragging.style.top)  - canvasRect.top  + wrapper.scrollTop;

  dragging.classList.add('dragging');
  e.preventDefault();
}

document.addEventListener('mousemove', e => {
  if (!dragging) return;

  const canvasRect = document.getElementById('canvas').getBoundingClientRect();
  const wrapper    = document.getElementById('canvas-wrapper');
  const x = e.clientX - canvasRect.left + wrapper.scrollLeft - dragOffX;
  const y = e.clientY - canvasRect.top  + wrapper.scrollTop  - dragOffY;

  dragging.style.left = Math.max(0, x) + 'px';
  dragging.style.top  = Math.max(0, y) + 'px';

  // Keep state in sync
  const tName = dragging.id.replace('table-', '');
  const t = tables.find(t => t.name === tName);
  if (t) { t.x = Math.max(0, x); t.y = Math.max(0, y); }

  drawRelationships();
});

document.addEventListener('mouseup', () => {
  if (dragging) { dragging.classList.remove('dragging'); dragging = null; }
});

/* ============================================================
   TOOLTIPS
   ============================================================ */

function showTooltip(e) {
  const row     = e.currentTarget;
  const tooltip = document.getElementById('tooltip');
  const nullable = row.dataset.nullable === 'true';
  const fk       = row.dataset.fk;

  let html = `<strong style="color:var(--accent)">${row.dataset.table}.${row.dataset.col}</strong><br>`;
  html += `Type: <span style="color:var(--info)">${row.dataset.type}</span><br>`;
  html += `Nullable: ${nullable
    ? '<span style="color:var(--accent3)">YES</span>'
    : '<span style="color:var(--accent)">NO</span>'}<br>`;
  if (fk) html += `References: <span style="color:#a78bfa">${fk}</span>`;

  tooltip.innerHTML   = html;
  tooltip.style.left  = (e.clientX + 14) + 'px';
  tooltip.style.top   = (e.clientY - 10) + 'px';
  tooltip.classList.add('show');
}

function hideTooltip() {
  document.getElementById('tooltip').classList.remove('show');
}

/* ============================================================
   ACTIONS (toolbar buttons + main visualize button)
   ============================================================ */

/** Parse SQL input, layout tables, and render the diagram. */
function visualize() {
  const sql = document.getElementById('sql-input').value.trim();
  if (!sql) { showError('Please paste some SQL CREATE TABLE statements first.'); return; }

  showLoading(true);

  setTimeout(() => {
    try {
      const parsed = parseSQL(sql); // from parser.js

      if (parsed.tables.length === 0) {
        showLoading(false);
        showError('No valid CREATE TABLE statements found. Check your SQL syntax.');
        return;
      }

      tables        = computeLayout(parsed.tables);
      relationships = parsed.relationships;

      // Update stats bar
      const totalCols = tables.reduce((s, t) => s + t.columns.length, 0);
      const totalPKs  = tables.reduce((s, t) => s + t.columns.filter(c => c.isPK).length, 0);
      document.getElementById('stat-tables').textContent = tables.length;
      document.getElementById('stat-cols').textContent   = totalCols;
      document.getElementById('stat-fks').textContent    = relationships.length;
      document.getElementById('stat-pks').textContent    = totalPKs;
      document.getElementById('stats-bar').style.display = 'flex';
      document.getElementById('analysis-panel').classList.add('visible');

      render();
      showLoading(false);
    } catch (err) {
      showLoading(false);
      showError('Parse error: ' + err.message);
    }
  }, 300);
}

/** Schema health analysis — runs after every render. */
function updateAnalysis() {
  const fkTables = new Set(
    relationships.map(r => r.from).concat(relationships.map(r => r.to))
  );
  const orphans = tables.filter(t => !fkTables.has(t.name)).length;
  const noPK    = tables.filter(t => !t.columns.some(c => c.isPK)).length;
  const nullFKs = tables.reduce(
    (s, t) => s + t.columns.filter(c => c.isFK && c.isNullable).length, 0
  );

  const set = (id, val, warn) => {
    const el = document.getElementById(id);
    el.textContent = val;
    el.className   = 'analysis-val ' + (warn ? 'warn' : 'ok');
  };

  set('a-orphans', orphans === 0 ? '✓ None' : orphans, orphans > 0);
  set('a-nullfks', nullFKs === 0 ? '✓ None' : nullFKs, nullFKs > 0);
  set('a-nopk',    noPK    === 0 ? '✓ None' : noPK,    noPK    > 0);

  const issues = (orphans > 0 ? 1 : 0) + (noPK > 0 ? 2 : 0) + (nullFKs > 0 ? 1 : 0);
  const health = issues === 0 ? '✓ Healthy' : issues <= 2 ? '⚠ Fair' : '✗ Issues';
  set('a-health', health, issues > 0);
}

function autoLayout() {
  if (!tables.length) return;
  tables = computeLayout(tables.map(t => ({ ...t })));
  render();
}

function zoomFit() {
  document.getElementById('canvas-wrapper').scrollTo(0, 0);
}

function toggleTypes() {
  showTypes = !showTypes;
  const btn = document.getElementById('show-types-btn');
  btn.classList.toggle('active', showTypes);
  btn.textContent = showTypes ? '⊞ Types' : '⊟ Types';
  if (tables.length) render();
}

function toggleTheme() {
  isDark = !isDark;
  const d = isDark;
  const s = document.documentElement.style;
  s.setProperty('--bg',      d ? '#0a0a0f' : '#f5f5f0');
  s.setProperty('--surface', d ? '#111118' : '#ffffff');
  s.setProperty('--surface2',d ? '#18181f' : '#f0f0eb');
  s.setProperty('--border',  d ? '#2a2a38' : '#d0d0c8');
  s.setProperty('--text',    d ? '#e8e8f0' : '#1a1a25');
  s.setProperty('--muted',   d ? '#6b6b80' : '#888890');
}

function clearAll() {
  tables = []; relationships = [];
  document.getElementById('sql-input').value = '';
  document.getElementById('stats-bar').style.display = 'none';
  document.getElementById('analysis-panel').classList.remove('visible');
  render();
}

/* ============================================================
   EXPORT
   ============================================================ */

function exportSVG() {
  const canvas = document.getElementById('canvas');
  const svgEl  = document.getElementById('schema-svg');

  let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" `
    + `width="${canvas.style.width || '800'}" `
    + `height="${canvas.style.height || '600'}" `
    + `style="background:#0a0a0f;font-family:monospace">`;
  svgStr += svgEl.innerHTML;

  canvas.querySelectorAll('.table-node').forEach(node => {
    const x = parseInt(node.style.left);
    const y = parseInt(node.style.top);
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    svgStr += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#111118" stroke="#2a2a38" stroke-width="1"/>`;

    const headerEl = node.querySelector('.table-name');
    if (headerEl) {
      svgStr += `<text x="${x+14}" y="${y+28}" fill="#00ff88" font-size="13" font-weight="bold" font-family="monospace">`
        + headerEl.textContent + `</text>`;
    }

    node.querySelectorAll('.col-row').forEach((row, i) => {
      const colName = row.querySelector('.col-name');
      const colType = row.querySelector('.col-type');
      const ry = y + 50 + i * 27;
      if (colName) svgStr += `<text x="${x+14}" y="${ry}" fill="#e8e8f0" font-size="12" font-family="monospace">${colName.textContent.trim()}</text>`;
      if (colType) svgStr += `<text x="${x+180}" y="${ry}" fill="#38bdf8" font-size="11" font-family="monospace">${colType.textContent}</text>`;
    });
  });

  svgStr += '</svg>';
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'schema.svg';
  a.click();
}

function exportPNG() {
  const canvas = document.getElementById('canvas');
  const w = parseInt(canvas.style.width)  || 800;
  const h = parseInt(canvas.style.height) || 600;

  const c   = document.createElement('canvas');
  c.width   = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, w, h);

  const svgBlob = new Blob([
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    + document.getElementById('schema-svg').innerHTML
    + `</svg>`
  ], { type: 'image/svg+xml' });

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    c.toBlob(b => {
      const a = document.createElement('a');
      a.href     = URL.createObjectURL(b);
      a.download = 'schema.png';
      a.click();
    });
  };
  img.src = URL.createObjectURL(svgBlob);
}

/* ============================================================
   LOADING & ERROR UI
   ============================================================ */

function showLoading(visible) {
  document.getElementById('loading').classList.toggle('active', visible);
}

function showError(msg) {
  const toast = document.getElementById('error-toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

/* ── Redraw lines on window resize ───────────────────────── */
window.addEventListener('resize', () => {
  if (tables.length) drawRelationships();
});
