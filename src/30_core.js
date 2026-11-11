/* =====================================================================
   UI BREAKER : NEXUS OS — core systems
   ===================================================================== */
const VERSION = '1.0.0';
const CFG = {
  gravity: 26,
  walk: 7.2,
  sprint: 11.4,
  accel: 46,
  airAccel: 16,
  jump: 9.6,
  playerHalf: { x: 0.42, y: 0.86, z: 0.42 },
  step: 1 / 60,
  maxRewinds: 3,
  corruptionPerRewind: 14,
  pauseDuration: 4.2,
  pauseCooldown: 9,
  parBase: 70,
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const fmtTime = s => {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
};
const fmtNum = n => Math.round(n).toLocaleString('en-US');
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* deterministic rng */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---------------------------------------------------------------------
   AUDIO — all sound is synthesised, no external assets
   --------------------------------------------------------------------- */
const Sfx = {
  ctx: null, master: null, musicGain: null, sfxGain: null, musicTimer: null, started: false,
  mode: 'menu', _beat: 0,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.5;
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.8;
    this.musicGain.connect(this.master); this.sfxGain.connect(this.master); this.master.connect(this.ctx.destination);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.2, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startMusic();
  },
  applyVolumes() {
    if (!this.ctx) return;
    const s = Save.data.settings;
    this.master.gain.value = s.master;
    this.musicGain.gain.value = s.music * 0.5;
    this.sfxGain.gain.value = s.sfx;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, dur, type = 'sine', gain = 0.2, slideTo = null, dest = null, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, filterFreq, gain = 0.14, type = 'bandpass', when = 0) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t); src.stop(t + dur);
  },
  hover() { this.tone(1180, 0.045, 'sine', 0.05); },
  ui() { this.tone(520, 0.05, 'square', 0.05); this.tone(780, 0.07, 'sine', 0.04, null, null, 0.03); },
  press() { this.tone(240, 0.1, 'square', 0.16, 110); this.noise(0.09, 2200, 0.1); },
  click() { this.tone(660, 0.06, 'triangle', 0.1); },
  grab() { this.tone(330, 0.08, 'sine', 0.09, 520); },
  snap() { this.tone(880, 0.07, 'square', 0.07, 1200); this.noise(0.06, 3200, 0.05); },
  thud() { this.tone(90, 0.16, 'sine', 0.24, 52); this.noise(0.12, 320, 0.09); },
  jump() { this.tone(420, 0.1, 'sine', 0.09, 700); },
  pickup() { [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.11, null, null, i * 0.06)); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.42, 'triangle', 0.13, null, null, i * 0.12)); },
  fail() { this.tone(220, 0.5, 'sawtooth', 0.15, 60); this.noise(0.4, 400, 0.1); },
  hurt() { this.tone(160, 0.22, 'sawtooth', 0.18, 70); this.noise(0.18, 900, 0.12); },
  gravity() { this.tone(120, 0.42, 'sine', 0.18, 62); this.tone(640, 0.3, 'sine', 0.07, 240); },
  pause() { this.tone(880, 0.16, 'sine', 0.13, 300); this.noise(0.3, 1600, 0.06); },
  unfreeze() { this.tone(300, 0.2, 'sine', 0.11, 880); },
  rewind() {
    if (!this.ctx) return;
    for (let i = 0; i < 7; i++) this.tone(400 + i * 120, 0.14, 'sawtooth', 0.05, 150 + i * 60, null, i * 0.035);
    this.noise(0.5, 2400, 0.07, 'highpass');
  },
  glitch() {
    if (!this.ctx) return;
    for (let i = 0; i < 5; i++) this.tone(90 + Math.random() * 700, 0.05, 'square', 0.055, 40, null, i * 0.035);
    this.noise(0.16, 5200, 0.05);
  },
  beam() { this.tone(320, 0.3, 'sawtooth', 0.06, 480); },
  crash() { this.noise(0.3, 800, 0.16); this.tone(70, 0.3, 'sine', 0.2, 40); },
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scales = {
      menu: [0, 3, 5, 7, 10, 12, 15],
      game: [0, 2, 3, 7, 8, 12, 14],
      boss: [0, 1, 5, 6, 7, 11, 12],
    };
    const root = 55;
    const step = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const sc = scales[this.mode] || scales.menu;
      const b = this._beat++;
      const base = this.mode === 'boss' ? root * 0.94 : root;
      if (b % 4 === 0) {
        // pad chord
        [0, 3, 7].forEach((iv, i) => {
          const f = base * Math.pow(2, (iv + 12) / 12);
          this.tone(f, 2.6, 'sine', 0.05, null, this.musicGain);
          this.tone(f * 2.005, 1.6, 'triangle', 0.018, null, this.musicGain, i * 0.02);
        });
      }
      if (b % 2 === 0) {
        const n = sc[(b * 3) % sc.length];
        this.tone(base * 4 * Math.pow(2, n / 12), 0.5, 'triangle', 0.045, null, this.musicGain);
      }
      if (this.mode === 'boss' && b % 2 === 1) this.noise(0.08, 180, 0.03, 'lowpass');
      if (this.mode === 'game' && b % 8 === 3) this.noise(0.5, 4200, 0.015, 'highpass');
    };
    this.musicTimer = setInterval(step, 620);
  },
  setMode(m) { this.mode = m; }
};

/* ---------------------------------------------------------------------
   SAVE
   --------------------------------------------------------------------- */
const ACHIEVEMENTS = [
  { id: 'boot', name: 'Cold Boot', desc: 'Clear the first level of BOOT SEQUENCE.', test: s => !!s.levels['1-1']?.cleared },
  { id: 'first_win', name: 'Windows Break', desc: 'Use a window as a bridge and cross it.', test: s => !!s.flags?.bridge },
  { id: 'pause', name: 'System Halted', desc: 'Freeze a moving hazard with the pause console.', test: s => (s.stats?.pauses || 0) > 0 },
  { id: 'gravity', name: 'New Down', desc: 'Change gravity and keep moving.', test: s => (s.stats?.gravities || 0) > 0 },
  { id: 'vol', name: 'Feedback Loop', desc: 'Blow a prop off its ledge with volume.', test: s => !!s.flags?.windkill },
  { id: 'bright', name: 'See the Unseen', desc: 'Reveal a hidden platform with brightness.', test: s => !!s.flags?.reveal },
  { id: 'recycle', name: 'Null Reference', desc: 'Recycle an object into energy.', test: s => (s.stats?.recycles || 0) > 0 },
  { id: 'rewind', name: 'Undo Paradox', desc: 'Reverse a mistake with a rewind.', test: s => (s.stats?.rewinds || 0) > 0 },
  { id: 'norewind', name: 'Clean Compile', desc: 'Clear a level without using a rewind.', test: s => !!s.flags?.norewind },
  { id: 'shards', name: 'Memory Leak', desc: 'Collect every shard in a level.', test: s => !!s.flags?.allshards },
  { id: 'chapter2', name: 'Windows of Chaos', desc: 'Complete chapter 2.', test: s => ['2-1', '2-2', '2-3'].every(k => s.levels[k]?.cleared) },
  { id: 'boss', name: 'Root Access', desc: 'Defeat GLITCH.', test: s => (s.stats?.boss || 0) > 0 },
];
const THEMES = [
  { id: 'cyan', name: 'NEXUS Cyan', color: '#25D9FF', xp: 0 },
  { id: 'orange', name: 'Breach Orange', color: '#FF6A24', xp: 700 },
  { id: 'violet', name: 'Violet Kernel', color: '#8A5CFF', xp: 2200 },
  { id: 'lime', name: 'Signal Lime', color: '#7CFFB2', xp: 5200 },
];
const TRAILS = [
  { id: 'cyan', name: 'Ion Stream', color: '#25D9FF', xp: 0 },
  { id: 'orange', name: 'Ember Path', color: '#FF6A24', xp: 400 },
  { id: 'violet', name: 'Void Ribbon', color: '#8A5CFF', xp: 1600 },
  { id: 'white', name: 'Ghost Packets', color: '#DCEBFF', xp: 3800 },
];

const Save = {
  KEY: 'uibreaker.save.v1',
  data: null,
  defaults() {
    return {
      v: 1, name: '', xp: 0, levels: {}, ach: {}, flags: {},
      settings: {
        master: 0.8, music: 0.5, sfx: 0.85, quality: 'medium', shadows: true, particles: true,
        shake: true, sens: 100, invert: false, touch: false, hints: true,
        motion: false, contrast: false, bighud: false, subs: true,
      },
      theme: 'cyan', trail: 'cyan',
      stats: { rewinds: 0, boss: 0, total: 0, fastest: null, pauses: 0, gravities: 0, recycles: 0, playtime: 0 },
      daily: {}, custom: [], lb: {}, lastLevel: '1-1',
    };
  },
  load() {
    let raw = null;
    try { raw = localStorage.getItem(this.KEY); } catch (e) { raw = null; }
    const d = this.defaults();
    if (raw) {
      try {
        const p = JSON.parse(raw);
        this.data = { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, stats: { ...d.stats, ...(p.stats || {}) } };
      } catch (e) { this.data = d; }
    } else this.data = d;
    return this.data;
  },
  write() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { }
  },
  level(id) { return this.data.levels[id] || null; },
  xpLevel() { return 1 + Math.floor(this.data.xp / 1200); },
  xpInLevel() { return this.data.xp % 1200; },
  unlockedTheme(id) { const t = THEMES.find(t => t.id === id); return t && this.data.xp >= t.xp; },
  unlockedTrail(id) { const t = TRAILS.find(t => t.id === id); return t && this.data.xp >= t.xp; },
  checkAchievements() {
    const unlocked = [];
    ACHIEVEMENTS.forEach(a => {
      if (!this.data.ach[a.id] && a.test(this.data)) {
        this.data.ach[a.id] = Date.now();
        unlocked.push(a);
      }
    });
    if (unlocked.length) this.write();
    return unlocked;
  },
  addScore(levelId, score, time, extra) {
    const d = this.data;
    const rec = d.levels[levelId] || { cleared: false, best: 0, time: null, shards: 0, plays: 0 };
    rec.plays = (rec.plays || 0) + 1;
    rec.cleared = true;
    rec.best = Math.max(rec.best || 0, Math.round(score));
    rec.time = rec.time == null ? time : Math.min(rec.time, time);
    rec.shards = Math.max(rec.shards || 0, extra.shards || 0);
    d.levels[levelId] = rec;
    d.stats.total = Object.values(d.levels).reduce((a, r) => a + (r.best || 0), 0);
    const times = Object.values(d.levels).map(r => r.time).filter(t => typeof t === 'number' && t > 0);
    d.stats.fastest = times.length ? Math.min(...times) : null;
    const board = d.lb[levelId] || [];
    board.push({ name: d.name || 'GUEST', score: Math.round(score), time, date: Date.now() });
    board.sort((a, b) => b.score - a.score);
    d.lb[levelId] = board.slice(0, 10);
    this.write();
    return rec;
  },
};

/* ---------------------------------------------------------------------
   SCORING
   --------------------------------------------------------------------- */
const RANKS = [[0.55, 'D'], [0.7, 'C'], [0.85, 'B'], [1.0, 'A'], [1.2, 'S'], [99, 'S+']];
function computeScore(level, st) {
  const par = level.par || CFG.parBase;
  const parBonus = Math.max(0, Math.round((par - st.time) * 12));
  const timeBonus = st.time <= par ? 350 : Math.max(-200, Math.round((par - st.time) * 6));
  const shardBonus = st.shards * 150;
  const optionalBonus = st.optionalDone * 200;
  const damagePenalty = st.damage * 120;
  const rewindPenalty = st.rewinds * 100;
  const efficiency = Math.max(0, 250 - Math.max(0, st.interactions - 12) * 8);
  const base = 1000 + timeBonus + shardBonus + optionalBonus + efficiency - damagePenalty - rewindPenalty;
  const total = Math.max(150, Math.round(base));
  const shardTotal = (level.shards || []).length;
  const optTotal = (level.optional || []).length;
  const ideal = 1000 + 350 + shardTotal * 150 + optTotal * 200 + 250;
  const ratio = total / ideal;
  const rank = (RANKS.find(r => ratio <= r[0]) || RANKS[RANKS.length - 1])[1];
  return {
    total, rank, parBonus,
    rows: [
      ['Level cleared', 1000],
      ['Time ' + fmtTime(st.time) + (st.time <= par ? ' (under par)' : ' (over par)'), timeBonus],
      ['Shards ' + st.shards + '/' + shardTotal, shardBonus],
      ['Optional objectives ' + st.optionalDone + '/' + optTotal, optionalBonus],
      ['Efficiency', efficiency],
      ['Damage taken', -damagePenalty],
      ['Paradox rewinds', -rewindPenalty],
    ].filter(r => r[1] !== 0 || r[0].startsWith('Level')),
  };
}
