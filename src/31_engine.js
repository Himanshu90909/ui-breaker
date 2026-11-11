/* =====================================================================
   ENGINE — renderer, materials, camera, player
   ===================================================================== */
let THREE;
try {
  THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
} catch (e) {
  THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
}

const QUALITY = {
  low: { dpr: 1, shadow: 0, particles: 90, shadowSize: 512 },
  medium: { dpr: 1.5, shadow: 1024, particles: 220, shadowSize: 1024 },
  high: { dpr: 2, shadow: 2048, particles: 400, shadowSize: 2048 },
};

function gridTexture(size = 256, line = 'rgba(37,217,255,0.30)', bg = '#0b1220', cell = 32) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  g.strokeStyle = line; g.lineWidth = 1;
  for (let i = 0; i <= size; i += cell) {
    g.beginPath(); g.moveTo(i + .5, 0); g.lineTo(i + .5, size); g.stroke();
    g.beginPath(); g.moveTo(0, i + .5); g.lineTo(size, i + .5); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
  g.strokeRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.anisotropy = 4;
  return t;
}

const MAT = {};
function buildMaterials() {
  const texPlat = gridTexture(256, 'rgba(37,217,255,0.26)', '#0c1521', 32);
  const texWall = gridTexture(256, 'rgba(138,92,255,0.18)', '#0a0f18', 64);
  MAT.platform = new THREE.MeshStandardMaterial({ map: texPlat, color: 0x9fb6cf, roughness: 0.55, metalness: 0.35, emissive: 0x061521, emissiveIntensity: 0.7 });
  MAT.wall = new THREE.MeshStandardMaterial({ map: texWall, color: 0x6a7c96, roughness: 0.8, metalness: 0.2 });
  MAT.metal = new THREE.MeshStandardMaterial({ color: 0x2a3749, roughness: 0.35, metalness: 0.9 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x111823, roughness: 0.7, metalness: 0.5 });
  MAT.orange = new THREE.MeshStandardMaterial({ color: 0xff6a24, roughness: 0.3, metalness: 0.5, emissive: 0xff6a24, emissiveIntensity: 0.75 });
  MAT.cyan = new THREE.MeshStandardMaterial({ color: 0x25d9ff, roughness: 0.25, metalness: 0.4, emissive: 0x25d9ff, emissiveIntensity: 0.9 });
  MAT.violet = new THREE.MeshStandardMaterial({ color: 0x8a5cff, roughness: 0.3, metalness: 0.4, emissive: 0x8a5cff, emissiveIntensity: 0.8 });
  MAT.glass = new THREE.MeshPhysicalMaterial({
    color: 0x8fe9ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28,
    transmission: 0.6, thickness: 0.4, emissive: 0x25d9ff, emissiveIntensity: 0.22, side: THREE.DoubleSide,
  });
  MAT.glassFrame = new THREE.MeshStandardMaterial({ color: 0x25d9ff, roughness: 0.3, metalness: 0.8, emissive: 0x25d9ff, emissiveIntensity: 0.5 });
  MAT.hazard = new THREE.MeshStandardMaterial({ color: 0xff3d5a, roughness: 0.4, metalness: 0.5, emissive: 0xff3d5a, emissiveIntensity: 0.6 });
  MAT.energy = new THREE.MeshStandardMaterial({ color: 0x25ffb0, emissive: 0x25ffb0, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2 });
  MAT.hidden = new THREE.MeshStandardMaterial({ color: 0x25d9ff, transparent: true, opacity: 0.0, emissive: 0x25d9ff, emissiveIntensity: 1.2, depthWrite: false });
  MAT.shard = new THREE.MeshStandardMaterial({ color: 0x7CFFB2, emissive: 0x25ffb0, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.3 });
  MAT.glitch = new THREE.MeshStandardMaterial({ color: 0xff3d5a, emissive: 0xff2440, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.6 });
}

/* ------------------------------ input ------------------------------ */
const Input = {
  keys: {}, mouseDown: false, rmb: false, ndc: { x: 0, y: 0 }, dx: 0, dy: 0, wheel: 0,
  touchMove: { x: 0, y: 0 }, touchActive: false, pointerInside: false,
  init(dom) {
    this.dom = dom;
    on(window, 'keydown', e => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (!this.keys[k]) this.keys[k] = true;
      if (Game && Game.onKey) Game.onKey(k, e);
    });
    on(window, 'keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    on(window, 'blur', () => { this.keys = {}; this.mouseDown = this.rmb = false; });
    on(dom, 'pointerdown', e => {
      this.pointerInside = true;
      if (e.button === 2 || e.button === 0) {
        if (e.button === 2) this.rmb = true; else this.mouseDown = true;
      }
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.setNdc(e);
      if (Game) Game.onPointerDown(e);
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
    });
    on(dom, 'pointerup', e => {
      this.mouseDown = false; this.rmb = false;
      if (Game) Game.onPointerUp(e);
    });
    on(dom, 'pointermove', e => {
      this.setNdc(e);
      if (this.mouseDown || this.rmb) {
        const s = Save.data.settings.sens / 100;
        this.dx = (e.clientX - (this.lastX ?? e.clientX)) * 0.0032 * s;
        this.dy = (e.clientY - (this.lastY ?? e.clientY)) * 0.0028 * s;
      }
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.pointerInside = true;
    });
    on(dom, 'pointerleave', () => { this.pointerInside = false; });
    on(dom, 'contextmenu', e => e.preventDefault());
    on(dom, 'wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
  setNdc(e) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  },
  consumeMouse() { const d = { x: this.dx, y: this.dy }; this.dx = 0; this.dy = 0; return d; },
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; },
  axis() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k['a'] || k['arrowleft']) x -= 1;
    if (k['d'] || k['arrowright']) x += 1;
    if (k['w'] || k['arrowup']) y += 1;
    if (k['s'] || k['arrowdown']) y -= 1;
    if (this.touchActive) { x += this.touchMove.x; y += this.touchMove.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  },
  down(k) { return !!this.keys[k]; },
};

/* ------------------------------ player ------------------------------ */
class PlayerActor {
  constructor(scene) {
    this.pos = new THREE.Vector3(0, 2, 0);
    this.vel = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.gravDir = new THREE.Vector3(0, -1, 0);
    this.half = new THREE.Vector3(CFG.playerHalf.x, CFG.playerHalf.y, CFG.playerHalf.z);
    this.grounded = false; this.groundBody = null;
    this.hp = 3; this.maxHp = 3;
    this.facing = new THREE.Vector3(0, 0, -1);
    this.coyote = 0; this.jumpBuffer = 0; this.animT = 0;
    this.build(scene);
  }
  build(scene) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x101a26, roughness: 0.4, metalness: 0.7, emissive: 0x0a2a3a, emissiveIntensity: 0.8 });
    const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.7, 4, 12), bodyMat);
    shell.position.y = 0.02; g.add(shell);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), new THREE.MeshStandardMaterial({ color: 0x25d9ff, emissive: 0x25d9ff, emissiveIntensity: 2.4, roughness: 0.1 }));
    visor.scale.set(1, 0.62, 0.72); visor.position.set(0, 0.42, -0.16); g.add(visor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 6, 26), MAT.cyan);
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.36; g.add(ring);
    const ant = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 6), MAT.orange);
    ant.position.set(0.16, 0.64, 0.08); ant.rotation.z = -0.25; g.add(ant);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), MAT.dark);
    pack.position.set(0, 0.02, 0.3); g.add(pack);
    const packGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.02), MAT.orange);
    packGlow.position.set(0, 0.06, 0.39); g.add(packGlow);
    this.ring = ring; this.visor = visor; this.group = g;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    scene.add(g);

    // trail
    const N = 46;
    const tg = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3);
    tg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const tm = new THREE.PointsMaterial({ color: 0x25d9ff, size: 0.16, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    this.trail = new THREE.Points(tg, tm); this.trail.frustumCulled = false;
    this.trailN = N; this.trailPos = arr;
    scene.add(this.trail);
  }
  setThemeColor(c) {
    this.visor.material.color.set(c); this.visor.material.emissive.set(c);
    this.ring.material.color.set(c); this.ring.material.emissive.set(c);
    this.trail.material.color.set(c);
  }
  setGravity(dir) {
    this.gravDir.copy(dir);
    this.up.copy(dir).multiplyScalar(-1);
    const h = CFG.playerHalf;
    const ax = Math.abs(this.up.x), ay = Math.abs(this.up.y), az = Math.abs(this.up.z);
    if (ax > 0.5) this.half.set(h.y, h.x, h.z);
    else if (az > 0.5) this.half.set(h.x, h.z, h.y);
    else this.half.set(h.x, h.y, h.z);
    // orient mesh
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.up);
    this.group.quaternion.copy(q);
  }
  reset(pos) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.hp = this.maxHp; this.grounded = false;
    this.trailLife = 0;
    for (let i = 0; i < this.trailPos.length; i += 3) { this.trailPos[i] = pos.x; this.trailPos[i + 1] = pos.y; this.trailPos[i + 2] = pos.z; }
  }
  hurt(n = 1) {
    if (Game.godMode) return false;
    this.hp = Math.max(0, this.hp - n);
    Game.sfx('hurt'); Game.shake(0.35);
    Game.stats.damage += n;
    Game.pulseCorruption(3);
    return this.hp <= 0;
  }
  update(dt, camera) {
    const g = Game;
    const up = this.up, grav = this.gravDir;
    // camera-relative basis
    const camF = new THREE.Vector3();
    camera.getWorldDirection(camF);
    let fwd = camF.clone().sub(up.clone().multiplyScalar(camF.dot(up)));
    if (fwd.lengthSq() < 1e-4) fwd = new THREE.Vector3(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const ax = Input.axis();
    const sprinting = Input.down('shift') && !g.rewinding;
    const targetSpeed = (sprinting ? CFG.sprint : CFG.walk) * (g.playerSlowed ? 0.55 : 1);
    const wish = new THREE.Vector3()
      .addScaledVector(fwd, ax.y)
      .addScaledVector(right, ax.x);
    if (wish.lengthSq() > 0.001) { wish.normalize().multiplyScalar(targetSpeed); this.facing.copy(wish).normalize(); }

    // horizontal (plane) velocity
    const vPlane = this.vel.clone().sub(up.clone().multiplyScalar(this.vel.dot(up)));
    const accel = this.grounded ? CFG.accel : CFG.airAccel;
    vPlane.x = damp(vPlane.x, wish.x, accel / 6, dt);
    vPlane.z = damp(vPlane.z, wish.z, accel / 6, dt);
    // preserve vertical component relative to up axis
    const vUp = this.vel.dot(up);
    this.vel.copy(vPlane).addScaledVector(up, vUp);

    // gravity on the up/down axis
    this.vel.addScaledVector(grav, CFG.gravity * dt);
    // clamp terminal
    const maxFall = 34;
    let vu = this.vel.dot(up);
    if (vu < -maxFall) this.vel.addScaledVector(up, -maxFall - vu);

    // jump
    if (Input.down(' ') || this.touchJump) {
      if (!this.jumpHeld) { this.jumpBuffer = 0.16; }
      this.jumpHeld = true;
    } else this.jumpHeld = false;
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0 && !g.rewinding) {
      this.vel.addScaledVector(up, CFG.jump);
      this.grounded = false; this.coyote = 0; this.jumpBuffer = 0;
      g.sfx('jump');
      if (g.abilities.doubleJump) { this.airJumps = 1; }
    }
    if (this.jumpBuffer > 0 && this.airJumps > 0 && !this.grounded) {
      this.airJumps--; this.vel.addScaledVector(up, CFG.jump * 0.86);
      this.jumpBuffer = 0; g.sfx('jump'); g.burst(this.pos, 0x25d9ff, 10);
    }

    if (g.playerFrozen) { this.vel.set(0, 0, 0); return; }

    // integrate + collide
    const delta = this.vel.clone().multiplyScalar(dt);
    this.groundBody = null;
    const res = moveAndCollide(this, delta, g.world);
    if (res.hit.y !== 0) this.vel.copy(res.vel);
    else this.vel.copy(res.vel);

    // ground probe
    const probe = {
      pos: this.pos.clone().addScaledVector(up, -0.09),
      half: this.half,
    };
    let ground = null;
    for (const s of g.world.solids) {
      if (s.disabled || !s.active) continue;
      if (aabbOverlap(probe, s)) { ground = s; break; }
    }
    this.grounded = !!ground && this.vel.dot(up) <= 0.4;
    this.groundBody = ground;
    if (this.grounded && this.vel.dot(up) < 0) {
      const vu2 = this.vel.dot(up);
      this.vel.addScaledVector(up, -vu2);
    }
    if (this.grounded) this.airJumps = 0;

    // out of bounds
    if (this.pos.y < -40 || Math.abs(this.pos.x) > 90 || Math.abs(this.pos.z) > 90) g.fell();

    // visuals
    this.animT += dt * (this.grounded ? (sprinting ? 14 : 8) : 4);
    this.group.position.copy(this.pos);
    const bob = this.grounded ? Math.sin(this.animT) * 0.03 : 0;
    this.group.position.addScaledVector(up, bob);
    let tilt = 0;
    if (this.grounded) { this.group.position.addScaledVector(right, Math.sin(this.animT * 0.5) * 0.02); }
    this.group.rotateY(0);
    if (wish.lengthSq() > 0.1) {
      const f = wish.clone().normalize();
      const localF = f.clone().applyQuaternion(this.group.quaternion.clone().invert());
      tilt = Math.atan2(localF.x, -localF.z) * 0.35;
    }
    this.ring.rotation.z += dt * 2.4;
    this.group.scale.y = damp(this.group.scale.y, this.grounded ? 1 : (this.vel.dot(up) > 0 ? 1.06 : 0.95), 8, dt);

    // trail
    const arr = this.trailPos;
    for (let i = arr.length - 3; i >= 3; i -= 3) { arr[i] = arr[i - 3]; arr[i + 1] = arr[i - 2]; arr[i + 2] = arr[i - 1]; }
    arr[0] = this.pos.x; arr[1] = this.pos.y + 0.1; arr[2] = this.pos.z;
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.visible = Save.data.settings.particles && !Save.data.settings.motion;
  }
}
