/* =====================================================================
   BOOT — startup cinematic, init, debug hooks
   ===================================================================== */
const BOOT_LINES = [
  '<b>NEXUS OS</b> 4.12.0 · portable kernel · build 9912',
  'mounting /dev/interface ............. <i>ok</i>',
  'loading window manager .............. <i>ok</i>',
  'starting physics subsystem ......... <i>ok</i>',
  'verifying user credentials .......... <i>denied</i>',
  'containment field ................... <i>breached</i>',
  'intrusion detected in sector 7 ...... <i>sealed</i>',
  '<b>GLITCH:</b> you are not supposed to be here.',
  'rewriting gravity constants ......... <i>...and neither are your rules</i>',
  '<b>UI BREAKER</b> protocol initialised',
];
function typeBoot() {
  const host = document.getElementById('bootlog');
  if (!host) return;
  let i = 0;
  const step = () => {
    if (!host.isConnected || i >= BOOT_LINES.length) {
      setTimeout(() => {
        if (UI.current === 'boot') UI.show('menu');
      }, 900);
      return;
    }
    host.innerHTML += (i ? '\n' : '') + BOOT_LINES[i];
    if (i >= 6 && i <= 8) Sfx.glitch();
    i++;
    setTimeout(step, i < 4 ? 230 : 380);
  };
  setTimeout(step, 320);
}
let bootSkipped = false;
function skipBoot() {
  if (bootSkipped) return;
  bootSkipped = true;
  Sfx.init(); Sfx.resume(); Sfx.ui();
  const host = document.getElementById('bootlog');
  if (host) host.innerHTML = BOOT_LINES.join('\n');
  setTimeout(() => { if (UI.current === 'boot') UI.show('menu'); }, 260);
}

function wireGlobal() {
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => { Sfx.init(); Sfx.resume(); }, { once: true }));
  on(document.getElementById('boot'), 'click', skipBoot);
  on(window, 'keydown', e => {
    if (UI.current === 'boot') { skipBoot(); return; }
    if (e.key === 'Enter' && ['menu', 'complete'].includes(UI.current)) {
      if (UI.current === 'menu') { /* let focused button handle */ }
    }
    if (UI.current === 'menu' && /^[0-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10);
      const items = $$('#mainnav .navitem');
      if (items[idx]) items[idx].click();
    }
  });
  window.addEventListener('error', e => {
    console.error('[UI BREAKER]', e.message, e.filename, e.lineno);
    const box = document.getElementById('errbox');
    if (box) { box.style.display = 'block'; box.textContent = 'NEXUS FAULT: ' + e.message; }
  });
}

function startApp() {
  Save.load();
  wireGlobal();
  UI.init();
  Touch.init();
  EditorUI.init();
  const ok = Game.init();
  UI.applyContrast();
  UI.updateTouchMode();
  if (ok) typeBoot();
  else UI.show('boot');
  /* debug / automation surface */
  window.NEXUS = {
    version: VERSION,
    Game, Save, UI, LEVELS, CHAPTERS, THREE, Mechanics,
    get ready() { return !!Game.world || Game.state === 'menu'; },
    loadLevel(id) {
      const lvl = typeof id === 'string' ? (levelById(id) || SANDBOX_LEVEL) : id;
      UI.startLevel(lvl, 'story');
      return !!lvl;
    },
    startLevelByIndex(i) { UI.startLevel(LEVELS[i], 'story'); },
    state() {
      return {
        state: Game.state, level: Game.level && Game.level.id,
        paused: Game.paused,
        player: Game.player ? Game.player.pos.toArray().map(n => +n.toFixed(2)) : null,
        vel: Game.player ? Game.player.vel.toArray().map(n => +n.toFixed(2)) : null,
        grounded: Game.player ? Game.player.grounded : null,
        gravity: Game.gravityMode,
        energy: Game.energy, rewinds: Game.rewinds, corruption: Game.corruption,
        time: +Game.levelTime.toFixed(2),
        shards: Game.stats ? Game.stats.shards : 0,
        snapshots: Game.snapshots.length,
        pauseCd: +Game.pauseCd.toFixed(2),
        freeze: Game.world ? +Game.world.freezeTimer.toFixed(2) : 0,
        brightness: Game.world ? Game.world.brightness : null,
        volume: Game.world ? Game.world.volume : null,
        windows: Game.world ? Game.world.windows.length : 0,
        boss: Game.boss ? { stage: Game.boss.stage, redirects: Game.boss.redirects, nodes: Game.boss.nodesDone, purge: Game.boss.purgeHits } : null,
        framed: Game._frames || 0,
      };
    },
    key(k, ms = 90) {
      Input.keys[k] = true;
      Game.onKey(k, { key: k });
      setTimeout(() => { Input.keys[k] = false; }, ms);
    },
    hold(k, v = true) { Input.keys[k] = v; },
    teleport(x, y, z) { Game.player.pos.set(x, y, z); Game.player.vel.set(0, 0, 0); },
    teleportToExit() { const e = Game.world.exit; if (e) this.teleport(e.pos.x, e.pos.y + 0.4, e.pos.z); },
    setBrightness(v) { Mechanics.setBrightness(Game, v); },
    setVolume(v) { Mechanics.setVolume(Game, v); },
    setGravity(m) { Mechanics.setGravity(Game, m); },
    pauseWorld() { Mechanics.pause(Game); },
    rewind() { return Mechanics.rewind(Game); },
    grabNearestWindow() { Game.keyGrabWindow(); return !!Game.dragWin; },
    moveWindow(i, x, y, z) { const w = Game.world.windows[i]; if (w) { w.pos.set(x, y, z); w.mesh.position.copy(w.pos); } },
    snapshot() { Game.snapshot('test'); },
    screen() { return UI.current; },
    save() { return JSON.parse(JSON.stringify(Save.data)); },
    setPlayerHp(n) { Game.player.hp = n; },
    hurt(n) { Game.hurtPlayer(n); },
    completeLevel() { Game.completeLevel(); },
    windowCount() { return Game.world.windows.filter(w => w.active).length; },
    solidCount() { return Game.world.solids.filter(s => s.active).length; },
    cameraRayPick() { return Game.raycastRef()?.kind || null; },
    focusWindow(i) {
      const w = Game.world.windows[i];
      if (!w) return null;
      Game.camYaw = Math.atan2(-(w.pos.x - Game.player.pos.x), -(w.pos.z - Game.player.pos.z));
      return w.pos.toArray();
    },
    pressAt(el) { el.click(); },
  };
  window.__UI_BREAKER_READY__ = true;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();
