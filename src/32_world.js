/* =====================================================================
   PHYSICS PRIMITIVES
   ===================================================================== */
function aabbOverlap(a, b) {
  const ap = a.pos, bp = b.pos, ah = a.half, bh = b.half;
  return Math.abs(ap.x - bp.x) < ah.x + bh.x &&
    Math.abs(ap.y - bp.y) < ah.y + bh.y &&
    Math.abs(ap.z - bp.z) < ah.z + bh.z;
}
function aabbPoint(p, b, pad = 0) {
  return Math.abs(p.x - b.pos.x) <= b.half.x + pad &&
    Math.abs(p.y - b.pos.y) <= b.half.y + pad &&
    Math.abs(p.z - b.pos.z) <= b.half.z + pad;
}
/** Move an AABB entity through the world, resolving one axis at a time. */
function moveAndCollide(ent, delta, world) {
  const axes = ['y', 'x', 'z'];
  if (Math.abs(delta.x) > Math.abs(delta.z)) axes.splice(1, 2, 'x', 'z');
  else axes.splice(1, 2, 'z', 'x');
  const hit = { x: 0, y: 0, z: 0 };
  const vel = ent.vel ? ent.vel : new THREE.Vector3();
  /* substep so fast motion can never tunnel through thin geometry */
  const maxComp = Math.max(Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z));
  const steps = Math.min(10, Math.max(1, Math.ceil(maxComp / 0.28)));
  const stepDelta = delta.clone().multiplyScalar(1 / steps);
  for (let step = 0; step < steps; step++) {
    for (const ax of axes) {
      const amount = stepDelta[ax];
      if (!amount) continue;
      if (hit[ax]) continue;
      ent.pos[ax] += amount;
      for (const s of world.solids) {
        if (s.disabled || s.active === false || s === ent) continue;
        if (!aabbOverlap(ent, s)) continue;
        const sign = Math.sign(amount);
        const push = (s.half[ax] + ent.half[ax]) * (sign > 0 ? -1 : 1);
        ent.pos[ax] = s.pos[ax] + push + (sign > 0 ? -0.0005 : 0.0005);
        hit[ax] = sign;
        vel[ax] = 0;
      }
    }
  }
  return { hit, vel };
}
function separateDynamic(a, b) {
  if (!aabbOverlap(a, b)) return false;
  const dx = (a.half.x + b.half.x) - Math.abs(a.pos.x - b.pos.x);
  const dy = (a.half.y + b.half.y) - Math.abs(a.pos.y - b.pos.y);
  const dz = (a.half.z + b.half.z) - Math.abs(a.pos.z - b.pos.z);
  const m = Math.min(dx, dy, dz);
  if (m === dx) {
    const s = Math.sign(a.pos.x - b.pos.x) || 1;
    a.pos.x += s * dx * 0.5; b.pos.x -= s * dx * 0.5;
    a.vel.x *= 0.4; b.vel.x *= 0.4;
  } else if (m === dy) {
    const s = Math.sign(a.pos.y - b.pos.y) || 1;
    a.pos.y += s * dy * 0.5; b.pos.y -= s * dy * 0.5;
    a.vel.y *= 0.4; b.vel.y *= 0.4;
  } else {
    const s = Math.sign(a.pos.z - b.pos.z) || 1;
    a.pos.z += s * dz * 0.5; b.pos.z -= s * dz * 0.5;
    a.vel.z *= 0.4; b.vel.z *= 0.4;
  }
  return true;
}

/* glow sprite texture */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
let GLOW_TEX = null;

/* =====================================================================
   WORLD — builds a playable level out of declarative data
   ===================================================================== */
class World {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.solids = []; this.props = []; this.movers = []; this.hazards = [];
    this.turrets = []; this.shards = []; this.windows = []; this.interactables = [];
    this.doors = []; this.plates = []; this.beams = []; this.hidden = [];
    this.consoles = {}; this.wind = []; this.particles = [];
    this.paused = false; this.freezeTimer = 0;
    this.brightness = 50; this.volume = 0; this.gravityMode = 'down';
    this.revealThreshold = 70;
    this.build();
  }
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.dispose && !o.userData.sharedMat) o.material.dispose();
    });
  }
  boxMesh(w, h, d, mat, tint) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = mat.clone();
    m.userData = m.userData || {};
    if (m.map) { m.map = m.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(Math.max(1, w / 4), Math.max(1, h / 4)); }
    if (tint) m.color = new THREE.Color(tint);
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.sharedMat = false;
    return mesh;
  }
  addSolid(x, y, z, w, h, d, opts = {}) {
    const mat = opts.mat || MAT.platform;
    const mesh = this.boxMesh(w, h, d, mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    const solid = {
      pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(w / 2, h / 2, d / 2),
      mesh, solid: true, active: true, kind: opts.kind || 'platform',
      essential: false, window: false, dynamic: false, hidden: !!opts.hidden,
    };
    if (opts.hidden) {
      solid.active = false; mesh.visible = false;
      mesh.material = MAT.hidden.clone();
      this.hidden.push(solid);
    }
    this.solids.push(solid);
    return solid;
  }
  addWall(x, y, z, w, h, d) {
    return this.addSolid(x, y, z, w, h, d, { mat: MAT.wall, kind: 'wall' });
  }
  addWindow(x, y, z, w = 4, h = 2.6, opts = {}) {
    const g = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), MAT.glass.clone());
    const standRail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.52), MAT.glassFrame.clone());
    standRail.position.set(0, -h / 2 - 0.11, 0);
    standRail.castShadow = true;
    g.add(standRail);
    const frameMat = MAT.glassFrame.clone();
    const frame = new THREE.Group();
    const th = 0.09;
    const bars = [
      [0, h / 2, w, th], [0, -h / 2, w, th], [-w / 2, 0, th, h], [w / 2, 0, th, h],
    ];
    bars.forEach(([bx, by, bw, bh]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.10), frameMat);
      b.position.set(bx, by, 0); b.castShadow = true; frame.add(b);
    });
    // title bar — the grab handle
    const title = new THREE.Mesh(new THREE.BoxGeometry(w, 0.34, 0.12), new THREE.MeshStandardMaterial({ color: 0x0d1622, emissive: 0x25d9ff, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 }));
    title.position.set(0, h / 2 + 0.17, 0.01); frame.add(title);
    const dots = [-1, 0, 1].map(i => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), i === 0 ? MAT.orange : MAT.cyan);
      d.position.set(-w / 2 + 0.22 + (i + 1) * 0.17, h / 2 + 0.17, 0.08); frame.add(d); return d;
    });
    g.add(pane); g.add(frame);
    g.position.set(x, y, z);
    this.group.add(g);
    const win = {
      pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(w / 2, h / 2 + 0.2, 0.26),
      mesh: g, solid: true, active: true, window: true, essential: !!opts.essential,
      w, h, rotY: 0, thickness: 0.28, kind: 'window', movable: opts.movable !== false,
      y0: y,
    };
    win.pos.y += 0.17;
    g.userData.ref = win;
    g.traverse(o => { if (o.isMesh) { o.userData.ref = win; o.castShadow = true; } });
    this.solids.push(win); this.windows.push(win); this.interactables.push(win);
    return win;
  }
  addProp(x, y, z, s = 0.7, opts = {}) {
    const mesh = this.boxMesh(s, s, s, MAT.metal);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.12, s * 1.02), MAT.cyan);
    edge.position.y = s * 0.05; mesh.add(edge);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    const p = {
      pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(s / 2, s / 2, s / 2), vel: new THREE.Vector3(),
      mesh, solid: true, dynamic: true, active: true, kind: 'prop', recyclable: opts.recyclable !== false,
      essential: !!opts.essential, grabbable: true, mass: s * s,
    };
    mesh.userData.ref = p;
    this.solids.push(p); this.props.push(p); this.interactables.push(p);
    return p;
  }
  addShard(x, y, z, id) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), MAT.shard);
    g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0x25ffb0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(1.7, 1.7, 1); g.add(halo);
    g.position.set(x, y, z);
    this.group.add(g);
    const sh = { id, pos: new THREE.Vector3(x, y, z), mesh: g, collected: false, t: Math.random() * 6 };
    this.shards.push(sh);
    return sh;
  }
  addExit(x, y, z, label) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.1, 10, 32), MAT.orange);
    g.add(ring);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), new THREE.MeshBasicMaterial({ color: 0xff6a24, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    g.add(inner);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff6a24, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(4.4, 4.4, 1); g.add(halo);
    g.position.set(x, y, z);
    this.group.add(g);
    const p = { pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(1.1, 1.6, 1.1), mesh: g, kind: 'exit', ring, halo, radius: 1.5 };
    this.exit = p;
    return p;
  }
  /* --- interactive consoles ------------------------------------------ */
  makeConsoleBase(x, y, z, title, color) {
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.1, 10), MAT.metal);
    pillar.position.y = 0.55; pillar.castShadow = true; g.add(pillar);
    const face = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 0.16), new THREE.MeshStandardMaterial({ color: 0x0a1119, metalness: 0.7, roughness: 0.35, emissive: color, emissiveIntensity: 0.12 }));
    face.position.set(0, 1.75, 0); face.rotation.x = -0.28; g.add(face);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.02), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 }));
    strip.position.set(0, 2.33, 0.1); g.add(strip);
    g.position.set(x, y, z);
    this.group.add(g);
    const body = { pos: new THREE.Vector3(x, y + 0.9, z), half: new THREE.Vector3(0.9, 0.9, 0.4), mesh: g, solid: true, active: true, kind: 'console', essential: true };
    this.solids.push(body);
    return { group: g, body, y, x, z, title, color };
  }
  addPauseButton(x, y, z) {
    const base = this.makeConsoleBase(x, y, z, 'PAUSE', 0x25d9ff);
    const btn = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 22), new THREE.MeshStandardMaterial({ color: 0xff6a24, emissive: 0xff6a24, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 }));
    disc.rotation.x = Math.PI / 2; btn.add(disc);
    const bars = [0, 1].map(i => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.03), new THREE.MeshStandardMaterial({ color: 0x0a1119 }));
      b.position.set(i ? 0.1 : -0.1, 0, 0.07); btn.add(b); return b;
    });
    btn.position.set(0, 1.9, 0.14);
    base.group.add(btn);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff6a24, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(1.8, 1.8, 1); halo.position.copy(btn.position); base.group.add(halo);
    const hit = { pos: new THREE.Vector3(x, y + 1.9, z + 0.2), half: new THREE.Vector3(0.45, 0.4, 0.4), kind: 'pausebtn', mesh: btn, base, halo };
    btn.traverse(o => { if (o.isMesh) o.userData.ref = hit; });
    this.interactables.push(hit);
    this.consoles.pause = hit;
    return hit;
  }
  addSlider(x, y, z, kind) {
    const isVolume = kind === 'volume';
    const color = isVolume ? 0x25d9ff : 0xffd24a;
    const base = this.makeConsoleBase(x, y, z, kind.toUpperCase(), color);
    const railH = 1.5;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, railH, 0.1), MAT.dark);
    rail.position.set(0, 1.95, 0.16); base.group.add(rail);
    const ticks = [];
    for (let i = 0; i <= 4; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.02), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 }));
      t.position.set(0, 1.95 - railH / 2 + (railH * i) / 4, 0.2); base.group.add(t); ticks.push(t);
    }
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.2), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, metalness: 0.5, roughness: 0.3 }));
    knob.position.set(0, 1.95, 0.24); base.group.add(knob);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(1.6, 1.6, 1); halo.position.copy(knob.position); base.group.add(halo);
    const hit = { pos: new THREE.Vector3(x, y + 1.95, z + 0.25), half: new THREE.Vector3(0.6, 0.95, 0.5), kind: isVolume ? 'volumeslider' : 'brightslider', mesh: knob, base, halo, knob, railH, railY: 1.95, value: isVolume ? 0 : 50 };
    knob.userData.ref = hit;
    base.group.traverse(o => { if (o.isMesh && o !== knob) o.userData.ref = hit; });
    this.interactables.push(hit);
    this.consoles[kind] = hit;
    this.setSliderVisual(hit, hit.value);
    return hit;
  }
  setSliderVisual(c, v) {
    c.value = v;
    const t = clamp(v / 100, 0, 1);
    c.knob.position.y = c.railY - c.railH / 2 + c.railH * t;
  }
  addGravityPanel(x, y, z) {
    const base = this.makeConsoleBase(x, y, z, 'GRAVITY', 0x8a5cff);
    const dirs = [['up', '↑', 0, 0.42], ['down', '↓', 0, -0.42], ['left', '←', -0.42, 0], ['right', '→', 0.42, 0]];
    const btns = {};
    dirs.forEach(([id, lbl, bx, by]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.14), new THREE.MeshStandardMaterial({ color: 0x131c28, emissive: 0x8a5cff, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.4 }));
      b.position.set(bx, 1.95 + by, 0.18); base.group.add(b);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0xd9cbff, emissive: 0x8a5cff, emissiveIntensity: 0.9 }));
      arrow.position.set(0, 0, 0.09);
      if (id === 'up') arrow.rotation.z = 0; else if (id === 'down') arrow.rotation.z = Math.PI;
      else if (id === 'left') arrow.rotation.z = Math.PI / 2; else arrow.rotation.z = -Math.PI / 2;
      b.add(arrow);
      const hit = { pos: new THREE.Vector3(x + bx, y + 1.95 + by, z + 0.24), half: new THREE.Vector3(0.26, 0.26, 0.3), kind: 'gravbtn', dir: id, mesh: b, base, arrow };
      b.userData.ref = hit; arrow.userData.ref = hit;
      this.interactables.push(hit);
      btns[id] = hit;
    });
    this.consoles.gravity = { base, btns };
    return this.consoles.gravity;
  }
  addBin(x, y, z) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.72, 1.4, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x1b2432, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide }));
    shell.position.y = 0.7; shell.castShadow = true; g.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff3d5a, emissive: 0xff3d5a, emissiveIntensity: 1.2 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 1.4; g.add(rim);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0xff3d5a, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    inner.rotation.x = -Math.PI / 2; inner.position.y = 1.36; g.add(inner);
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.02), new THREE.MeshStandardMaterial({ color: 0xff3d5a, emissive: 0xff3d5a, emissiveIntensity: 0.9 }));
    label.position.set(0, 0.8, 0.82); g.add(label);
    g.position.set(x, y, z);
    this.group.add(g);
    const body = { pos: new THREE.Vector3(x, y + 0.7, z), half: new THREE.Vector3(0.95, 0.7, 0.95), mesh: g, solid: true, active: true, kind: 'bin', essential: true };
    this.solids.push(body);
    const bin = { pos: new THREE.Vector3(x, y + 1.0, z), half: new THREE.Vector3(0.95, 0.9, 0.95), mesh: g, kind: 'bin', body, x, y, z };
    this.interactables.push(bin);
    this.consoles.bin = bin;
    return bin;
  }
  addMover(x, y, z, w, h, d, opts = {}) {
    const mesh = this.boxMesh(w, h, d, opts.hazard ? MAT.hazard : MAT.metal);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    const m = {
      pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(w / 2, h / 2, d / 2), mesh,
      solid: true, active: true, kind: opts.hazard ? 'sweeper' : 'mover',
      axis: opts.axis || 'x', range: opts.range || 3, speed: opts.speed || 1.2,
      phase: opts.phase || 0, t: 0, origin: new THREE.Vector3(x, y, z),
      hazard: !!opts.hazard, freezeResist: !!opts.freezeResist, prev: new THREE.Vector3(x, y, z),
    };
    this.movers.push(m);
    if (m.hazard) this.hazards.push(m);
    return m;
  }
  addTurret(x, y, z, dir, opts = {}) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.5, 8), MAT.dark);
    g.add(base);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.7), MAT.glitch);
    head.position.set(0, 0.32, 0.1); g.add(head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3d5a, emissive: 0xff3d5a, emissiveIntensity: 2.4 }));
    eye.position.set(0, 0.32, 0.46); g.add(eye);
    g.position.set(x, y, z);
    this.group.add(g);
    const t = { pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(0.4, 0.5, 0.4), mesh: g, kind: 'turret', dir: new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(), cd: opts.delay || 1.5, rate: opts.rate || 2.6, projectiles: [] };
    this.turrets.push(t);
    this.solids.push({ ...t, solid: true, active: true });
    return t;
  }
  addProjectile(pos, dir) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3d5a, emissive: 0xff3d5a, emissiveIntensity: 2.6 }));
    mesh.position.copy(pos);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff3d5a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(1.3, 1.3, 1); mesh.add(halo);
    this.group.add(mesh);
    const p = { pos: pos.clone(), vel: dir.clone().multiplyScalar(15), mesh, life: 4, half: new THREE.Vector3(0.19, 0.19, 0.19) };
    this.projectiles = this.projectiles || [];
    this.projectiles.push(p);
    return p;
  }
  addPlate(x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 18), new THREE.MeshStandardMaterial({ color: 0x14202e, emissive: 0xff6a24, emissiveIntensity: 0.28, metalness: 0.7, roughness: 0.4 }));
    mesh.position.set(x, y, z); this.group.add(mesh);
    const p = { pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(1.0, 0.08, 1.0), mesh, kind: 'plate', pressed: false, id: opts.id || 'plate', needs: opts.needs || null };
    this.plates.push(p);
    return p;
  }
  addDoor(x, y, z, w, h, opts = {}) {
    const mesh = this.boxMesh(w, h, 0.4, new THREE.MeshStandardMaterial({ color: 0x1d2b3c, metalness: 0.85, roughness: 0.3, emissive: 0xff6a24, emissiveIntensity: 0.16 }));
    mesh.position.set(x, y, z); this.group.add(mesh);
    const d = {
      pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(w / 2, h / 2, 0.2), mesh,
      solid: true, active: true, kind: 'door', open: false, id: opts.id || 'door',
      y0: y, h, plate: opts.plate || null, require: opts.require || null, locked: !!opts.locked,
    };
    this.doors.push(d); this.solids.push(d);
    return d;
  }
  addBeam(x1, y1, z1, x2, y2, z2, opts = {}) {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(0.07, 0.07, len, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3d5a, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.group.add(mesh);
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3d5a, emissive: 0xff3d5a, emissiveIntensity: 2 }));
    emitter.position.copy(a); this.group.add(emitter);
    const beam = { a, b, mesh, blocked: false, kind: 'beam', door: opts.door || null, id: opts.id || 'beam' };
    this.beams.push(beam);
    return beam;
  }
  addHiddenPlatform(x, y, z, w, h, d) {
    const s = this.addSolid(x, y, z, w, h, d, { hidden: true, kind: 'hidden' });
    return s;
  }
  addClue(x, y, z, text, opts = {}) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 512, 128);
    g.font = 'bold 54px monospace'; g.fillStyle = '#25D9FF'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#25D9FF'; g.shadowBlur = 18;
    g.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    mesh.position.set(x, y, z); mesh.rotation.y = opts.rotY || 0;
    this.group.add(mesh);
    const clue = { pos: new THREE.Vector3(x, y, z), mesh, kind: 'clue', threshold: opts.threshold || 60, shown: false };
    this.hidden.push(clue);
    return clue;
  }
  addWindRegion(x, y, z, w, h, d, dir, opts = {}) {
    const region = { pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(w / 2, h / 2, d / 2), dir: new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(), max: opts.max || 26, id: opts.id || 'wind' };
    this.wind.push(region);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0x25d9ff, transparent: true, opacity: 0.03, depthWrite: false, side: THREE.DoubleSide }));
    box.position.set(x, y, z); box.userData.wire = true; this.group.add(box);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: 0x25d9ff, transparent: true, opacity: 0.16 }));
    wire.position.set(x, y, z); this.group.add(wire);
    region.wire = wire;
    return region;
  }
  addGlitchCore(x, y, z) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), MAT.glitch);
    core.castShadow = true; g.add(core);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.0 + i * 0.42, 0.045, 6, 40), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x25d9ff : 0xff6a24, emissive: i % 2 ? 0x25d9ff : 0xff6a24, emissiveIntensity: 1.3 }));
      r.rotation.set(Math.random() * 3, Math.random() * 3, 0); rings.push(r); g.add(r);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff3d5a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(11, 11, 1); g.add(halo);
    g.position.set(x, y, z);
    this.group.add(g);
    this.glitchCore = { pos: new THREE.Vector3(x, y, z), half: new THREE.Vector3(1.5, 1.5, 1.5), mesh: g, core, rings, halo, kind: 'glitchcore' };
    return this.glitchCore;
  }
  /* --- construction -------------------------------------------------- */
  build() {
    const L = this.level;
    if (!L) return;
    (L.platforms || []).forEach(p => this.addSolid(...p));
    (L.walls || []).forEach(p => this.addWall(...p));
    (L.windows || []).forEach(p => this.addWindow(...p));
    (L.props || []).forEach(p => this.addProp(...p));
    (L.shards || []).forEach((p, i) => this.addShard(p[0], p[1], p[2], 's' + i));
    (L.movers || []).forEach(p => this.addMover(...p));
    (L.turrets || []).forEach(p => this.addTurret(...p));
    (L.plates || []).forEach(p => this.addPlate(...p));
    (L.doors || []).forEach(p => this.addDoor(...p));
    (L.beams || []).forEach(p => this.addBeam(...p));
    (L.hidden || []).forEach(p => this.addHiddenPlatform(...p));
    (L.clues || []).forEach(p => this.addClue(...p));
    (L.wind || []).forEach(p => this.addWindRegion(...p));
    if (L.consoles) {
      const c = L.consoles;
      if (c.pause) this.addPauseButton(...c.pause);
      if (c.volume) this.addSlider(c.volume[0], c.volume[1], c.volume[2], 'volume');
      if (c.brightness) this.addSlider(c.brightness[0], c.brightness[1], c.brightness[2], 'brightness');
      if (c.gravity) this.addGravityPanel(...c.gravity);
      if (c.bin) this.addBin(...c.bin);
    }
    if (L.exit) this.addExit(L.exit[0], L.exit[1], L.exit[2]);
    if (L.glitchCore) this.addGlitchCore(...L.glitchCore);
    if (L.platforms) {
      // base deck under everything so falls are readable
      const minX = Math.min(...L.platforms.map(p => p[0] - p[3] / 2)) - 6;
      const maxX = Math.max(...L.platforms.map(p => p[0] + p[3] / 2)) + 6;
      const minZ = Math.min(...L.platforms.map(p => p[2] - p[5] / 2)) - 6;
      const maxZ = Math.max(...L.platforms.map(p => p[2] + p[5] / 2)) + 6;
      const w = maxX - minX, d = maxZ - minZ;
      const grid = new THREE.GridHelper(Math.max(w, d) * 1.4, Math.max(w, d) * 1.4 / 2, 0x123047, 0x0d1d2c);
      grid.position.set((minX + maxX) / 2, -6, (minZ + maxZ) / 2);
      grid.material.opacity = 0.5; grid.material.transparent = true;
      this.group.add(grid);
      const topY = Math.max(...L.platforms.map(p => p[1] + p[4] / 2));
      this.bounds = { minX, maxX, minZ, maxZ };
      this.ceilingY = topY + 16;
    }
  }
  /* --- per frame ----------------------------------------------------- */
  update(dt, player) {
    const freezeScale = this.freezeTimer > 0 ? 1 : 0;
    // movers
    for (const m of this.movers) {
      m.prev.copy(m.pos);
      m.t += dt;
      const frozen = this.freezeTimer > 0;
      const scale = frozen ? (m.freezeResist ? 0.22 : 0) : 1;
      const off = Math.sin(m.t * m.speed + m.phase) * m.range;
      const np = m.origin.clone();
      np[m.axis] += off * (frozen && !m.freezeResist ? 1 : 1);
      // when frozen, hold position: integrate phase backwards so it resumes smoothly
      if (scale === 0) np.copy(m.pos);
      else if (scale < 1) {
        np.set(m.pos.x, m.pos.y, m.pos.z);
        const dp = Math.sin(m.t * m.speed + m.phase) * m.range - Math.sin((m.t - dt) * m.speed + m.phase) * m.range;
        np[m.axis] += dp * scale;
      }
      const delta = np.clone().sub(m.pos);
      m.pos.copy(np);
      m.mesh.position.copy(m.pos);
      // carry rider
      if (player && player.groundBody === m && !m.hazard) player.pos.add(delta);
    }
    // props physics
    const windActive = this.volume / 100;
    for (const p of this.props) {
      if (p.dead) continue;
      const gdir = Game.gravityVec;
      p.vel.addScaledVector(gdir, CFG.gravity * 0.85 * dt);
      // wind
      if (windActive > 0.02) {
        for (const w of this.wind) {
          if (aabbPoint(p.pos, w, 0.2)) {
            p.vel.addScaledVector(w.dir, w.max * windActive * dt * (1.4 / Math.max(0.5, p.mass)));
          }
        }
      }
      // drag
      p.vel.multiplyScalar(1 - 0.9 * dt);
      p.vel.y = clamp(p.vel.y, -30, 30);
      const d = p.vel.clone().multiplyScalar(dt);
      moveAndCollide(p, d, this);
      // grounded damping
      const probe = { pos: p.pos.clone().add(new THREE.Vector3(0, -0.06, 0)), half: p.half };
      let grounded = false;
      for (const s of this.solids) { if (s === p || s.disabled || !s.active) continue; if (aabbOverlap(probe, s)) { grounded = true; break; } }
      if (grounded && p.vel.y < 0) { p.vel.y = 0; p.vel.x *= 0.86; p.vel.z *= 0.86; p.onGround = true; } else p.onGround = false;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y += dt * 0.2;
      if (p.pos.y < -30) { p.dead = true; p.mesh.visible = false; p.active = false; }
    }
    for (let i = 0; i < this.props.length; i++) {
      for (let j = i + 1; j < this.props.length; j++) {
        if (this.props[i].dead || this.props[j].dead) continue;
        separateDynamic(this.props[i], this.props[j]);
        this.props[i].mesh.position.copy(this.props[i].pos);
        this.props[j].mesh.position.copy(this.props[j].pos);
      }
    }
    // turrets + projectiles
    for (const t of this.turrets) {
      t.cd -= dt * (this.freezeTimer > 0 ? 0 : 1);
      if (t.cd <= 0 && !this.freezeTimer) {
        t.cd = t.rate;
        const origin = t.pos.clone().addScaledVector(t.dir, 0.6);
        this.addProjectile(origin, t.dir);
        Sfx.beam();
      }
    }
    this.projectiles = this.projectiles || [];
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.life -= dt;
      const old = pr.pos.clone();
      pr.pos.addScaledVector(pr.vel, dt);
      pr.mesh.position.copy(pr.pos);
      if (pr.life <= 0) { pr.dead = true; pr.mesh.visible = false; continue; }
      // window blocking (segment sweep so fast shots cannot tunnel through glass)
      for (const w of this.windows) {
        if (!w.active) continue;
        const box = { pos: w.pos, half: w.half };
        if (segmentBox(old, pr.pos, box)) {
          pr.dead = true; pr.mesh.visible = false;
          Game.onProjectileBlocked(w);
          break;
        }
      }
      if (pr.dead) continue;
      if (segmentBox(old, pr.pos, { pos: player.pos, half: player.half })) {
        pr.dead = true; pr.mesh.visible = false;
        Game.hurtPlayer(1);
      }
    }
    if (this.projectiles.length > 40) this.projectiles = this.projectiles.filter(p => !p.dead);
    // beams blocked by windows
    for (const b of this.beams) {
      let blocked = false;
      for (const w of this.windows) {
        if (!w.active) continue;
        if (segmentBox(b.a, b.b, w)) { blocked = true; break; }
      }
      b.blocked = blocked;
      b.mesh.material.opacity = blocked ? 0.06 : 0.8;
      if (b.door) { b.door.open = !blocked; }
    }
    // plates
    for (const p of this.plates) {
      let pressed = false;
      const box = { pos: p.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), half: new THREE.Vector3(1.0, 0.35, 1.0) };
      for (const w of this.windows) { if (w.active && aabbPoint(w.pos, box, 0.1)) pressed = true; }
      for (const pr of this.props) { if (!pr.dead && aabbPoint(pr.pos, box, 0.1)) pressed = true; }
      if (aabbPoint(player.pos, box, 0.1)) pressed = true;
      p.pressed = pressed;
      p.mesh.material.emissiveIntensity = pressed ? 1.4 : 0.28;
    }
    // doors follow plate/beam
    for (const d of this.doors) {
      let open = d.open;
      if (d.plate) { const pl = this.plates.find(x => x.id === d.plate); if (pl) open = pl.pressed; }
      if (d.require === 'allplates') open = this.plates.length > 0 && this.plates.every(p => p.pressed);
      if (d.require === 'beam') open = this.beams.length > 0 && this.beams.some(b => b.blocked);
      d.open = open;
      const targetY = open ? d.y0 + d.h * 0.95 : d.y0;
      d.pos.y = damp(d.pos.y, targetY, 7, dt);
      d.mesh.position.y = d.pos.y;
      d.active = !open;
    }
    // shard spin
    for (const s of this.shards) {
      if (s.collected) continue;
      s.t += dt;
      s.mesh.rotation.y += dt * 1.6;
      s.mesh.position.y = s.pos.y + Math.sin(s.t * 2) * 0.16;
    }
    // hidden reveals
    const revealOn = this.brightness >= this.revealThreshold;
    for (const h of this.hidden) {
      if (h.kind === 'clue') {
        const on = this.brightness >= (h.threshold || 60);
        h.mesh.material.opacity = damp(h.mesh.material.opacity, on ? 1 : 0, 6, dt);
        h.shown = on;
        continue;
      }
      const on = revealOn;
      if (h.mesh.visible !== on) {
        h.mesh.visible = on;
        if (on) Game.sfx('snap');
      }
      h.active = on;
      h.mesh.material.opacity = damp(h.mesh.material.opacity, on ? 0.55 : 0, 8, dt);
    }
    // wind visuals
    for (const w of this.wind) {
      if (w.wire) w.wire.material.opacity = 0.05 + (this.volume / 100) * 0.3;
    }
    // exit pulse
    if (this.exit) {
      this.exit.mesh.rotation.z += dt * 0.8;
      this.exit.ring.rotation.x = Math.sin(Game.time * 0.7) * 0.25;
      this.exit.halo.material.opacity = 0.4 + Math.sin(Game.time * 2) * 0.12;
    }
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
  }
}
/* segment vs AABB (slab test) */
function segmentBox(a, b, box) {
  const dir = b.clone().sub(a);
  let tmin = 0, tmax = 1;
  for (const ax of ['x', 'y', 'z']) {
    const o = a[ax], d = dir[ax];
    const lo = box.pos[ax] - box.half[ax], hi = box.pos[ax] + box.half[ax];
    if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) return false; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}
