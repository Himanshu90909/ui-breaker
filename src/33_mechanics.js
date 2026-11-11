/* =====================================================================
   SIGNATURE MECHANICS
   ===================================================================== */
const GRAV_VECTORS = {
  down: new THREE.Vector3(0, -1, 0),
  up: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
};
function makeWindowGroup(w, h) {
  const g = new THREE.Group();
  const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), MAT.glass.clone());
  g.add(pane);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.52), MAT.glassFrame.clone());
  rail.position.set(0, -h / 2 - 0.11, 0); rail.castShadow = true; g.add(rail);
  const frameMat = MAT.glassFrame.clone();
  const th = 0.09;
  [[0, h / 2, w, th], [0, -h / 2, w, th], [-w / 2, 0, th, h], [w / 2, 0, th, h]].forEach(([bx, by, bw, bh]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.1), frameMat);
    b.position.set(bx, by, 0); b.castShadow = true; g.add(b);
  });
  const title = new THREE.Mesh(new THREE.BoxGeometry(w, 0.34, 0.12), new THREE.MeshStandardMaterial({ color: 0x0d1622, emissive: 0x25d9ff, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 }));
  title.position.set(0, h / 2 + 0.17, 0.01); g.add(title);
  for (let i = -1; i <= 1; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), i === 0 ? MAT.orange : MAT.cyan);
    d.position.set(-w / 2 + 0.22 + (i + 1) * 0.17, h / 2 + 0.17, 0.08); g.add(d);
  }
  return g;
}
function resizeWindow(win, w, h) {
  win.w = clamp(w, 1.6, 10); win.h = clamp(h, 1.1, 6.5);
  win.half.set(win.w / 2, win.h / 2 + 0.2, 0.26);
  if (typeof Game !== 'undefined') Game.pickList = null;
  const parent = win.mesh.parent, pos = win.mesh.position.clone();
  win.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  parent.remove(win.mesh);
  const g = makeWindowGroup(win.w, win.h);
  g.position.copy(pos);
  g.userData.ref = win;
  g.traverse(o => { if (o.isMesh) { o.userData.ref = win; o.castShadow = true; } });
  parent.add(g);
  win.mesh = g;
  Sfx.snap();
}

const Mechanics = {
  pause(game) {
    const cd = game.pauseCd;
    if (cd > 0) { game.toast('PAUSE OFFLINE ' + cd.toFixed(1) + 's', 'warn'); Sfx.click(); return; }
    if (!game.world) return;
    game.snapshot('pause');
    game.world.freezeTimer = CFG.pauseDuration;
    game.pauseCd = CFG.pauseCooldown;
    game.stats.pauses++;
    Save.data.stats.pauses = (Save.data.stats.pauses || 0) + 1;
    Save.write();
    game.bossPurgeProgress('pause');
    game.director.count('pause');
    game.toast('SIMULATION FROZEN · ' + CFG.pauseDuration.toFixed(1) + 's', 'good');
    game.pulseCorruption(2);
    game.ringPulse(game.player.pos, 0x25d9ff, 6);
    Sfx.pause();
  },
  setGravity(game, mode) {
    if (!GRAV_VECTORS[mode]) return;
    game.snapshot('gravity');
    game.gravityMode = mode;
    game.gravityVec.copy(GRAV_VECTORS[mode]);
    game.player.setGravity(GRAV_VECTORS[mode]);
    game.world.gravityMode = mode;
    game.stats.gravities++;
    Save.data.stats.gravities = (Save.data.stats.gravities || 0) + 1;
    Save.write();
    game.director.count('gravity');
    game.toast('GRAVITY VECTOR → ' + mode.toUpperCase(), 'good');
    game.shake(0.25);
    game.ringPulse(game.player.pos, 0x8a5cff, 7);
    Sfx.gravity();
  },
  setBrightness(game, v) {
    v = clamp(Math.round(v), 0, 100);
    game.snapshot('brightness');
    game.world.brightness = v;
    if (game.world.consoles.brightness) game.world.setSliderVisual(game.world.consoles.brightness, v);
    game.applyBrightness(v);
    game.director.count('brightness');
    Sfx.click();
  },
  setVolume(game, v) {
    v = clamp(Math.round(v), 0, 100);
    const prev = game.world.volume;
    game.snapshot('volume');
    game.world.volume = v;
    if (game.world.consoles.volume) game.world.setSliderVisual(game.world.consoles.volume, v);
    game.director.count('volume');
    if (v >= 88 && prev < 88) {
      game.toast('VOLUME CRITICAL · ENVIRONMENT UNSTABLE', 'bad');
      game.pulseCorruption(6);
      game.shake(0.4);
      Sfx.glitch();
    }
  },
  recycle(game, ent) {
    if (!ent) return false;
    if (ent.essential || ent.kind === 'window' && ent.essential) {
      game.toast('PROTECTED SYSTEM OBJECT — CANNOT DELETE', 'bad');
      Sfx.fail(); return false;
    }
    if (ent.kind === 'window') {
      game.snapshot('recycle');
      ent.active = false; ent.mesh.visible = false;
    } else if (ent.dynamic) {
      game.snapshot('recycle');
      ent.dead = true; ent.active = false; ent.mesh.visible = false;
    } else {
      game.toast('THAT OBJECT IS PART OF THE STRUCTURE', 'warn');
      return false;
    }
    game.stats.recycles++;
    Save.data.stats.recycles = (Save.data.stats.recycles || 0) + 1;
    const gain = game.famine ? 1 : 3;
    game.addEnergy(gain);
    game.director.count('recycle');
    game.toast('RECYCLED · +' + gain + ' ENERGY', 'good');
    game.burst(ent.pos, 0xff3d5a, 16);
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + (game.energy >= 9 ? 0 : 0));
    Sfx.press();
    return true;
  },
  rewind(game) {
    if (game.rewinds <= 0) { game.toast('NO REWINDS LEFT', 'bad'); Sfx.fail(); return false; }
    if (!game.snapshots.length) { game.toast('NO ELIGIBLE STATE TO UNDO', 'warn'); Sfx.fail(); return false; }
    const snap = game.snapshots.pop();
    game.applySnapshot(snap);
    game.rewinds--;
    game.stats.rewinds++;
    Save.data.stats.rewinds = (Save.data.stats.rewinds || 0) + 1;
    game.corruption = Math.min(100, game.corruption + CFG.corruptionPerRewind);
    game.rewindFx = 1;
    game.bossPurgeProgress('rewind');
    game.director.count('rewind');
    game.toast('PARADOX RESTORED · ' + snap.label.toUpperCase(), 'good');
    Sfx.rewind();
    return true;
  },
  spend(game, kind) {
    const costs = { doubleJump: 5, slow: 4, shield: 6 };
    const cost = costs[kind];
    if (game.abilities[kind] && kind === 'doubleJump') { game.toast('DOUBLE JUMP ALREADY INSTALLED', 'warn'); return; }
    if (game.energy < cost) { game.toast('NEED ' + cost + ' ENERGY', 'warn'); Sfx.fail(); return; }
    game.snapshot('ability');
    game.energy -= cost;
    if (kind === 'doubleJump') { game.abilities.doubleJump = true; game.toast('ABILITY: DOUBLE JUMP ONLINE', 'good'); }
    if (kind === 'slow') { game.slowUntil = game.time + 6; game.toast('ABILITY: TIME DILATION 6s', 'good'); }
    if (kind === 'shield') { game.shieldUntil = game.time + 8; game.toast('ABILITY: SHIELD 8s', 'good'); }
    game.director.count('ability');
    Sfx.pickup();
  },
};

/* =====================================================================
   GLITCH DIRECTOR — deterministic adaptive antagonist
   ===================================================================== */
class GlitchDirector {
  constructor(game) {
    this.game = game;
    this.counts = { pause: 0, gravity: 0, brightness: 0, volume: 0, recycle: 0, rewind: 0, ability: 0, stack: 0, brightnessLow: 0 };
    this.fired = {};
    this.lastTaunt = 0;
    this.tauntQueue = [];
  }
  awareness() {
    const rev = this.game.corruption;
    const c = this.counts;
    const score = rev * 0.45 + c.pause * 4 + c.gravity * 5 + c.recycle * 3.5 + c.rewind * 7 + c.stack * 4 + c.volume * 1.2;
    return clamp(Math.round(score), 0, 100);
  }
  count(kind, val = 1) {
    this.counts[kind] = (this.counts[kind] || 0) + val;
    this.evaluate();
  }
  evaluate() {
    const g = this.game, c = this.counts;
    const fire = (key, fn) => { if (!this.fired[key]) { this.fired[key] = true; fn(); } };
    if (c.pause >= 3) fire('pause', () => {
      g.world.movers.forEach(m => { if (m.hazard) m.freezeResist = true; });
      this.say('I learned that trick. Those obstacles no longer respect your pause.');
      g.toast('GLITCH COUNTERMEASURE · FREEZE RESISTANCE', 'bad');
      g.shake(0.3);
    });
    if (c.gravity >= 3) fire('gravity', () => {
      g.spawnAnomaly();
      this.say('Gravity is a setting, not a toy. Let me make it unreliable.');
      g.toast('GLITCH COUNTERMEASURE · UNSTABLE GRAVITY ZONE', 'bad');
    });
    if (c.stack >= 1) fire('stack', () => {
      g.spawnPursuers(2);
      this.say('Stacking windows? Cute. The system pushes back.');
      g.toast('GLITCH COUNTERMEASURE · PURSUER PROGRAMS DEPLOYED', 'bad');
    });
    if (c.recycle >= 4) fire('recycle', () => {
      g.famine = true;
      this.say('Delete enough of me and the well runs dry.');
      g.toast('ENERGY OUTPUT HALVED · SHORTAGE', 'warn');
    });
    if (c.rewind >= 2) fire('rewind', () => {
      g.spawnPursuers(1);
      this.say('Every undo leaves a copy of you behind. I am collecting them.');
      g.toast('CORRUPTION RISING', 'bad');
    });
    if (this.awareness() >= 70) fire('high', () => {
      this.say('You are rewriting my kernel. I can feel every window you move.');
      g.toast('GLITCH IS WATCHING YOU', 'bad');
      g.pulseCorruption(4);
    });
  }
  say(line) {
    const g = this.game;
    g.showSubtitle('GLITCH · ' + line);
    Sfx.glitch();
    g.glitchFlash(0.5);
  }
  tick(dt) {
    this.lastTaunt += dt;
    if (this.lastTaunt > 26) {
      this.lastTaunt = 0;
      const lines = [
        'You are made of shortcuts and borrowed code.',
        'Every window you drag is a door I can close.',
        'The exit is a lie you keep believing.',
        'I was written in your own impatience.',
      ];
      if (this.awareness() > 35) this.say(lines[Math.floor(Math.random() * lines.length)]);
    }
  }
}
