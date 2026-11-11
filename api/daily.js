/* =====================================================================
   GET /api/daily — AI Daily Glitch
   One challenge per UTC date, identical for every player, produced by the
   deterministic seeded architect and served from the edge cache. The LLM
   never chooses the daily: determinism is the requirement.
   ===================================================================== */
import { sendJson, cacheGet, cacheSet } from '../lib/ai-core.js';
import { generatePuzzle, DIFFICULTIES } from '../lib/puzzle.js';

const HINT_SETS = {
  1: 'The exit sits lower than the middle deck. Bridging the void is the whole puzzle.',
  2: 'Grab the movable window, place it so it touches both platform edges, then walk the pane.',
  3: 'Drag the window into the gap, release it flush with both edges, press the plate with a second pane if a door blocks the exit, then walk the top surface to the portal.',
};

function utcDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export default function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const difficulty = DIFFICULTIES.includes(req.query && req.query.difficulty) ? req.query.difficulty : 'standard';
  const date = utcDate();
  const key = 'daily:' + date + ':' + difficulty;

  let payload = cacheGet(key);
  if (!payload) {
    const gen = generatePuzzle({ seed: 'NEXUS|' + date + '|' + difficulty, difficulty, mechanics: ['windows', difficulty === 'brutal' ? 'pause' : 'brightness'], chapter: 2 });
    if (!gen.report.valid) {
      return sendJson(res, 502, { error: 'daily_generation_failed', detail: gen.report.errors, notice: 'Refused to publish an unvalidated daily challenge.' });
    }
    payload = {
      date,
      seed: gen.seed,
      difficulty,
      identity: 'nexus-daily-' + date,
      level: gen.level,
      validation: gen.report,
      hints: HINT_SETS,
      scoring: { server_side: false, note: 'Scores are validated by the game engine on completion; the daily puzzle identity is identical for every player.' },
    };
    cacheSet(key, payload, 60 * 60 * 1000);
  }

  return sendJson(res, 200, payload, {
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  });
}
