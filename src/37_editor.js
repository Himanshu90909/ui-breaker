/* =====================================================================
   EDITOR — grid based custom level builder
   ===================================================================== */
const ED_TOOLS = [
  { id: 'floor', nm: 'Deck', key: 'F' },
  { id: 'high', nm: 'High', key: 'H' },
  { id: 'window', nm: 'Window', key: 'W' },
  { id: 'pause', nm: 'Pause', key: 'P' },
  { id: 'bright', nm: 'Bright', key: 'L' },
  { id: 'gravity', nm: 'Grav', key: 'G' },
  { id: 'bin', nm: 'Bin', key: 'B' },
  { id: 'shard', nm: 'Shard', key: 'S' },
  { id: 'hazard', nm: 'Hazard', key: 'X' },
  { id: 'spawn', nm: 'Spawn', key: 'A' },
  { id: 'exit', nm: 'Exit', key: 'E' },
  { id: 'erase', nm: 'Erase', key: 'D' },
];
const EditorUI = {
  cols: 12, rows: 9, cell: 4,
  grid: null, tool: 'floor', height: 1, exitCell: null, spawnCell: null, savedId: null,
  init() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    const host = document.getElementById('edTools');
    ED_TOOLS.forEach(t => {
      const b = el('button', 'edtool', t.nm);
      b.dataset.tool = t.id;
      on(b, 'click', () => { this.tool = t.id; this.renderTools(); Sfx.click(); });
      host.appendChild(b);
    });
    this.renderTools();
    this.buildGrid();
    on(document.getElementById('edHUp'), 'click', () => { this.height = Math.min(4, this.height + 1); this.renderPreview(); Sfx.click(); });
    on(document.getElementById('edHDown'), 'click', () => { this.height = Math.max(0, this.height - 1); this.renderPreview(); Sfx.click(); });
    on(document.getElementById('edClear'), 'click', () => {
      this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
      this.exitCell = null; this.spawnCell = null; this.savedId = null;
      this.renderPreview(); this.buildGrid(); document.getElementById('edShare').value = '';
    });
    on(document.getElementById('edPlay'), 'click', () => this.testPlay());
    on(document.getElementById('edSave'), 'click', () => this.save());
    on(document.getElementById('edCopy'), 'click', () => {
      const ta = document.getElementById('edShare');
      if (!ta.value) { Game.toast('SAVE THE LEVEL FIRST', 'warn'); return; }
      navigator.clipboard?.writeText(ta.value).then(() => Game.toast('SHARE CODE COPIED', 'good')).catch(() => { ta.select(); document.execCommand('copy'); });
    });
    on(document.getElementById('edImportBtn'), 'click', () => this.importCode());
    this.renderPreview();
  },
  renderTools() {
    $$('.edtool').forEach(b => b.classList.toggle('on', b.dataset.tool === this.tool));
  },
  buildGrid() {
    const grid = document.getElementById('edgrid');
    grid.innerHTML = '';
    const host = document.getElementById('edcanvas');
    const w = host.clientWidth || 600, h = host.clientHeight || 400;
    const cw = w / this.cols, ch = h / this.rows;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = el('div', 'edcell');
        cell.style.left = (c * cw) + 'px';
        cell.style.top = (r * ch) + 'px';
        cell.style.width = cw + 'px';
        cell.style.height = ch + 'px';
        cell.dataset.r = r; cell.dataset.c = c;
        on(cell, 'click', () => this.paint(r, c));
        on(cell, 'contextmenu', e => { e.preventDefault(); this.paint(r, c, true); });
        cell.textContent = '';
        grid.appendChild(cell);
      }
    }
    this.paintGridLabels();
  },
  paintGridLabels() {
    const host = document.getElementById('edcanvas');
    const w = host.clientWidth || 600, h = host.clientHeight || 400;
    const cw = w / this.cols, ch = h / this.rows;
    Array.from(document.querySelectorAll('.edcell')).forEach(cell => {
      const r = +cell.dataset.r, c = +cell.dataset.c;
      const v = this.grid[r][c];
      cell.textContent = v ? v.nm.slice(0, 4) : '';
      cell.style.color = '#7fe9ff';
      cell.style.font = '9px "Chakra Petch", monospace';
      cell.style.display = 'grid';
      cell.style.placeItems = 'center';
      cell.style.background = v ? (v.id === 'hazard' ? 'rgba(255,61,90,.18)' : v.id === 'exit' ? 'rgba(255,106,36,.22)' : v.id === 'spawn' ? 'rgba(37,255,176,.16)' : 'rgba(37,217,255,.11)') : 'transparent';
      if (v && v.height != null) cell.title = 'height ' + v.height;
    });
  },
  paint(r, c, erase) {
    if (erase || this.tool === 'erase') { this.grid[r][c] = null; }
    else {
      const tool = ED_TOOLS.find(t => t.id === this.tool);
      this.grid[r][c] = { id: tool.id, nm: tool.nm, height: (tool.id === 'high') ? Math.max(2, this.height) : (tool.id === 'floor' ? this.height : this.height) };
      if (tool.id === 'exit') this.exitCell = [r, c];
      if (tool.id === 'spawn') this.spawnCell = [r, c];
    }
    this.paintGridLabels(); this.renderPreview(); Sfx.click();
  },
  renderPreview() {
    let count = 0;
    this.grid.forEach(row => row.forEach(v => { if (v) count++; }));
    document.getElementById('edCount').textContent = count;
    document.getElementById('edExit').textContent = this.exitCell ? ('row ' + (this.exitCell[0] + 1) + ' col ' + (this.exitCell[1] + 1)) : 'not placed';
    document.getElementById('edSpawn').textContent = this.spawnCell ? ('row ' + (this.spawnCell[0] + 1) + ' col ' + (this.spawnCell[1] + 1)) : 'default';
    const p = document.getElementById('edPreview');
    p.innerHTML = 'Cursor height level: <b style="color:var(--cyan)">' + this.height + '</b><br>' +
      'Click a cell to place the selected element. Right click erases.<br>' +
      'Deck cells become floors at their height level. Exit and spawn cells auto-create a floor if missing.';
  },
  toDoc() {
    return {
      v: 1, name: 'CUSTOM ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      cols: this.cols, rows: this.rows, cell: this.cell,
      grid: this.grid.map(row => row.map(v => v ? { id: v.id, h: v.height } : 0)),
      exitCell: this.exitCell, spawnCell: this.spawnCell,
    };
  },
  fromDoc(doc) {
    this.cols = doc.cols; this.rows = doc.rows; this.cell = doc.cell || 4;
    this.grid = doc.grid.map(row => row.map(v => v ? { id: v.id, nm: (ED_TOOLS.find(t => t.id === v.id) || { nm: v.id }).nm, height: v.h } : null));
    this.exitCell = doc.exitCell; this.spawnCell = doc.spawnCell;
    this.buildGrid(); this.paintGridLabels(); this.renderPreview();
  },
  validate(doc) {
    let floors = 0;
    doc.grid.forEach(row => row.forEach(v => { if (v && (v.id === 'floor' || v.id === 'high')) floors++; }));
    if (floors < 3) return 'Place at least 3 deck cells.';
    if (!doc.exitCell) return 'Place an exit cell.';
    return null;
  },
  save() {
    const doc = this.toDoc();
    const err = this.validate(doc);
    if (err) { Game.toast(err.toUpperCase(), 'bad'); return; }
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(doc))));
    document.getElementById('edShare').value = code;
    const id = this.savedId || ('custom-' + Date.now());
    this.savedId = id;
    const existing = Save.data.custom.findIndex(c => c.id === id);
    const rec = { id, name: doc.name, code, date: Date.now() };
    if (existing >= 0) Save.data.custom[existing] = rec; else Save.data.custom.unshift(rec);
    Save.write();
    Game.toast('LEVEL SAVED', 'good'); Sfx.win();
    this.renderSaved();
  },
  importCode() {
    const val = document.getElementById('edImport').value.trim();
    if (!val) { Game.toast('PASTE A SHARE CODE FIRST', 'warn'); return; }
    try {
      const doc = JSON.parse(decodeURIComponent(escape(atob(val))));
      const err = this.validate(doc);
      if (err) { Game.toast(err.toUpperCase(), 'bad'); return; }
      this.fromDoc(doc);
      document.getElementById('edShare').value = val;
      Game.toast('LEVEL IMPORTED', 'good');
    } catch (e) { Game.toast('INVALID SHARE CODE', 'bad'); }
  },
  renderSaved() {
    const host = document.getElementById('edSaved');
    if (!host) return;
    host.innerHTML = '';
    if (!Save.data.custom.length) { host.innerHTML = '<div style="font-size:10.5px;color:var(--dim2)">No saved levels yet.</div>'; return; }
    Save.data.custom.forEach(c => {
      const row = el('div', 'row');
      row.style.gap = '4px';
      const play = el('button', 'btn', '▶ ' + c.name);
      play.style.flex = '1'; play.style.fontSize = '9.5px'; play.style.padding = '6px';
      on(play, 'click', () => { this.loadSaved(c); this.testPlay(); });
      const del = el('button', 'btn danger', '✕');
      del.style.padding = '6px 8px';
      on(del, 'click', () => {
        Save.data.custom = Save.data.custom.filter(x => x.id !== c.id);
        Save.write(); this.renderSaved();
      });
      row.appendChild(play); row.appendChild(del);
      host.appendChild(row);
    });
  },
  loadSaved(rec) {
    try {
      const doc = JSON.parse(decodeURIComponent(escape(atob(rec.code))));
      this.fromDoc(doc); this.savedId = rec.id;
      document.getElementById('edShare').value = rec.code;
    } catch (e) { Game.toast('SAVED LEVEL CORRUPTED', 'bad'); }
  },
  testPlay() {
    const doc = this.toDoc();
    const err = this.validate(doc);
    if (err) { Game.toast(err.toUpperCase(), 'bad'); return; }
    this._playDoc = doc;
    const level = buildLevelFromDoc(doc);
    UI.startLevel(level, 'custom');
  },
  render() {
    this.buildGrid(); this.paintGridLabels(); this.renderPreview(); this.renderSaved();
  },
};

/* build a playable level object from an editor document */
function buildLevelFromDoc(doc) {
  const CELL = doc.cell || 4, cols = doc.cols, rows = doc.rows;
  const platforms = [], windows = [], props = [], shards = [], movers = [], consoles = {}, hidden = [];
  let spawn = null, exit = null;
  const topFor = h => (h || 0) * 2.1;
  const worldX = c => (c - (cols - 1) / 2) * CELL;
  const worldZ = r => (r - (rows - 1) / 2) * CELL;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = doc.grid[r][c];
      if (!v) continue;
      const x = worldX(c), z = worldZ(r);
      const top = topFor(v.h);
      if (v.id === 'floor' || v.id === 'high') {
        platforms.push(pl(x, top, z, CELL + 0.12, CELL + 0.12));
      } else if (v.id === 'exit') {
        platforms.push(pl(x, top, z, CELL + 0.12, CELL + 0.12));
        exit = [x, top + 1.4, z];
      } else if (v.id === 'spawn') {
        platforms.push(pl(x, top, z, CELL + 0.12, CELL + 0.12));
        spawn = [x, top + 1.4, z];
      } else if (v.id === 'window') {
        windows.push([x, top + 1.6, z, 3.2, 1.3]);
      } else if (v.id === 'shard') {
        shards.push([x, top + 1.1, z]);
      } else if (v.id === 'hazard') {
        movers.push([x, top + 0.55, z, 3, 0.5, 0.5, { hazard: true, axis: 'x', range: 1.8, speed: 1.5 }]);
      } else if (v.id === 'pause') consoles.pause = [x, top, z];
      else if (v.id === 'bright') consoles.brightness = [x, top, z];
      else if (v.id === 'gravity') consoles.gravity = [x, top, z];
      else if (v.id === 'bin') consoles.bin = [x, top, z];
    }
  }
  if (!spawn) spawn = [worldX(0), 1.4, worldZ(rows - 1)];
  if (!exit) exit = [worldX(cols - 1), 1.4, worldZ(0)];
  return {
    id: 'custom', chapter: 0, name: doc.name, custom: true, par: 90,
    brief: 'A community-built puzzle from the level editor.',
    objective: 'Reach the exit portal. Use whatever the builder left you.',
    spawn, exit, gravity: 'down',
    platforms, windows, props, shards, movers, consoles, hidden,
    hints: ['Custom layout · mechanics depend on what the builder placed'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }],
    optional: [{ id: 'shards', text: 'Recover every shard' }],
  };
}

/* =====================================================================
   TOUCH CONTROLS
   ===================================================================== */
const Touch = {
  enabled: false, stickId: null, lookId: null,
  init() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stickknob');
    const zone = document.getElementById('lookzone');
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
    on(stick, 'pointerdown', e => {
      this.stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
    });
    on(stick, 'pointermove', e => {
      if (e.pointerId !== this.stickId) return;
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const max = r.width / 2 - 8;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      setKnob(dx, dy);
      Input.touchMove.x = dx / max;
      Input.touchMove.y = -dy / max;
      Input.touchActive = true;
    });
    const end = e => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null; setKnob(0, 0);
      Input.touchMove.x = 0; Input.touchMove.y = 0; Input.touchActive = false;
    };
    on(stick, 'pointerup', end); on(stick, 'pointercancel', end);
    let last = null;
    on(zone, 'pointerdown', e => { this.lookId = e.pointerId; last = { x: e.clientX, y: e.clientY }; });
    on(zone, 'pointermove', e => {
      if (e.pointerId !== this.lookId || !last) return;
      const s = Save.data.settings.sens / 100;
      Input.dx += (e.clientX - last.x) * 0.0045 * s;
      Input.dy += (e.clientY - last.y) * 0.0035 * s;
      last = { x: e.clientX, y: e.clientY };
    });
    const stop = e => { if (e.pointerId === this.lookId) { this.lookId = null; last = null; } };
    on(zone, 'pointerup', stop); on(zone, 'pointercancel', stop);
    $$('.tbtn').forEach(b => {
      on(b, 'pointerdown', e => {
        e.preventDefault();
        const k = b.dataset.tk;
        if (k === 'jump') { Game.player && (Game.player.touchJump = true); Input.keys[' '] = true; }
        if (k === 'interact') Game.interactKey();
        if (k === 'grab') Game.keyGrabWindow();
        b.classList.add('act');
      });
      const up = () => { b.classList.remove('act'); Input.keys[' '] = false; if (Game.player) Game.player.touchJump = false; };
      on(b, 'pointerup', up); on(b, 'pointercancel', up); on(b, 'pointerleave', up);
    });
  },
};
