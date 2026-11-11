/* =====================================================================
   UI BREAKER : NEXUS OS — AI puzzle architect (generation + validation)

   The LLM may only propose a configuration. This module is the authority:
   it coerces the proposal into the game's level schema, enforces bounds,
   checks overlaps, proves a traversal path exists from spawn to exit, and
   rejects anything it cannot solve. Nothing unvalidated is published.
   ===================================================================== */

export const MECHANICS = ['pause', 'volume', 'gravity', 'brightness', 'recycle', 'windows', 'rewind'];
export const DIFFICULTIES = ['calm', 'standard', 'harsh', 'brutal'];

export const BOUNDS = { x: [-14, 14], y: [-2, 12], z: [-20, 16] };
const MAX_GAP = { calm: 2.2, standard: 3.2, harsh: 4.1, brutal: 4.8 };  // bridge a window must cover
const MAX_RISE = 1.3;                                                   // single jump apex at CFG.jump/gravity
const PLAYER_HALF = 0.42;

const clampNum = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const inBounds = (x, y, z) =>
  x >= BOUNDS.x[0] && x <= BOUNDS.x[1] && y >= BOUNDS.y[0] && y <= BOUNDS.y[1] && z >= BOUNDS.z[0] && z <= BOUNDS.z[1];

/* ---------- deterministic PRNG (shared by daily + generator) ---------- */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- coercion into the engine's level schema ---------- */
export function normalizePuzzle(raw, opts = {}) {
  const difficulty = DIFFICULTIES.includes(opts.difficulty) ? opts.difficulty : 'standard';
  const mechanics = Array.isArray(opts.mechanics) && opts.mechanics.length
    ? opts.mechanics.filter(m => MECHANICS.includes(m))
    : ['windows'];

  const boxes = v => Array.isArray(v) ? v.slice(0, 14).map(b => (Array.isArray(b) ? b : b && b.box || [])) : [];
  const pt3 = (v, dflt) => Array.isArray(v)
    ? [clampNum(v[0], BOUNDS.x[0], BOUNDS.x[1], dflt[0]), clampNum(v[1], BOUNDS.y[0], BOUNDS.y[1], dflt[1]), clampNum(v[2], BOUNDS.z[0], BOUNDS.z[1], dflt[2])]
    : dflt.slice();

  const platforms = boxes(raw.platforms).map(b => [
    clampNum(b[0], BOUNDS.x[0], BOUNDS.x[1], 0), clampNum(b[1], BOUNDS.y[0], BOUNDS.y[1], 0), clampNum(b[2], BOUNDS.z[0], BOUNDS.z[1], 0),
    clampNum(b[3], 1.5, 16, 6), clampNum(b[4], 0.4, 2.4, 0.7), clampNum(b[5], 1.5, 16, 6),
  ]);
  const walls = boxes(raw.walls).map(b => [
    clampNum(b[0], BOUNDS.x[0], BOUNDS.x[1], 0), clampNum(b[1], BOUNDS.y[0], BOUNDS.y[1], 2), clampNum(b[2], BOUNDS.z[0], BOUNDS.z[1], 0),
    clampNum(b[3], 1, 18, 8), clampNum(b[4], 1, 8, 4), clampNum(b[5], 0.4, 2, 0.6),
  ]);
  const windows = boxes(raw.windows).map(w => [
    clampNum(w[0], BOUNDS.x[0], BOUNDS.x[1], 0), clampNum(w[1], BOUNDS.y[0], BOUNDS.y[1], 1.1), clampNum(w[2], BOUNDS.z[0], BOUNDS.z[1], 0),
    clampNum(w[3], 1.6, 4.4, 3), clampNum(w[4], 0.9, 2.2, 1.4),
  ]);
  const shards = Array.isArray(raw.shards) ? raw.shards.slice(0, 6).map(s => pt3(s, [0, 1.4, 0])) : [];

  return {
    id: String(raw.id || opts.id || 'ai-1').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'ai-1',
    chapter: clampNum(raw.chapter, 1, 5, opts.chapter || 2),
    name: String(raw.name || 'GENERATED PARTITION').toUpperCase().slice(0, 28),
    par: clampNum(raw.par, 25, 240, 80),
    brief: String(raw.brief || 'GLITCH assembled this partition out of your own habits.').slice(0, 200),
    objective: String(raw.objective || 'Reach the exit portal.').slice(0, 160),
    spawn: pt3(raw.spawn, [0, 1.4, 11]),
    exit: pt3(raw.exit, [0, 1.4, -12]),
    gravity: ['down', 'up', 'left', 'right'].includes(raw.gravity) ? raw.gravity : 'down',
    platforms, windows,
    plates: Array.isArray(raw.plates) ? raw.plates.slice(0, 3).map((p, i) => [clampNum(p[0], -14, 14, 0), clampNum(p[1], -2, 12, 0), clampNum(p[2], -20, 16, 0), { id: 'p' + (i + 1) }]) : [],
    doors: Array.isArray(raw.doors) ? raw.doors.slice(0, 3).map((d, i) => [clampNum(d[0], -14, 14, 0), clampNum(d[1], -2, 12, 2), clampNum(d[2], -20, 16, 0), clampNum(d[3], 2, 6, 3.4), clampNum(d[4], 2, 6, 4.4), { id: 'd' + (i + 1), plate: 'p1' }]) : [],
    movers: Array.isArray(raw.movers) ? raw.movers.slice(0, 4).map(m => [
      clampNum(m[0], -14, 14, 0), clampNum(m[1], -2, 12, 0.5), clampNum(m[2], -20, 16, 0),
      clampNum(m[3], 1, 3, 2), clampNum(m[4], 1, 3, 1.6), clampNum(m[5], 1, 3, 1.6),
      { hazard: true, axis: ['x', 'y', 'z'].includes(m[6] && m[6].axis) ? m[6].axis : 'x', range: clampNum(m[6] && m[6].range, 0.8, 4.5, 2.4), speed: clampNum(m[6] && m[6].speed, 0.4, 2.4, 1.2) },
    ]) : [],
    walls,
    shards,
    hints: [`Mechanics in this partition: ${mechanics.join(', ')}`],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }],
    optional: [],
    mechanics,
    difficulty,
    aiGenerated: true,
  };
}

/* ---------- geometry helpers ---------- */
const top = b => b[1] + b[4] / 2;
const rect = b => ({ x0: b[0] - b[3] / 2, x1: b[0] + b[3] / 2, z0: b[2] - b[5] / 2, z1: b[2] + b[5] / 2 });

function overlaps(a, b, pad = 0) {
  const A = rect(a), B = rect(b);
  return A.x0 < B.x1 + pad && A.x1 > B.x0 - pad && A.z0 < B.z1 + pad && A.z1 > B.z0 - pad;
}

function standingOn(level, p) {
  return level.platforms.find(b => {
    const r = rect(b);
    return p[0] > r.x0 - PLAYER_HALF && p[0] < r.x1 + PLAYER_HALF && p[2] > r.z0 - PLAYER_HALF && p[2] < r.z1 + PLAYER_HALF
      && Math.abs(p[1] - top(b)) < 1.2;
  }) || null;
}

/* Prove a path exists: BFS across platform tops, plus movable windows as
   bridge nodes. An edge needs a jumpable rise and a gap no wider than the
   level's bridge budget. */
function reachable(level, maxGap) {
  const nodes = level.platforms.map(b => ({ x: b[0], y: top(b), z: b[2], w: b[3], d: b[5], kind: 'solid' }));
  for (const w of level.windows) nodes.push({ x: w[0], y: w[1] + w[4] / 2, z: w[2], w: w[3], d: 0.4, kind: 'window' });

  const start = standingOn(level, level.spawn);
  if (!start) return { ok: false, reason: 'spawn_not_on_solid' };
  const goal = standingOn(level, level.exit);
  if (!goal) return { ok: false, reason: 'exit_not_on_solid' };

  const idx = nodes.findIndex(n => n.kind === 'solid' && n.x === start[0] && n.z === start[2]);
  const goalIdx = nodes.findIndex(n => n.kind === 'solid' && n.x === goal[0] && n.z === goal[2]);
  if (idx < 0 || goalIdx < 0) return { ok: false, reason: 'node_mismatch' };

  const seen = new Set([idx]);
  const queue = [idx];
  while (queue.length) {
    const i = queue.shift();
    if (i === goalIdx) return { ok: true, path_length: seen.size };
    const a = nodes[i];
    for (let j = 0; j < nodes.length; j++) {
      if (seen.has(j)) continue;
      const b = nodes[j];
      const gap = Math.max(0, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
      const rise = b.y - a.y;
      const lateral = Math.abs(a.x - b.x) - Math.max(a.w, b.w) / 2;
      if (rise <= MAX_RISE && gap <= maxGap && lateral <= 1.6) { seen.add(j); queue.push(j); }
    }
  }
  return { ok: false, reason: 'no_path_to_exit' };
}

/* ---------- full validation ---------- */
export function validatePuzzle(raw, opts = {}) {
  const level = raw && raw.platforms ? raw : normalizePuzzle(raw || {}, opts);
  const errors = [];
  const maxGap = MAX_GAP[level.difficulty] || MAX_GAP.standard;

  if (!level.platforms.length) errors.push('no_platforms');
  if (!inBounds(...level.spawn)) errors.push('spawn_out_of_bounds');
  if (!inBounds(...level.exit)) errors.push('exit_out_of_bounds');
  if (level.windows.length > 8) errors.push('too_many_windows');
  if (level.platforms.length > 14) errors.push('too_many_platforms');

  /* critical objects may not intersect each other */
  const solidish = [...level.platforms, ...level.windows];
  let badOverlap = false;
  for (let i = 0; i < solidish.length && !badOverlap; i++) {
    for (let j = i + 1; j < solidish.length; j++) {
      if (overlaps(solidish[i], solidish[j], -0.05)) { badOverlap = true; break; }
    }
  }
  if (badOverlap) errors.push('critical_objects_overlap');

  if (!standingOn(level, level.spawn)) errors.push('spawn_not_on_solid');
  if (!standingOn(level, level.exit)) errors.push('exit_not_on_solid');

  /* a bridge mechanic must be present for gaps wider than a jump */
  const reach = reachable(level, maxGap);
  if (!reach.ok) {
    const bare = reachable(level, 1.4);
    if (bare.ok) errors.push('gap_unbridgeable_without_mechanics');
    else errors.push(reach.reason);
  }

  /* a plate-gated door needs a movable window to weigh it down */
  if (level.doors.length && !level.windows.length) errors.push('door_without_window');

  const difficultyScore =
    (level.platforms.length * 1.1) + (level.movers.length * 2.4) + (level.doors.length * 3) +
    (level.windows.length * 1.6) + (level.plates.length * 2) + (level.gravity !== 'down' ? 5 : 0) +
    Math.max(0, maxGap - 1.6) * 2;

  return {
    valid: errors.length === 0,
    errors,
    difficulty: level.difficulty,
    difficulty_score: +difficultyScore.toFixed(1),
    checks: {
      reachable: reach.ok,
      path_nodes: reach.path_length || 0,
      overlap_free: !badOverlap,
      spawn_on_solid: standingOn(level, level.spawn) ? true : false,
      exit_on_solid: standingOn(level, level.exit) ? true : false,
      objects: { platforms: level.platforms.length, windows: level.windows.length, movers: level.movers.length, plates: level.plates.length, doors: level.doors.length },
    },
  };
}

/* ---------- deterministic generator (works with or without an LLM) ---------- */
export function generatePuzzle({ seed = 'default', difficulty = 'standard', mechanics = ['windows'], chapter = 2 } = {}) {
  const r = rng(String(seed) + '|' + difficulty);
  const budget = MAX_GAP[difficulty] || MAX_GAP.standard;

  /* corridor along Z: spawn deck -> mid deck -> a void of exactly the
     difficulty's bridge budget -> exit deck */
  const startCenter = 12, startDepth = 6, midDepth = 4, exitDepth = 6;
  const startFront = startCenter - startDepth / 2;
  const midCenter = startFront - 0.6 - midDepth / 2;
  const midFront = midCenter - midDepth / 2;

  const gapBase = +(budget * (0.7 + r() * 0.22)).toFixed(2);
  const yMid = 0;
  const yExit = r() < 0.55 ? 1.2 : 0.35;
  const hazard = r() < 0.55;
  const plate = mechanics.includes('windows') && r() < 0.5;

  const build = gap => {
    const exitBack = midFront - gap;
    const exitCenter = +(exitBack - exitDepth / 2).toFixed(2);
    const winZ = +(midFront - gap / 2).toFixed(2);
    return {
      id: 'ai-' + String(seed).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12),
      chapter,
      name: difficulty.toUpperCase() + ' PARTITION',
      par: Math.round(52 + gap * 9 + (hazard ? 10 : 0) + (plate ? 8 : 0)),
      brief: 'GLITCH built this from your last run. The gap is not decoration.',
      objective: 'Cross the void and reach the exit portal.',
      spawn: [0, yMid + 1.05, startCenter],
      exit: [0, yExit + 1.05, exitCenter],
      gravity: 'down',
      platforms: [
        [0, yMid, startCenter, 10, 0.7, startDepth],
        [0, yMid, +midCenter.toFixed(2), 7, 0.7, midDepth],
        [0, yExit, exitCenter, 10, 0.7, exitDepth],
        [-8, yMid, 4, 4, 0.7, 4],
      ],
      windows: [[0, Math.max(yMid, yExit) + 0.75, winZ, Math.min(4.4, gap + 1.7), 1.4]],
      plates: plate ? [[0, yExit + 0.07, +(exitCenter + 1.4).toFixed(2), { id: 'p1' }]] : [],
      doors: plate ? [[0, yExit + 2.2, +(exitCenter - 2.2).toFixed(2), 3.4, 4.4, { id: 'd1', plate: 'p1' }]] : [],
      movers: hazard ? [[0, yMid + 0.5, +(midCenter + 0.9).toFixed(2), 2, 1.6, 1.6, { hazard: true, axis: 'x', range: 2.0 + r() * 0.6, speed: 1.1 + r() * 0.5 }]] : [],
      shards: [[-8, yMid + 1.4, 4], [0, yExit + 1.6, exitCenter], [2.6, yMid + 2.4, +midCenter.toFixed(2)]],
      mechanics,
      difficulty,
    };
  };

  let gap = gapBase;
  let level = normalizePuzzle(build(gap), { difficulty, mechanics, chapter });
  let report = validatePuzzle(level, { difficulty, mechanics, chapter });

  /* repair loop: pull the void in until traversal is provable */
  let attempts = 0;
  while (!report.valid && attempts < 8) {
    attempts++;
    gap = +(gap - 0.35).toFixed(2);
    if (gap < 1.4) break;
    level = normalizePuzzle(build(gap), { difficulty, mechanics, chapter });
    report = validatePuzzle(level, { difficulty, mechanics, chapter });
  }

  return { level, report, attempts: attempts + 1, seed: String(seed), gap };
}

/* ---------- turn an LLM proposal into a published challenge ---------- */
export function validateProposal(proposal, opts = {}) {
  const level = normalizePuzzle(proposal, opts);
  const report = validatePuzzle(level, opts);
  return { level, report };
}
