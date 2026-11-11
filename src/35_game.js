/* =====================================================================
   GAME — world lifecycle, interactions, loop
   ===================================================================== */
const DOCK = [
  { id: 'pause', key: '1', nm: 'Pause', icon: '<rect x="7" y="6" width="3.4" height="12"/><rect x="14" y="6" width="3.4" height="12"/>' },
  { id: 'volume', key: '2', nm: 'Volume', icon: '<path d="M4 10v4h3l4 4V6L7 10H4z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/>' },
  { id: 'gravity', key: '3', nm: 'Gravity', icon: '<path d="M12 3v13"/><path d="M7 12l5 5 5-5"/><circle cx="12" cy="21" r="1"/>' },
  { id: 'bright', key: '4', nm: 'Bright', icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>' },
  { id: 'bin', key: '5', nm: 'Recycle', icon: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>' },
  { id: 'window', key: 'F', nm: 'Windows', icon: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9h18"/>' },
  { id: 'undo', key: 'Z', nm: 'Rewind', icon: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 0 12h-1"/>' },
  { id: 'dj', key: 'X', nm: 'Dbl Jump', icon: '<path d="M12 20V6"/><path d="M7 11l5-5 5 5"/><path d="M7 17l5-5 5 5"/>' },
  { id: 'slow', key: 'C', nm: 'Slow', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>' },
  { id: 'shield', key: 'V', nm: 'Shield', icon: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z"/>' },
];
const PROMPTS = {
  pausebtn: ['E', 'FREEZE SIMULATION'],
  volumeslider: ['DRAG / E', 'ADJUST VOLUME'],
  brightslider: ['DRAG / E', 'ADJUST BRIGHTNESS'],
  gravbtn: ['E', 'SET GRAVITY DIRECTION'],
  bin: ['DROP', 'RECYCLE CARRIED OBJECT'],
  window: ['HOLD CLICK / F', 'GRAB WINDOW · WHEEL RESIZE · R ROTATE'],
  prop: ['HOLD CLICK', 'CARRY OBJECT'],
  plate: ['—', 'PRESSURE PLATE'],
  exit: ['—', 'EXIT PORTAL'],
  node: ['E', 'SYSTEM NODE'],
  glitchcore: ['HOLD E', 'PURGE THE CORE'],
};

const Game = {
  state: 'boot', scene: null, camera: null, renderer: null, player: null, world: null,
  level: null, gravityVec: new THREE.Vector3(0, -1, 0), gravityMode: 'down',
  time: 0, levelTime: 0, rewinds: 3, corruption: 0, energy: 0, stats: null,
  snapshotList: [], snapshots: [], pauseCd: 0, freezeTimer: 0,
  abilities: { doubleJump: false }, slowUntil: 0, shieldUntil: 0,
  mode: 'story', paused: false, godMode: false, famine: false, returningFrom: null,
  hovered: null, drag: null, dragWin: null, draggingSlider: null, held: null,
  rewindFx: 0, shakeAmt: 0, camYaw: 0, camPitch: 0.26, camDist: 8.4, camPos: new THREE.Vector3(),
  lastSafe: new THREE.Vector3(), animId: null, quality: 'medium',

  /* ------------------------------------------------ init ----------- */
  init() {
    if (!Save.data) Save.load();
    this.energy = 0;
    const canvasHost = document.getElementById('world');
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    } catch (e) {
      document.getElementById('boot').innerHTML = '<div class="endwrap"><h2 class="h1">NO WEBGL</h2><p class="dim" style="margin-top:14px">NEXUS OS could not initialise a 3D context on this device. Try a modern browser with hardware acceleration enabled, or a different device.</p></div>';
      return false;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasHost.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090b12);
    this.scene.fog = new THREE.FogExp2(0x090b12, 0.014);
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
    this.camera.position.set(0, 8, 16);

    GLOW_TEX = glowTexture();
    buildMaterials();
    this.buildEnvironment();
    this.player = new PlayerActor(this.scene);
    this.applyTheme();
    Input.init(this.renderer.domElement);
    on(window, 'resize', () => this.onResize());
    this.onResize();
    this.applySettings();
    this.loop();
    return true;
  },
  buildEnvironment() {
    this.ambient = new THREE.AmbientLight(0x88a2c0, 0.55);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x25d9ff, 0x0b0f18, 0.5);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xbcd9ff, 1.45);
    this.dir.position.set(14, 24, 12);
    this.dir.castShadow = true;
    const d = 34;
    this.dir.shadow.camera.left = -d; this.dir.shadow.camera.right = d;
    this.dir.shadow.camera.top = d; this.dir.shadow.camera.bottom = -d;
    this.dir.shadow.camera.near = 1; this.dir.shadow.camera.far = 90;
    this.dir.shadow.bias = -0.0012;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.dir);
    this.rim = new THREE.DirectionalLight(0xff6a24, 0.5);
    this.rim.position.set(-12, 8, -16);
    this.scene.add(this.rim);
    // ambient dust
    const N = 400;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 40 - 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x25d9ff, size: 0.07, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.dust);
    // horizon grid
    const horizon = new THREE.GridHelper(180, 45, 0x0e2f42, 0x0a1a26);
    horizon.position.y = -12;
    this.scene.add(horizon);
    this.horizon = horizon;
  },
  applySettings() {
    const s = Save.data.settings;
    const q = QUALITY[s.quality] || QUALITY.medium;
    this.quality = s.quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
    this.renderer.shadowMap.enabled = !!s.shadows;
    if (this.dir) {
      this.dir.castShadow = !!s.shadows;
      this.dir.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      if (this.dir.shadow.map) { this.dir.shadow.map.dispose(); this.dir.shadow.map = null; }
    }
    if (this.dust) this.dust.visible = !!s.particles;
    document.body.classList.toggle('nofx', !s.particles || s.motion);
    document.body.classList.toggle('flat', !!s.motion);
    document.body.classList.toggle('hifx', !s.motion);
    document.body.style.setProperty('--accent', this.themeColor());
    document.documentElement.style.fontSize = s.bighud ? '16px' : '14px';
    document.body.classList.toggle('big', !!s.bighud);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },
  themeColor() {
    const t = THEMES.find(t => t.id === Save.data.theme) || THEMES[0];
    return t.color;
  },
  applyTheme() {
    const c = this.themeColor();
    document.body.style.setProperty('--accent', c);
    if (this.player) this.player.setThemeColor(c);
  },
  onResize() {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },

  /* ------------------------------------------------ level flow ----- */
  loadLevel(level, opts = {}) {
    Sfx.init(); Sfx.resume();
    if (this.boss && this.boss.nodes) this.boss.nodes.forEach(n => { this.scene.remove(n.mesh); });
    if (this.anomaly) { this.scene.remove(this.anomaly.mesh); this.anomaly = null; }
    if (this.world) { this.world.dispose(); this.world = null; }
    this.level = level;
    this.mode = opts.mode || 'story';
    this.world = new World(this.scene, level);
    this.gravityMode = level.gravity || 'down';
    this.gravityVec.copy(GRAV_VECTORS[this.gravityMode]);
    this.player.reset(v3(level.spawn));
    this.player.setGravity(this.gravityVec);
    this.player.hp = this.player.maxHp;
    this.lastSafe.copy(this.player.pos);
    this.applyBrightness(50);
    this.world.brightness = 50; this.world.volume = 0;
    if (this.world.consoles.brightness) this.world.setSliderVisual(this.world.consoles.brightness, 50);
    if (this.world.consoles.volume) this.world.setSliderVisual(this.world.consoles.volume, 0);
    this.snapshots = []; this.pauseCd = 0; this.freezeTimer = 0;
    this.rewinds = CFG.maxRewinds; this.corruption = 0; this.energy = 0;
    this.abilities = { doubleJump: false }; this.slowUntil = 0; this.shieldUntil = 0;
    this.famine = false; this.rewindFx = 0; this.shakeAmt = 0;
    this.stats = { damage: 0, rewinds: 0, recycles: 0, pauses: 0, gravities: 0, interactions: 0, shards: 0, optionalDone: 0, blocks: 0 };
    this.hurtCd = 0; this.movedWindows = false; this.gateHome = null;
    this.levelTime = 0;
    this.flags = { bridge: false, windkill: false, reveal: false, shield: false, plate: false };
    this.director = new GlitchDirector(this);
    this.boss = null;
    if (level.boss) this.setupBoss(level);
    /* camera faces the level interior */
    const dir = this.world.exit ? this.world.exit.pos.clone().sub(this.player.pos) : new THREE.Vector3(0, 0, -1);
    this.camYaw = Math.atan2(-dir.x, -dir.z);
    this.camPitch = 0.24;
    this.camPos.copy(this.player.pos).add(new THREE.Vector3(0, 3, 9));
    this.state = 'playing'; this.paused = false;
    UI.enterGame(level);
    Sfx.setMode(level.boss ? 'boss' : 'game');
    if (!Save.data.hintsSeen) { }
    this.toast('LEVEL ' + level.id + ' · ' + level.name, 'good');
    setTimeout(() => { if (this.level === level && level.hints && Save.data.settings.hints) this.showSubtitle(level.hints[0], 'hint'); }, 900);
    this.pickList = null;
  },
  quitToMenu() {
    this.state = 'menu'; this.paused = false;
    if (this.world) { this.world.dispose(); this.world = null; }
    this.level = null;
    UI.show('menu');
    Sfx.setMode('menu');
    document.getElementById('hud').classList.remove('active');
    document.getElementById('touch').classList.remove('on');
  },
  applyBrightness(v) {
    const t = v / 100;
    this.ambient.intensity = 0.12 + t * 0.95;
    this.hemi.intensity = 0.08 + t * 0.72;
    this.dir.intensity = 0.35 + t * 1.5;
    this.rim.intensity = 0.15 + (1 - t) * 0.7;
    this.scene.background.setHSL(0.6, 0.35, 0.018 + t * 0.035);
    this.scene.fog.density = 0.03 - t * 0.021;
    document.getElementById('fx').style.opacity = (0.45 + (1 - t) * 0.5).toFixed(2);
  },
  /* ------------------------------------------------ hud helpers ---- */
  sfx(name) { try { Sfx[name] && Sfx[name](); } catch (e) { } },
  toast(msg, kind = '') {
    const host = document.getElementById('toast');
    if (!host) return;
    const t = el('div', 'tmsg ' + kind, msg);
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2100);
    setTimeout(() => t.remove(), 2500);
    while (host.children.length > 4) host.firstChild.remove();
  },
  showSubtitle(text, kind) {
    if (kind !== 'hint' && !Save.data.settings.subs) return;
    const s = document.getElementById('subtitle');
    s.textContent = text;
    s.style.color = kind === 'hint' ? '#bfe8ff' : '#ffd0bc';
    s.classList.add('on');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => s.classList.remove('on'), kind === 'hint' ? 5200 : 4200);
  },
  glitchFlash(amount = 0.4) {
    if (Save.data.settings.motion) return;
    const g = document.getElementById('glitchfx');
    g.classList.add('on');
    g.style.opacity = String(clamp(amount, 0, 1));
    clearTimeout(this._gf);
    this._gf = setTimeout(() => { g.classList.remove('on'); g.style.opacity = '0'; }, 380);
    Sfx.glitch();
  },
  shake(a) { if (!Save.data.settings.shake || Save.data.settings.motion) return; this.shakeAmt = Math.min(0.9, this.shakeAmt + a); },
  pulseCorruption(n) {
    this.corruption = clamp(this.corruption + n, 0, 100);
    if (this.corruption > 55) this.glitchFlash(0.3);
  },
  addEnergy(n) { this.energy = clamp(this.energy + n, 0, 99); Sfx.pickup(); },
  ringPulse(pos, color, size) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    m.position.copy(pos); m.rotation.x = Math.PI / 2;
    this.scene.add(m);
    const start = performance.now();
    const anim = () => {
      const t = (performance.now() - start) / 600;
      if (t >= 1 || !m.parent) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return; }
      m.scale.setScalar(1 + t * size);
      m.material.opacity = 0.9 * (1 - t);
      requestAnimationFrame(anim);
    };
    anim();
  },
  burst(pos, color, count = 14) {
    if (!Save.data.settings.particles) return;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.2, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(pts);
    const start = performance.now();
    const anim = () => {
      const t = (performance.now() - start) / 700;
      if (t >= 1 || !pts.parent) { this.scene.remove(pts); geo.dispose(); pts.material.dispose(); return; }
      const p = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        p[i * 3] += vel[i].x * 0.016;
        p[i * 3 + 1] += vel[i].y * 0.016;
        p[i * 3 + 2] += vel[i].z * 0.016;
        vel[i].y -= 0.22;
      }
      geo.attributes.position.needsUpdate = true;
      pts.material.opacity = 1 - t;
      requestAnimationFrame(anim);
    };
    anim();
  },
  /* ------------------------------------------------ snapshots ------ */
  snapshot(label) {
    if (!this.world) return;
    const snap = {
      label,
      player: { p: this.player.pos.toArray(), v: this.player.vel.toArray(), hp: this.player.hp },
      windows: this.world.windows.map(w => ({ p: w.pos.toArray(), w: w.w, h: w.h, a: w.active })),
      props: this.world.props.map(p => ({ p: p.pos.toArray(), v: p.vel.toArray(), dead: !!p.dead })),
      volume: this.world.volume, brightness: this.world.brightness,
      gravityMode: this.gravityMode,
      energy: this.energy, corruption: this.corruption,
      doors: this.world.doors.map(d => d.open),
      shards: this.world.shards.map(s => s.collected),
    };
    this.snapshots.push(snap);
    if (this.snapshots.length > 24) this.snapshots.shift();
  },
  applySnapshot(s) {
    this.player.pos.fromArray(s.player.p); this.player.vel.fromArray(s.player.v);
    this.player.hp = s.player.hp;
    this.world.windows.forEach((w, i) => {
      const d = s.windows[i]; if (!d) return;
      w.pos.fromArray(d.p); w.mesh.position.copy(w.pos);
      w.active = d.a; w.mesh.visible = d.a;
      if (Math.abs(w.w - d.w) > 0.05 || Math.abs(w.h - d.h) > 0.05) resizeWindow(w, d.w, d.h);
    });
    this.world.props.forEach((p, i) => {
      const d = s.props[i]; if (!d) return;
      p.pos.fromArray(d.p); p.vel.fromArray(d.v);
      p.dead = d.dead; p.active = !d.dead; p.mesh.visible = !d.dead;
      p.mesh.position.copy(p.pos);
    });
    this.world.volume = s.volume; this.world.brightness = s.brightness;
    if (this.world.consoles.volume) this.world.setSliderVisual(this.world.consoles.volume, s.volume);
    if (this.world.consoles.brightness) this.world.setSliderVisual(this.world.consoles.brightness, s.brightness);
    this.applyBrightness(s.brightness);
    this.gravityMode = s.gravityMode;
    this.gravityVec.copy(GRAV_VECTORS[s.gravityMode]);
    this.player.setGravity(this.gravityVec);
    this.energy = s.energy; this.corruption = s.corruption;
    s.doors.forEach((open, i) => { if (this.world.doors[i]) this.world.doors[i].open = open; });
    s.shards.forEach((c, i) => {
      const sh = this.world.shards[i];
      if (!sh) return;
      sh.collected = c; sh.mesh.visible = !c;
    });
    this.glitchFlash(0.5);
  },
  /* ------------------------------------------------ boss ----------- */
  setupBoss(level) {
    const b = level.bossData || {};
    this.boss = {
      stage: 0, t: 0, survive: b.surviveTime || 18, redirects: 0, needRedirects: b.neededRedirects || 3,
      nodes: [], nodesDone: 0, fireCd: 2, purgeHits: 0, escapeHold: 0, active: true, startedAt: this.time,
    };
    const nodes = (b.nodePositions || [[-9, 1.2, 4], [9, 1.2, 4]]);
    nodes.forEach((p, i) => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x8a5cff, emissiveIntensity: 1.6 }));
      g.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.055, 6, 24), MAT.cyan);
      g.add(ring);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0x8a5cff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(3.4, 3.4, 1); g.add(halo);
      const pos = new THREE.Vector3(i === 0 ? -11.4 : 11.4, 5.4, 4);
      g.position.copy(pos);
      g.visible = false;
      this.scene.add(g);
      const node = { kind: 'node', pos, half: new THREE.Vector3(0.9, 0.9, 0.9), mesh: g, done: false, idx: i };
      g.userData.ref = node;
      g.traverse(o => { if (o.isMesh) o.userData.ref = node; });
      this.boss.nodes.push(node);
    });
    this.bossNodeGroup = this.scene;
    if (this.world.glitchCore) {
      this.world.glitchCore.mesh.userData.ref = { kind: 'glitchcore', ...this.world.glitchCore };
      this.world.glitchCore.mesh.traverse(o => { if (o.isMesh) o.userData.ref = { kind: 'glitchcore', ...this.world.glitchCore }; });
    }
  },
  updateBoss(dt) {
    const b = this.boss; if (!b || !b.active) return;
    b.t += dt;
    const core = this.world.glitchCore;
    if (core) {
      core.mesh.rotation.y += dt * 0.6;
      core.rings.forEach((r, i) => { r.rotation.z += dt * (0.4 + i * 0.2); r.rotation.x += dt * 0.2; });
    }
    if (b.stage === 0) {
      const left = Math.max(0, b.survive - b.t);
      UI.bossBanner('SURVIVE · ' + left.toFixed(1) + 's');
      if (left <= 0) this.bossAdvance();
    } else if (b.stage === 1) {
      b.fireCd -= dt;
      if (b.fireCd <= 0) {
        b.fireCd = 2.3;
        if (core) {
          const dir = this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(core.pos).normalize();
          this.world.addProjectile(core.pos.clone().addScaledVector(dir, 2), dir);
          Sfx.beam();
        }
      }
      UI.bossBanner('REDIRECT ATTACKS · ' + b.redirects + '/' + b.needRedirects);
      if (b.redirects >= b.needRedirects) this.bossAdvance();
    } else if (b.stage === 2) {
      UI.bossBanner('INVERT GRAVITY · NODES ' + b.nodesDone + '/2');
      if (b.nodesDone >= 2) this.bossAdvance();
    } else if (b.stage === 3) {
      UI.bossBanner('FREEZE + REWIND THE PURGE · ' + b.purgeHits + '/2');
      if (b.purgeHits >= 2) this.bossAdvance();
    } else if (b.stage === 4) {
      const near = this.player.pos.distanceTo(core.pos) < 4.2;
      UI.bossBanner(near ? 'HOLD E TO PURGE THE CORE' : 'REACH THE SYSTEM CORE');
      if (near && Input.down('e')) {
        b.escapeHold += dt;
        if (b.escapeHold >= 3) { b.active = false; this.finishBoss(); }
      } else b.escapeHold = Math.max(0, b.escapeHold - dt);
      UI.bossBar(b.escapeHold / 3);
    }
  },
  bossAdvance() {
    const b = this.boss;
    b.stage++;
    b.t = 0;
    this.snapshot('boss');
    Save.write();
    Sfx.pause();
    if (b.stage === 1) {
      this.showSubtitle('GLITCH · "Fine. Let us see you catch this."');
      this.toast('STAGE 2 · REDIRECT ITS ATTACKS', 'good');
      this.world.movers.forEach(m => { m.speed *= 1.3; });
    } else if (b.stage === 2) {
      this.showSubtitle('GLITCH · "Up is a choice. Make it."');
      this.toast('STAGE 3 · INVERT GRAVITY, TOUCH BOTH NODES', 'good');
      this.boss.nodes.forEach(n => { n.mesh.visible = true; });
      this.boss.nodes.forEach(n => { if (n.mesh.visible) this.burst(n.pos, 0x8a5cff, 12); });
    } else if (b.stage === 3) {
      this.showSubtitle('GLITCH · "Purge protocol engaged."');
      this.toast('STAGE 4 · PAUSE AND REWIND TO SURVIVE', 'good');
      this.spawnPursuers(2);
      this.world.movers.forEach(m => { m.speed *= 1.4; });
      this.world.freezeTimer = 0;
      b.purgeHits = 0;
    } else if (b.stage === 4) {
      this.showSubtitle('GLITCH · "You are inside me now. That is not a victory."');
      this.toast('STAGE 5 · REACH THE CORE · HOLD E', 'good');
      this.glitchFlash(0.9);
      if (this.world.glitchCore) this.world.glitchCore.mesh.visible = true;
    }
  },
  finishBoss() {
    Save.data.stats.boss = (Save.data.stats.boss || 0) + 1;
    Save.write();
    this.completeLevel(true);
  },
  bossPurgeProgress(kind) {
    if (!this.boss || this.boss.stage !== 3) return;
    this.boss.purgeHits = Math.min(2, this.boss.purgeHits + 1);
    this.toast('PURGE COUNTERED · ' + this.boss.purgeHits + '/2', 'good');
    this.burst(this.player.pos, 0x25d9ff, 16);
  },
  onBossProjectileBlocked(w) {
    if (!this.boss) return;
    if (this.boss.stage === 1) {
      this.boss.redirects++;
      this.toast('ATTACK REDIRECTED ' + this.boss.redirects + '/' + this.boss.needRedirects, 'good');
      this.burst(w.pos, 0x25d9ff, 18);
    }
  },
  onNodeTouched(node) {
    if (!this.boss || node.done || node.mesh.visible === false) return;
    if (this.gravityMode === 'down') { this.toast('WALL NODES REQUIRE INVERTED GRAVITY', 'warn'); return; }
    node.done = true;
    node.mesh.visible = false;
    this.boss.nodesDone++;
    this.toast('NODE ' + (node.idx + 1) + ' RELEASED · ' + this.boss.nodesDone + '/2', 'good');
    this.burst(node.pos, 0x8a5cff, 22);
    Sfx.pickup();
  },
  /* ------------------------------------------------ interactions --- */
  getPickList() {
    if (this.pickList) return this.pickList;
    const list = [];
    const push = (obj) => {
      if (!obj || !obj.ref) return;
      list.push(obj);
    };
    const collect = root => root.traverse && root.traverse(o => {
      if (o.isMesh || o.isSprite) {
        let r = o;
        while (r && !r.userData.ref) r = r.parent;
        if (r && r.userData.ref) list.push(o);
      }
    });
    this.world.group.traverse(o => {
      if (o.isMesh) {
        let r = o;
        while (r && !r.userData.ref) r = r.parent;
        if (r && r.userData.ref) list.push(o);
      }
    });
    if (this.boss) this.boss.nodes.forEach(n => n.mesh.traverse(o => { if (o.isMesh) list.push(o); }));
    if (this.world.glitchCore) this.world.glitchCore.mesh.traverse(o => { if (o.isMesh) list.push(o); });
    this.pickList = list;
    return list;
  },
  raycastRef() {
    if (!this.world) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(Input.ndc, this.camera);
    ray.camera = this.camera;
    const hits = ray.intersectObjects(this.getPickList(), false);
    for (const h of hits) {
      let r = h.object;
      while (r && !r.userData.ref) r = r.parent;
      if (r && r.userData.ref) {
        const ref = r.userData.ref;
        if (ref.kind === 'node' || ref.kind === 'glitchcore') return ref;
        if (ref.active === false || ref.dead) continue;
        if (h.distance > 9) continue;
        return ref;
      }
    }
    return null;
  },
  onPointerDown(e) {
    if (this.state !== 'playing' || this.paused) return;
    if (e.button === 2) return;
    const ref = this.raycastRef();
    this.pressedOnCanvas = true;
    if (!ref) return;
    this.pointerActOn(ref);
  },
  onPointerUp(e) {
    if (this.state !== 'playing') return;
    if (this.dragWin) {
      this.dragWin.dragging = false;
      this.dragWin.mesh.scale.setScalar(1);
      this.checkWindowStack();
      this.dragWin = null;
      Sfx.snap();
    }
    if (this.draggingSlider) {
      this.draggingSlider = null;
    }
    this.stats.interactions++;
  },
  pointerActOn(ref) {
    const g = this;
    switch (ref.kind) {
      case 'window': {
        if (!ref.movable) { g.toast('WINDOW IS LOCKED BY THE SYSTEM', 'warn'); return; }
        g.snapshot('window grab');
        g.dragWin = ref;
        ref.dragging = true;
        ref.mesh.scale.setScalar(1.03);
        Sfx.grab();
        g.stats.interactions++;
        g.lastWin = ref;
        break;
      }
      case 'prop': {
        g.held = ref;
        Sfx.grab();
        break;
      }
      case 'pausebtn': Mechanics.pause(g); break;
      case 'gravbtn': Mechanics.setGravity(g, ref.dir); break;
      case 'volumeslider': g.draggingSlider = ref; break;
      case 'brightslider': g.draggingSlider = ref; break;
      case 'bin': {
        if (g.held) { Mechanics.recycle(g, g.held); g.held = null; }
        else if (g.dragWin) { Mechanics.recycle(g, g.dragWin); g.dragWin = null; }
        else g.toast('CARRY SOMETHING TO THE BIN', 'warn');
        break;
      }
      case 'node': g.onNodeTouched(ref); break;
      case 'glitchcore': break;
      default: break;
    }
  },
  onKey(k, ev) {
    if (this.state !== 'playing') return;
    if (k === 'escape') { UI.togglePause(); return; }
    if (this.paused) return;
    const has = kind => !!(this.world && this.world.consoles[kind]);
    if (k === 'z') { this.snapshotNow('rewind'); Mechanics.rewind(this); return; }
    if (k === 'f') { this.keyGrabWindow(); return; }
    if (k === 'r') { if (this.lastWin && this.lastWin.active) this.rotateWindow(this.lastWin); return; }
    if (k === '1') { if (has('pause')) Mechanics.pause(this); else this.toast('PAUSE CONSOLE NOT PRESENT', 'warn'); return; }
    if (k === '2') { if (has('volume')) this.nudgeSlider('volume', 12); else this.toast('VOLUME CONSOLE NOT PRESENT', 'warn'); return; }
    if (k === '3') { if (has('gravity')) this.cycleGravity(); else this.toast('GRAVITY PANEL NOT PRESENT', 'warn'); return; }
    if (k === '4') { if (has('brightness')) this.nudgeSlider('brightness', 12); else this.toast('BRIGHTNESS CONSOLE NOT PRESENT', 'warn'); return; }
    if (k === '5') { if (this.held) Mechanics.recycle(this, this.held), this.held = null; else this.toast('NOTHING TO RECYCLE', 'warn'); return; }
    if (k === 'x') return Mechanics.spend(this, 'doubleJump');
    if (k === 'c') return Mechanics.spend(this, 'slow');
    if (k === 'v') return Mechanics.spend(this, 'shield');
    if (k === '[') { if (this.lastWin) this.resizeWin(this.lastWin, -0.6, 0); return; }
    if (k === ']') { if (this.lastWin) this.resizeWin(this.lastWin, 0.6, 0); return; }
    if (k === '-') { if (this.lastWin) this.resizeWin(this.lastWin, 0, -0.35); return; }
    if (k === '=') { if (this.lastWin) this.resizeWin(this.lastWin, 0, 0.35); return; }
    if (k === 'e') { this.interactKey(); return; }
    if (k === 'j') { UI.showObjectives(); return; }
  },
  snapshotNow(label) { /* state before the action is pushed only if it differs */ },
  interactKey() {
    const ref = this.raycastRef();
    if (!ref) {
      if (this.held) { this.held = null; return; }
      this.toast('NOTHING IN REACH', 'warn');
      return;
    }
    if (ref.kind === 'pausebtn' || ref.kind === 'gravbtn' || ref.kind === 'bin' || ref.kind === 'node') this.pointerActOn(ref);
    else if (ref.kind === 'volumeslider') this.nudgeSlider('volume', 25);
    else if (ref.kind === 'brightslider') this.nudgeSlider('brightness', 25);
    else if (ref.kind === 'window') this.pointerActOn(ref);
    else if (ref.kind === 'prop') this.pointerActOn(ref);
  },
  cycleGravity() {
    const order = ['down', 'up', 'left', 'right'];
    const i = order.indexOf(this.gravityMode);
    Mechanics.setGravity(this, order[(i + 1) % order.length]);
  },
  nudgeSlider(kind, amount) {
    const c = this.world.consoles[kind];
    if (!c) return;
    const val = clamp(c.value + amount, 0, 100);
    if (kind === 'volume') Mechanics.setVolume(this, val);
    else Mechanics.setBrightness(this, val);
  },
  keyGrabWindow() {
    if (this.dragWin) { this.dragWin.dragging = false; this.dragWin.mesh.scale.setScalar(1); this.dragWin = null; return; }
    let best = null, bd = 1e9;
    this.world.windows.forEach(w => {
      if (!w.active) return;
      const d = w.pos.distanceTo(this.player.pos);
      if (d < bd) { bd = d; best = w; }
    });
    if (best && bd < 12) {
      this.snapshot('window grab');
      this.dragWin = best; best.dragging = true; this.lastWin = best;
      this.toast('WINDOW GRABBED · WHEEL/[ ] RESIZE · R ROTATE', '');
      Sfx.grab();
    } else this.toast('NO WINDOW IN RANGE', 'warn');
  },
  rotateWindow(w) {
    this.snapshot('window rotate');
    w.rotY = (w.rotY + Math.PI / 2) % (Math.PI * 2);
    w.mesh.rotation.y = w.rotY;
    const side = Math.abs(Math.sin(w.rotY)) > 0.5;
    if (side) w.half.set(0.26, w.h / 2 + 0.2, w.w / 2);
    else w.half.set(w.w / 2, w.h / 2 + 0.2, 0.26);
    Sfx.snap();
    this.stats.interactions++;
  },
  resizeWin(w, dw, dh) {
    this.snapshot('window resize');
    resizeWindow(w, w.w + dw, w.h + dh);
    this.stats.interactions++;
  },
  checkWindowStack() {
    const ws = this.world.windows.filter(w => w.active);
    let stacked = 0;
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
      if (ws[i].pos.distanceTo(ws[j].pos) < 2.4) stacked++;
    }
    if (stacked > 0) this.director.count('stack');
    this.movedWindows = true;
  },
  hurtPlayer(n) {
    if (this.shieldUntil > this.time) { this.toast('SHIELD ABSORBED THE HIT', 'good'); this.addEnergy(1); return; }
    const dead = this.player.hurt(n);
    this.pulseCorruption(4);
    this.shake(0.4);
    if (dead) this.fell(true);
  },
  fell(death = false) {
    if (this.level && this.level.sandbox) { this.player.reset(v3(this.level.spawn)); return; }
    if (death) {
      this.stats.damage += 1;
      this.player.hp = this.player.maxHp;
      this.toast('CONTAINMENT BREACH · RESPAWN', 'bad');
      Sfx.fail();
    } else {
      if (this.player.hp > 1) this.player.hp -= 1;
      this.toast('FALL DETECTED', 'warn');
    }
    this.player.reset(this.lastSafe.clone());
    this.snapshots = [];
    this.player.vel.set(0, 0, 0);
  },
  spawnAnomaly() {
    const p = this.player.pos.clone().add(new THREE.Vector3(0, 0, -6));
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshBasicMaterial({ color: 0x8a5cff, wireframe: true, transparent: true, opacity: 0.28 }));
    mesh.position.copy(p); this.scene.add(mesh);
    this.anomaly = { pos: p, mesh, half: new THREE.Vector3(2.2, 2.6, 2.2), cd: 0, t: 0 };
    this.toast('ANOMALY DEPLOYED NEARBY', 'bad');
  },
  spawnPursuers(n) {
    for (let i = 0; i < n; i++) {
      const m = this.world.addMover(
        this.player.pos.x + (Math.random() - 0.5) * 8, this.player.pos.y + 0.6, this.player.pos.z - 4 - i * 2,
        1.1, 1.1, 1.1, { hazard: true, axis: 'x', range: 2.5 + i, speed: 1.6 + Math.random(), phase: i });
      m.mesh.material = MAT.glitch;
      m.pursuer = true;
    }
    this.toast('PURSUER PROGRAMS DEPLOYED', 'bad');
    Sfx.crash();
  },
  /* ------------------------------------------------ update --------- */
  loop() {
    let last = performance.now();
    const frame = (now) => {
      this.animId = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(dt, 0.05);
      this.time += dt;
      this._frames = (this._frames || 0) + 1;
      if (this.state === 'playing' && !this.paused && this.world) this.update(dt);
      else this.idleUpdate(dt);
      if (this.renderer && this.camera) this.renderer.render(this.scene, this.camera);
      if (Input.dx || Input.dy) Input.consumeMouse();
    };
    this.animId = requestAnimationFrame(frame);
  },
  idleUpdate(dt) {
    // slow orbit in menus
    if (this.state !== 'playing') {
      this.camYaw += dt * 0.06;
      const target = new THREE.Vector3(0, 4, 0);
      const r = 22;
      this.camera.position.set(Math.sin(this.camYaw) * r, 9 + Math.sin(this.time * 0.3) * 0.6, Math.cos(this.camYaw) * r);
      this.camera.lookAt(target);
      if (this.player) { this.player.group.visible = false; this.player.trail.visible = false; }
      if (this.dust) this.dust.rotation.y += dt * 0.01;
    }
  },
  update(dt) {
    const w = this.world, p = this.player;
    this.levelTime += dt;
    this.player.group.visible = true;
    if (this.slowUntil > this.time) dt *= 0.45;
    // camera look
    const m = Input.consumeMouse();
    if (m.x || m.y) {
      this.camYaw -= m.x;
      this.camPitch = clamp(this.camPitch + (Save.data.settings.invert ? -m.y : m.y), -0.55, 1.25);
    }
    if (Input.down('q')) this.camYaw += dt * 1.4;
    // cooldowns
    this.pauseCd = Math.max(0, this.pauseCd - dt);
    if (w.freezeTimer > 0) w.freezeTimer = Math.max(0, w.freezeTimer - dt);

    // player physics
    if (this.state === 'playing') p.update(dt, this.camera);
    // containment: the player can never leave the level volume
    const bd = w.bounds;
    if (bd && (p.pos.x < bd.minX - 24 || p.pos.x > bd.maxX + 24 || p.pos.z < bd.minZ - 24 || p.pos.z > bd.maxZ + 24 || p.pos.y > (this.world.ceilingY || 46) || p.pos.y < -34)) {
      p.reset(this.lastSafe.clone());
      this.snapshots = [];
      p.vel.set(0, 0, 0);
      this.toast('CONTAINMENT RESET · NOTHING ABOVE YOU', 'warn');
      Sfx.fail();
    }

    // wind kill flag
    if (w.volume > 60) {
      w.props.forEach(pr => { if (pr.pos.y < -6 && !pr.dead) this.flags.windkill = true; });
    }
    // safe spot memory
    if (p.grounded && p.hp > 0) this.lastSafe.copy(p.pos);

    // world sim
    w.update(dt, p);

    // anomaly
    if (this.anomaly) {
      const a = this.anomaly;
      a.t += dt; a.mesh.rotation.y += dt; a.mesh.rotation.x += dt * 0.6;
      a.cd -= dt;
      if (aabbPoint(p.pos, a, 0.3) && a.cd <= 0) {
        a.cd = 6;
        this.flashZone('GRAVITY ANOMALY');
        const order = ['down', 'up', 'left', 'right'];
        Mechanics.setGravity(this, order[Math.floor(Math.random() * order.length)]);
      }
    }
    // shard pickup
    for (const s of w.shards) {
      if (s.collected) continue;
      if (s.pos.distanceTo(p.pos) < 1.5) {
        s.collected = true; s.mesh.visible = false;
        this.stats.shards++;
        this.addEnergy(1);
        this.burst(s.pos, 0x25ffb0, 12);
        this.toast('MEMORY SHARD · ' + this.stats.shards + '/' + w.shards.length, 'good');
        if (w.shards.every(x => x.collected)) { this.flags.allshards = true; }
      }
    }
    // hazard contact
    for (const hz of w.movers) {
      if (!hz.hazard) continue;
      if (aabbOverlap({ pos: p.pos, half: p.half }, hz)) {
        if (this.hurtCd > this.time) continue;
        this.hurtCd = this.time + 1.1;
        this.hurtPlayer(1);
        const push = p.pos.clone().sub(hz.pos).normalize().multiplyScalar(2.4);
        p.vel.add(push);
      }
    }
    // bins catch dragged/dropped objects
    if (w.consoles.bin) {
      const bin = w.consoles.bin;
      const inner = { pos: new THREE.Vector3(bin.x, bin.y + 1.1, bin.z), half: new THREE.Vector3(0.85, 0.9, 0.85) };
      w.props.forEach(pr => {
        if (!pr.dead && aabbPoint(pr.pos, inner, 0.15)) { Mechanics.recycle(this, pr); }
      });
      if (this.dragWin) {
        const dw = this.dragWin;
        if (aabbPoint(dw.pos, inner, 0.2)) {
          dw.dragging = false; this.dragWin = null;
          Mechanics.recycle(this, dw);
        }
      }
    }
    // dragging window
    if (this.dragWin) {
      const win = this.dragWin;
      if (!win.active) { this.dragWin = null; }
      else {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(Input.ndc, this.camera);
        ray.camera = this.camera;
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, win.pos);
        const hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(plane, hit)) {
          const snapTo = 0.25;
          win.pos.lerp(new THREE.Vector3(Math.round(hit.x / snapTo) * snapTo, Math.round(hit.y / snapTo) * snapTo, Math.round(hit.z / snapTo) * snapTo), 0.55);
        }
        // keep out of the player
        if (aabbOverlap({ pos: p.pos, half: p.half }, win)) {
          const away = p.pos.clone().sub(win.pos); away.y = 0;
          if (away.lengthSq() < 0.01) away.set(0, 0, 1);
          win.pos.add(away.normalize().multiplyScalar(0.35));
        }
        win.mesh.position.copy(win.pos);
        // wheel resize
        const wheel = Input.consumeWheel();
        if (wheel) this.resizeWin(win, wheel * 0.5, 0);
        if (Input.down('shift')) { }
      }
    }
    // dragging slider
    if (this.draggingSlider) {
      const c = this.draggingSlider;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(Input.ndc, this.camera);
      ray.camera = this.camera;
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(c.pos.x, c.pos.y, c.pos.z));
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) {
        const t = clamp((hit.y - (c.base.y + c.railY - c.railH / 2)) / c.railH, 0, 1);
        const val = Math.round(t * 100);
        if (c.kind === 'volumeslider') Mechanics.setVolume(this, val);
        else Mechanics.setBrightness(this, val);
      }
    }
    // carried prop
    if (this.held && !this.held.dead) {
      const pr = this.held;
      const target = p.pos.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.group.quaternion), 1.6);
      target.y += 0.6;
      pr.vel.set(target.x - pr.pos.x, target.y - pr.pos.y, target.z - pr.pos.z).multiplyScalar(9);
      pr.vel.clampLength(0, 14);
    }
    // carry/ride player with movers handled in world

    // flags for objectives
    if (w.plates.some(pl2 => pl2.pressed)) this.flags.plate = true;
    if (w.hidden.some(h => h.kind === 'hidden' ? h.active : h.shown)) this.flags.reveal = this.flags.reveal || w.hidden.some(h => h.active);
    if (w.brightness >= w.revealThreshold) this.flags.reveal = true;

    // exit check
    if (w.exit) {
      const d = w.exit.pos.distanceTo(p.pos);
      if (d < w.exit.radius + 0.6) this.completeLevel();
    }
    // reset gate (chapter 4-2)
    if (this.level.resetGate) {
      const rg = this.level.resetGate;
      const home = rg.ids.every(i => {
        const win = w.windows[i]; if (!win) return true;
        const homePos = this.level.windows[i];
        return Math.hypot(win.pos.x - homePos[0], win.pos.y - (homePos[1] + 0.17), win.pos.z - homePos[2]) < rg.tol;
      });
      const door = w.doors.find(d => d.id === rg.door);
      if (door) {
        const changed = home !== this.gateHome;
        this.gateHome = home;
        door.open = home;
        if (changed) {
          if (home) { this.toast('VERIFICATION PASSED · GATE OPEN', 'good'); Sfx.pickup(); door.mesh.material.emissiveIntensity = 0.9; }
          else { this.toast('VERIFICATION FAILED · WINDOWS DISPLACED', 'warn'); Sfx.click(); door.mesh.material.emissiveIntensity = 0.16; }
        }
      }
    }
    // boss projectiles also feed redirects
    // interactables hover
    this.updateHover();
    // glitch director
    this.director.tick(dt);
    if (this.world.volume >= 92 && Save.data.settings.shake) this.shake(0.06);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.4);
    this.rewindFx = Math.max(0, this.rewindFx - dt * 1.8);
    if (this.corruption > 60 && Math.random() < dt * 0.35) this.glitchFlash(0.22);
    // camera follow
    this.updateCamera(dt);
    // dust drift
    if (this.dust && this.dust.visible) this.dust.rotation.y += dt * 0.02;
    UI.updateHUD(this);
    this.updateBoss(dt);
    if (this.boss) this.updateBossNodes();
  },
  updateBossNodes() {
    if (!this.boss) return;
    if (this.boss.stage !== 2) return;
    this.boss.nodes.forEach(n => {
      if (!n.done && n.mesh.visible) {
        n.mesh.rotation.y += 0.02;
        if (n.pos.distanceTo(this.player.pos) < 2.0) this.onNodeTouched(n);
      }
    });
  },
  flashZone(txt) {
    const d = document.createElement('div');
    d.className = 'tmsg bad';
    d.textContent = txt;
    document.getElementById('toast').appendChild(d);
    setTimeout(() => d.remove(), 2000);
  },
  updateHover() {
    const ref = this.raycastRef();
    this.hovered = ref;
    const ch = document.getElementById('crosshair');
    const pr = document.getElementById('prompt');
    if (ref && PROMPTS[ref.kind]) {
      ch.classList.add('hot');
      const [key, label] = PROMPTS[ref.kind];
      pr.innerHTML = '<kbd>' + key + '</kbd>' + label;
      pr.classList.add('on');
    } else {
      ch.classList.remove('hot');
      pr.classList.remove('on');
    }
  },
  updateCamera(dt) {
    const p = this.player;
    const up = p.up;
    const focus = p.pos.clone().addScaledVector(up, 0.5);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const offset = new THREE.Vector3(
      Math.sin(this.camYaw) * cp,
      sp,
      Math.cos(this.camYaw) * cp
    ).multiplyScalar(this.camDist);
    // rotate offset so up axis applies (sideways gravity keeps camera sane)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    offset.applyQuaternion(q);
    let desired = focus.clone().add(offset);
    // simple obstruction pull-in
    const dir = desired.clone().sub(focus);
    const dist = dir.length();
    dir.normalize();
    const ray = new THREE.Raycaster(focus, dir, 0.4, dist);
    ray.camera = this.camera;
    const hits = ray.intersectObjects(this.world.group.children, true).filter(h => h.object.isMesh && !h.object.userData.wire);
    let allowed = dist;
    if (hits.length) allowed = Math.max(2.6, hits[0].distance - 0.35);
    desired = focus.clone().addScaledVector(dir, allowed);
    this.camPos.lerp(desired, 1 - Math.exp(-9 * dt));
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
    }
    this.camera.up.copy(up);
    this.camera.lookAt(focus);
  },
  /* ------------------------------------------------ completion ----- */
  completeLevel(boss = false) {
    if (this.state !== 'playing' || this.completing) return;
    this.completing = true;
    this.state = 'complete';
    Input.keys = {};
    const L = this.level;
    const totalShards = (L.shards || []).length;
    const opt = [];
    (L.optional || []).forEach(o => {
      let ok = false;
      if (o.id === 'shards') ok = this.stats.shards >= totalShards && totalShards > 0;
      if (o.id === 'norewind') ok = this.stats.rewinds === 0;
      if (o.id === 'nodamage') ok = this.stats.damage === 0;
      if (o.id === 'maxrewinds') ok = this.stats.rewinds <= 1;
      if (o.id === 'time') { const m = /(\d+)/.exec(o.text); ok = m ? this.levelTime <= parseInt(m[1], 10) : false; }
      if (ok) opt.push(o.id);
    });
    const st = {
      time: this.levelTime, shards: this.stats.shards, totalShards,
      damage: this.stats.damage, rewinds: this.stats.rewinds,
      interactions: this.stats.interactions, optionalDone: opt.length,
    };
    const score = computeScore(L, st);
    const xpGain = Math.round(score.total / 9);
    const isDaily = this.mode === 'daily';
    const isCustom = this.mode === 'custom';
    let record = null;
    if (!isCustom) {
      record = Save.addScore(isDaily ? 'daily' : L.id, score.total, Math.round(this.levelTime), { shards: this.stats.shards });
      Save.data.xp += xpGain;
      Save.data.lastLevel = L.id;
      Save.data.flags = Object.assign(Save.data.flags || {}, this.flags);
      if (this.stats.rewinds === 0) Save.data.flags.norewind = true;
      if (totalShards && this.stats.shards >= totalShards) Save.data.flags.allshards = true;
      Save.write();
    }
    const unlocked = Save.checkAchievements();
    Sfx.setMode('menu');
    Sfx.win();
    UI.showComplete({ level: L, score, st, opt, xpGain, record, boss, unlocked, mode: this.mode });
    document.getElementById('hud').classList.remove('active');
    document.getElementById('touch').classList.remove('on');
    this.completing = false;
  },
  onProjectileBlocked(w) {
    this.stats.blocks++;
    this.flags.shield = true;
    this.burst(w.pos, 0x25d9ff, 10);
    this.onBossProjectileBlocked(w);
  },
  /* ------------------------------------------------ rewind helper -- */
  rewindState() { return Mechanics.rewind(this); },
};
