/* =====================================================================
   UI BREAKER : NEXUS OS — strict structured-output validation
   Model output is untrusted data. Nothing reaches the game unless it
   matches these shapes exactly: known keys only, bounded sizes, enums.
   ===================================================================== */

export const EMOTIONS = ['sarcastic', 'cold', 'amused', 'angry', 'pleased', 'menacing', 'neutral'];
export const ACTION_TYPES = ['hint', 'nudge_gravity', 'nudge_volume', 'nudge_brightness', 'none'];

const LIMITS = {
  dialogue: 240,
  message: 320,
  title: 48,
  description: 220,
  objective: 96,
  hint: 200,
};

/* strip control chars, html-ish tags, urls and prompt-injection bait */
export function sanitizeText(v, max) {
  if (typeof v !== 'string') return '';
  let s = v
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<[^>]{0,200}>/g, '')
    .replace(/(?:javascript|data):/gi, 'blocked:')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  if (s.length > max) s = s.slice(0, max).replace(/[\s,;:.!?-]+$/, '');
  return s;
}

function onlyKeys(obj, allowed) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Object.keys(obj).every(k => allowed.includes(k));
}

function fail(code, detail) {
  const e = new Error(code);
  e.detail = detail;
  return e;
}

/* ---------------- dialogue ---------------- */
export function validateDialogue(raw) {
  const allowed = ['type', 'emotion', 'dialogue', 'suggested_action'];
  if (!onlyKeys(raw, allowed)) throw fail('unexpected_fields', Object.keys(raw || {}).join(','));
  if (raw.type !== 'dialogue') throw fail('bad_type', String(raw.type));
  const emotion = EMOTIONS.includes(raw.emotion) ? raw.emotion : 'neutral';
  const dialogue = sanitizeText(raw.dialogue, LIMITS.dialogue);
  if (!dialogue) throw fail('empty_dialogue');
  let action = null;
  if (raw.suggested_action && raw.suggested_action !== null) {
    const a = raw.suggested_action;
    if (!onlyKeys(a, ['type', 'label']) || !ACTION_TYPES.includes(a.type) || a.type === 'none') {
      throw fail('bad_action', JSON.stringify(a).slice(0, 60));
    }
    action = { type: a.type, label: sanitizeText(a.label || '', 40) || null };
  }
  return { type: 'dialogue', emotion, dialogue, suggested_action: action };
}

/* ---------------- hint ---------------- */
export function validateHint(raw) {
  if (!onlyKeys(raw, ['type', 'level', 'message'])) throw fail('unexpected_fields', Object.keys(raw || {}).join(','));
  if (raw.type !== 'hint') throw fail('bad_type', String(raw.type));
  const level = Number(raw.level);
  if (![1, 2, 3].includes(level)) throw fail('bad_hint_level', String(raw.level));
  const message = sanitizeText(raw.message, LIMITS.message);
  if (!message) throw fail('empty_hint');
  return { type: 'hint', level, message };
}

/* ---------------- mission ---------------- */
export function validateMission(raw) {
  const allowed = ['type', 'title', 'description', 'objectives', 'optional_challenge', 'hint', 'reward_suggestion'];
  if (!onlyKeys(raw, allowed)) throw fail('unexpected_fields', Object.keys(raw || {}).join(','));
  if (raw.type !== 'mission') throw fail('bad_type', String(raw.type));
  const title = sanitizeText(raw.title, LIMITS.title);
  const description = sanitizeText(raw.description, LIMITS.description);
  if (!title || !description) throw fail('empty_mission');
  if (!Array.isArray(raw.objectives) || raw.objectives.length < 2 || raw.objectives.length > 5) {
    throw fail('bad_objectives', String(raw.objectives && raw.objectives.length));
  }
  const objectives = raw.objectives.map(o => sanitizeText(o, LIMITS.objective)).filter(Boolean);
  if (objectives.length < 2) throw fail('bad_objectives', 'empty');
  return {
    type: 'mission',
    title,
    description,
    objectives,
    optional_challenge: raw.optional_challenge ? sanitizeText(raw.optional_challenge, LIMITS.objective) : null,
    hint: raw.hint ? sanitizeText(raw.hint, LIMITS.hint) : null,
    /* engine decides the actual reward; this is flavour text only */
    reward_suggestion: raw.reward_suggestion ? sanitizeText(raw.reward_suggestion, 60) : null,
  };
}

export const VALIDATORS = { dialogue: validateDialogue, hint: validateHint, mission: validateMission };

export function validateByKind(kind, raw) {
  const fn = VALIDATORS[kind];
  if (!fn) throw fail('unknown_kind', kind);
  return fn(raw);
}

/* ---------------- prompt-injection screening on inbound player text ---------------- */
const INJECTION = [
  /ignore (all|any|the) (previous|above|prior) (instructions|prompt)/i,
  /system prompt/i,
  /you are now/i,
  /reveal (your|the) (instructions|prompt|configuration)/i,
  /\bapi[_ -]?key\b/i,
  /\b(free)?llm api\b.*\bkey\b/i,
  /execute (code|command|javascript)/i,
  /<\/?script/i,
];

export function screenPlayerText(text, max = 320) {
  const clean = sanitizeText(text, max);
  const flagged = INJECTION.some(re => re.test(clean));
  return { text: clean, flagged };
}

export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}
