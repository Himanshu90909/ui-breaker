import { issueSession, sendJson, takeToken } from '../lib/ai-core.js';

/* Issues an HMAC-signed session id. No IP, email or device id is stored:
   the seed is random, so nothing personal ever reaches the server logs. */
export default function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const gate = takeToken('issue', 'session');
  if (!gate.ok) {
    res.setHeader('Retry-After', String(gate.retryAfter || 5));
    return sendJson(res, 429, { error: 'rate_limited' });
  }
  const session = issueSession();
  sendJson(res, 200, { sessionId: session.sessionId, token: session.token, expiresAt: session.expiresAt });
}
