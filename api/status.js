import { config, setupState, usageSnapshot, sendJson, aiConfigured } from '../lib/ai-core.js';

/* Public, secret-free status. The game shows an explicit setup state when
   this reports ready:false, and keeps deterministic gameplay. */
export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const state = setupState();
  const c = config();

  let reachable = null;
  if (state.ready && req.query && req.query.probe === '1') {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    try {
      const r = await fetch((c.baseUrl.endsWith('/v1') ? c.baseUrl : c.baseUrl + '/v1') + '/models', {
        headers: { Authorization: 'Bearer ' + c.apiKey }, signal: ctrl.signal,
      });
      reachable = r.ok;
    } catch { reachable = false; }
    finally { clearTimeout(t); }
  }

  return sendJson(res, 200, {
    enabled: c.enabled,
    configured: aiConfigured(),
    ready: state.ready,
    reason: state.reason,
    detail: state.detail,
    provider: 'freellmapi',
    base_url_host: c.baseUrl ? (() => { try { return new URL(c.baseUrl).host; } catch { return 'invalid'; } })() : null,
    models: { primary: c.primary, reasoning: c.reasoning || null, fallback: c.fallback },
    provider_reachable: reachable,
    features: {
      dialogue: true, hints: true, missions: true, puzzle_architect: true,
      daily_challenge: true, deterministic_fallback: true,
    },
    usage: usageSnapshot(),
    checked_at: new Date().toISOString(),
  });
}
