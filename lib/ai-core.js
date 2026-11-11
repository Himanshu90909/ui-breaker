/* =====================================================================
   UI BREAKER : NEXUS OS — AI core (server side only)
   Config, session signing, rate limiting, cache, usage log.
   No secrets ever leave this module.
   ===================================================================== */
import crypto from 'node:crypto';

export function config() {
  const base = (process.env.FREELLMAPI_BASE_URL || '').trim().replace(/\/+$/, '');
  return {
    baseUrl: base,
    apiKey: (process.env.FREELLMAPI_API_KEY || '').trim(),
    primary: (process.env.GLITCH_PRIMARY_MODEL || 'auto').trim(),
    reasoning: (process.env.GLITCH_REASONING_MODEL || '').trim(),
    fallback: (process.env.GLITCH_FALLBACK_MODEL || 'auto').trim(),
    enabled: (process.env.GLITCH_AI_ENABLED || '1') !== '0',
    sessionSecret: process.env.GLITCH_SESSION_SECRET || 'nexus-dev-secret-' + (process.env.VERCEL_GIT_COMMIT_SHA || 'local'),
    timeoutMs: Math.min(20000, Math.max(2000, parseInt(process.env.GLITCH_TIMEOUT_MS || '9000', 10))),
    maxOutputTokens: Math.min(900, Math.max(80, parseInt(process.env.GLITCH_MAX_OUTPUT_TOKENS || '420', 10))),
    ttlMs: 60000,
  };
}

export function aiConfigured() {
  const c = config();
  return !!(c.enabled && c.baseUrl && c.apiKey);
}

/* ---- why not ready, in player-safe words ---- */
export function setupState() {
  const c = config();
  if (!c.enabled) return { ready: false, reason: 'disabled', detail: 'GLITCH_AI_ENABLED is off' };
  if (!c.baseUrl) return { ready: false, reason: 'no_base_url', detail: 'FREELLMAPI_BASE_URL is not set' };
  if (!c.apiKey) return { ready: false, reason: 'no_key', detail: 'FREELLMAPI_API_KEY is not set' };
  return { ready: true, reason: 'ok', detail: 'FreeLLMAPI reachable path configured' };
}

/* ---------------- session tokens (HMAC, no PII) ---------------- */
const b64 = buf => Buffer.from(buf).toString('base64url');

export function issueSession(seed) {
  const c = config();
  const id = 'p_' + crypto.createHash('sha256').update(String(seed || crypto.randomUUID()) + Date.now()).digest('hex').slice(0, 16);
  const exp = Date.now() + 6 * 60 * 60 * 1000;
  const body = `${id}.${exp}`;
  const sig = crypto.createHmac('sha256', c.sessionSecret).update(body).digest('base64url');
  return { sessionId: id, token: b64(body) + '.' + sig, expiresAt: exp };
}

export function verifySession(token) {
  try {
    const c = config();
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return null;
    const body = Buffer.from(payload, 'base64url').toString();
    const want = crypto.createHmac('sha256', c.sessionSecret).update(body).digest('base64url');
    if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
    const [id, exp] = body.split('.');
    if (!id || Number(exp) < Date.now()) return null;
    return { sessionId: id, expiresAt: Number(exp) };
  } catch { return null; }
}

/* ---------------- rate limits (per session + feature) ---------------- */
const buckets = new Map();
const LIMITS = {
  dialogue: { rpm: 12, burst: 4 },
  hint: { rpm: 20, burst: 6 },
  mission: { rpm: 8, burst: 3 },
  puzzle: { rpm: 6, burst: 2 },
  daily: { rpm: 60, burst: 20 },
  session: { rpm: 30, burst: 10 },
};

export function takeToken(key, feature) {
  const lim = LIMITS[feature] || LIMITS.dialogue;
  const now = Date.now();
  const k = feature + ':' + key;
  let b = buckets.get(k);
  if (!b) { b = { tokens: lim.burst, last: now }; buckets.set(k, b); }
  const refill = ((now - b.last) / 60000) * lim.rpm;
  b.tokens = Math.min(lim.burst, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) return { ok: false, retryAfter: Math.ceil(((1 - b.tokens) / lim.rpm) * 60) };
  b.tokens -= 1;
  return { ok: true, remaining: Math.floor(b.tokens) };
}

/* ---------------- tiny TTL cache (per lambda instance) ---------------- */
const cacheStore = new Map();
export function cacheGet(key) {
  const e = cacheStore.get(key);
  if (!e) return null;
  if (e.exp < Date.now()) { cacheStore.delete(key); return null; }
  return e.value;
}
export function cacheSet(key, value, ttlMs) {
  if (cacheStore.size > 400) cacheStore.delete(cacheStore.keys().next().value);
  cacheStore.set(key, { value, exp: Date.now() + (ttlMs || 60000) });
}

/* ---------------- usage log (no secrets, no prompt text) ---------------- */
const usageLog = [];
export function logUsage(entry) {
  usageLog.push({
    request_id: entry.request_id,
    player_id: entry.player_id || null,
    model: entry.model || null,
    request_type: entry.request_type,
    latency_ms: entry.latency_ms ?? null,
    token_usage: entry.token_usage ?? null,
    status: entry.status,
    fallback: !!entry.fallback,
    at: new Date().toISOString(),
  });
  if (usageLog.length > 80) usageLog.shift();
}

export function usageSnapshot() {
  const last = usageLog.slice(-20);
  const ok = usageLog.filter(u => u.status === 'ok').length;
  return {
    requests: usageLog.length,
    ok,
    failed: usageLog.length - ok,
    fallback_used: usageLog.filter(u => u.fallback).length,
    avg_latency_ms: last.length ? Math.round(last.reduce((s, u) => s + (u.latency_ms || 0), 0) / last.length) : null,
    models: [...new Set(usageLog.map(u => u.model).filter(Boolean))].slice(-5),
    recent: last.slice(-6),
  };
}

/* ---------------- http helpers ---------------- */
export function sendJson(res, code, body, extraHeaders) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function readBody(req, limitBytes = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limitBytes) { reject(Object.assign(new Error('payload_too_large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error('invalid_json'), { code: 400 })); }
    });
    req.on('error', reject);
  });
}

export const FEATURES = Object.keys(LIMITS);
