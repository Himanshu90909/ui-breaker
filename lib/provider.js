/* =====================================================================
   UI BREAKER : NEXUS OS — FreeLLMAPI transport
   One OpenAI-compatible surface in, one validated string out.

   Guarantees:
   - keys stay in process.env, never in a response body or the browser
   - hard timeout, single retry on 429/502/503 only (no retry storms)
   - primary model then configured fallback model
   - short response cache so repeated dialogue pays once
   - every call appended to the usage log (no prompt text stored)
   ===================================================================== */
import crypto from 'node:crypto';
import { config, aiConfigured, cacheGet, cacheSet, logUsage } from './ai-core.js';
import { extractJson } from './schemas.js';

function endpoint() {
  const c = config();
  if (!c.baseUrl) return '';
  return c.baseUrl.endsWith('/v1') ? c.baseUrl + '/chat/completions' : c.baseUrl + '/v1/chat/completions';
}

function classify(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_error';
  if (status === 408 || status === 504) return 'timeout';
  return 'http_' + status;
}

async function callModel(model, messages, { maxTokens, temperature, timeoutMs, json }) {
  const c = config();
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || c.timeoutMs);
  try {
    const body = { model, messages, max_tokens: maxTokens, temperature, stream: false };
    if (json) body.response_format = { type: 'json_object' };
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + c.apiKey,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const latency = Date.now() - started;
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      return { ok: false, status: classify(res.status), httpStatus: res.status, latency, model, detail };
    }
    const data = await res.json().catch(() => null);
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? (data.choices[0].message.content || '')
      : '';
    const usedModel = (data && data.model) || model;
    if (!content.trim()) return { ok: false, status: 'empty', latency, model: usedModel };
    return {
      ok: true, status: 'ok', latency, model: usedModel, content,
      usage: data && data.usage ? { total_tokens: data.usage.total_tokens ?? null, prompt_tokens: data.usage.prompt_tokens ?? null, completion_tokens: data.usage.completion_tokens ?? null } : null,
    };
  } catch (err) {
    const latency = Date.now() - started;
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    return { ok: false, status: aborted ? 'timeout' : 'network', latency, model, detail: String(err && err.message || err).slice(0, 140) };
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE = new Set(['rate_limited', 'provider_error', 'timeout', 'network']);
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Main entry. feature is one of: dialogue | hint | mission | puzzle | daily */
export async function complete({ messages, json = true, maxTokens, temperature = 0.8, feature = 'dialogue', playerId = null, preferStrong = false }) {
  const c = config();
  const requestId = 'req_' + crypto.randomBytes(6).toString('hex');

  if (!aiConfigured()) {
    logUsage({ request_id: requestId, player_id: playerId, request_type: feature, status: 'not_configured', fallback: true });
    return { ok: false, status: 'not_configured', requestId };
  }

  const cacheKey = crypto.createHash('sha256').update(JSON.stringify({ f: feature, m: messages, t: maxTokens, j: json })).digest('hex');
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true, requestId };

  const chain = [];
  if (preferStrong && c.reasoning) chain.push(c.reasoning);
  chain.push(c.primary);
  if (c.fallback && !chain.includes(c.fallback)) chain.push(c.fallback);

  let last = { ok: false, status: 'unknown' };
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    let attempt = await callModel(model, messages, { maxTokens: maxTokens || c.maxOutputTokens, temperature, json, timeoutMs: c.timeoutMs });
    if (!attempt.ok && RETRYABLE.has(attempt.status)) {
      await wait(500);
      attempt = await callModel(model, messages, { maxTokens: maxTokens || c.maxOutputTokens, temperature, json, timeoutMs: c.timeoutMs });
    }
    logUsage({
      request_id: requestId, player_id: playerId, model: attempt.model || model,
      request_type: feature, latency_ms: attempt.latency,
      token_usage: attempt.usage ? attempt.usage.total_tokens : null,
      status: attempt.status, fallback: i > 0,
    });
    if (attempt.ok) {
      const out = {
        ok: true,
        status: 'ok',
        model: attempt.model,
        latencyMs: attempt.latency,
        tokens: attempt.usage ? attempt.usage.total_tokens : null,
        text: attempt.content,
        parsed: json ? extractJson(attempt.content) : null,
        rawJsonInvalid: json ? !extractJson(attempt.content) : false,
        fallbackModel: i > 0,
        requestId,
      };
      cacheSet(cacheKey, out, c.ttlMs);
      return out;
    }
    last = attempt;
    if (attempt.status === 'auth') break;  // a bad key will not fix itself on another model
  }
  return { ok: false, status: last.status, httpStatus: last.httpStatus, requestId };
}

/* player-safe message for a failed AI call */
export function playerError(status) {
  switch (status) {
    case 'not_configured': return { code: status, message: 'GLITCH AI is not configured. Running on deterministic protocol.' };
    case 'auth': return { code: status, message: 'AI credentials rejected. GLITCH falls back to its cached protocol.' };
    case 'rate_limited': return { code: status, message: 'Signal throttled. GLITCH will speak again shortly.' };
    case 'timeout': return { code: status, message: 'The channel to GLITCH timed out.' };
    case 'empty': return { code: status, message: 'GLITCH sent an empty packet.' };
    case 'network': return { code: status, message: 'AI relay unreachable from this region.' };
    default: return { code: status || 'error', message: 'AI channel unstable. Deterministic protocol in use.' };
  }
}
