/* =====================================================================
   POST /api/puzzle — AI puzzle architect
   The model proposes, the engine decides. A proposal is published only
   after normalizePuzzle + validatePuzzle prove a traversal path exists.
   Anything else is replaced by a deterministic, validated generation.
   ===================================================================== */
import { verifySession, takeToken, readBody, sendJson, config } from '../lib/ai-core.js';
import { complete, playerError } from '../lib/provider.js';
import { generatePuzzle, validateProposal, DIFFICULTIES, MECHANICS } from '../lib/puzzle.js';

const SYSTEM = `You design levels for the puzzle game UI BREAKER: NEXUS OS.
The player is a small robot on platforms, +Y is up. Each level is a corridor along Z: spawn at high Z, exit at low Z.
You may only use these fields: id, chapter, name, par, brief, objective, spawn, exit, gravity, platforms, windows, plates, doors, movers, shards.
Coordinates: x in [-14,14], y in [-2,12], z in [-20,16].
platforms: [x, y, z, width, height, depth] with width/depth 1.5..16 and height 0.4..2.4. y is the box CENTER.
windows: [x, y, z, width, depth] with width 1.6..4.4, depth 0.9..2.2. A window is a movable solid pane the player can drag.
plates: [x, y, z, {"id":"p1"}]. doors: [x, y, z, width, height, {"id":"d1","plate":"p1"}].
movers: [x, y, z, width, height, depth, {"hazard":true,"axis":"x","range":2.4,"speed":1.2}].
gravity is "down" unless the level teaches gravity.
Rules: the spawn and the exit must sit on top of a platform; platforms and windows must not intersect each other; the player can jump 1.3 up and cross a gap of at most the difficulty budget using a window bridge; a door needs a plate and at least one movable window.
Return ONLY a JSON object: {"type":"puzzle","id":"...","chapter":2,"name":"...","par":80,"brief":"...","objective":"...","spawn":[0,1.4,11],"exit":[0,1.4,-12],"gravity":"down","platforms":[[...]],"windows":[[...]],"plates":[],"doors":[],"movers":[],"shards":[]}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  let body;
  try { body = await readBody(req, 4096); }
  catch (e) { return sendJson(res, e.code || 400, { error: 'invalid_request' }); }

  const session = verifySession(req.headers['x-nexus-session']);
  if (!session) return sendJson(res, 401, { error: 'invalid_session', notice: 'Reload to re-establish the link.' });

  const gate = takeToken(session.sessionId, 'puzzle');
  if (!gate.ok) {
    res.setHeader('Retry-After', String(gate.retryAfter || 10));
    const seed = String(body.seed || session.sessionId + Date.now());
    const gen = generatePuzzle({ seed, difficulty: 'standard', mechanics: ['windows'], chapter: 2 });
    return sendJson(res, 429, { source: 'engine', level: gen.level, validation: gen.report, notice: 'Puzzle architect throttled. Engine-generated partition served.', retryAfter: gate.retryAfter });
  }

  const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : 'standard';
  const mechanics = Array.isArray(body.mechanics) && body.mechanics.length ? body.mechanics.filter(m => MECHANICS.includes(m)).slice(0, 4) : ['windows'];
  const chapter = Math.min(5, Math.max(1, parseInt(body.chapter, 10) || 2));
  const seed = String(body.seed || session.sessionId).slice(0, 40);
  const opts = { difficulty, mechanics, chapter };

  const c = config();
  let notice = null;
  let source = 'engine';
  let model = null;

  if (c.enabled && c.baseUrl && c.apiKey) {
    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: JSON.stringify({ difficulty, mechanics, chapter, seed, hint: 'Return one puzzle JSON object.' }) },
    ];
    const ai = await complete({ messages, feature: 'puzzle', playerId: session.sessionId, maxTokens: 700, temperature: 0.7, preferStrong: true });
    if (ai.ok && ai.parsed) {
      const proposal = ai.parsed.type === 'puzzle' ? ai.parsed : ai.parsed;
      const { level, report } = validateProposal(proposal, opts);
      if (report.valid) {
        return sendJson(res, 200, {
          source: 'ai', model: ai.model, latency_ms: ai.latencyMs, level,
          validation: report, seed, difficulty,
          notice: 'AI proposal passed engine validation.',
        });
      }
      notice = 'AI proposal rejected by engine validator: ' + report.errors.slice(0, 3).join(', ');
      model = ai.model;
    } else {
      const err = playerError(ai.status);
      notice = err.message;
    }
  } else {
    notice = 'AI not configured. Deterministic partition architect in use.';
  }

  const gen = generatePuzzle({ seed, difficulty, mechanics, chapter });
  if (!gen.report.valid) {
    return sendJson(res, 502, { error: 'no_valid_puzzle', detail: gen.report.errors, notice: 'Refused to publish an unvalidated partition.' });
  }
  return sendJson(res, 200, {
    source, model, level: gen.level, validation: gen.report, seed, difficulty,
    notice, attempts: gen.attempts,
  });
}
