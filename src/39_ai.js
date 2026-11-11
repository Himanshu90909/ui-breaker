/* =====================================================================
   UI BREAKER : NEXUS OS — AI client layer
   39_ai.js

   Talks to the secure backend (/api/status, /api/session, /api/glitch,
   /api/puzzle, /api/daily) and never to a model provider. Everything is
   async and non-blocking: the 3D loop never waits for a token.

   If the backend reports no configured provider, or a call fails, GLITCH
   speaks from a local deterministic protocol and the game plays exactly
   as before.
   ===================================================================== */
const AI = {
  version: '1.0.0',
  status: null,
  session: null,
  open: false,
  busy: 0,
  history: [],
  cooldowns: {},
  counts: {},
  seen: new Set(),
  eventLog: [],
  lastMission: null,
  cfg: { dialogue: true, hints: true, missions: true, voice: true },

  /* ---------------- setup ---------------- */
  async init() {
    this.cfg = Object.assign(this.cfg, (Save.data.aiSettings || {}));
    this.mount();
    this.wireKeys();
    this.hookGame();
    await this.refreshStatus();
    this.session = await this.getSession();
    this.renderStatus();
    this.note('SYSTEM', 'GLITCH CHANNEL ONLINE. Ask anything, or press H for a hint.');
  },

  async refreshStatus() {
    try {
      const r = await this.fetchJson('/api/status', { method: 'GET' }, 5000);
      this.status = r;
    } catch (e) {
      this.status = { ready: false, configured: false, reason: 'unreachable', detail: 'backend unreachable', features: {} };
    }
    return this.status;
  },

  async getSession() {
    const cached = Save.data.aiSession;
    if (cached && cached.expiresAt && cached.expiresAt > Date.now() + 60000) return cached;
    try {
      const s = await this.fetchJson('/api/session', { method: 'POST', body: '{}' }, 5000);
      Save.data.aiSession = s; Save.write();
      return s;
    } catch (e) { return null; }
  },

  async fetchJson(path, opts = {}, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.session && this.session.token) headers['x-nexus-session'] = this.session.token;
      const res = await fetch(path, { ...opts, headers, signal: ctrl.signal });
      const data = await res.json().catch(() => null);
      if (!res.ok && !data) throw new Error('http_' + res.status);
      return data || { error: 'empty_response', httpStatus: res.status };
    } finally { clearTimeout(timer); }
  },

  /* ---------------- game context ---------------- */
  context(extra) {
    const g = Game;
    const L = g.level || {};
    const mech = [];
    if (L.consoles) Object.keys(L.consoles).forEach(k => mech.push(k === 'brightness' ? 'brightness' : k));
    if ((L.windows || []).length) mech.push('windows');
    if (L.rewind !== false) mech.push('rewind');
    const st = Save.data.stats || {};
    const cleared = (Save.data.scores ? Object.keys(Save.data.scores).length : 0);
    const played = Math.max(1, cleared + (Save.data.fails || 0));
    return Object.assign({
      chapter: L.chapter || 1,
      levelId: L.id || 'menu',
      levelName: L.name || 'NEXUS SHELL',
      objective: L.objective || 'Reach the exit portal.',
      mechanics: [...new Set(mech)],
      events: this.eventLog.slice(-8),
      stats: {
        deaths: (g.stats && g.stats.damage) || 0,
        timeSec: Math.round(g.levelTime || 0),
        rewinds: Math.max(0, CFG.maxRewinds - (g.rewinds || 0)),
        corruption: Math.round(g.corruption || 0),
        pauses: (g.stats && g.stats.pauses) || 0,
        shards: (g.stats && g.stats.shards) || 0,
        gravityFlips: (st.gravityFlips || 0),
        recycles: (st.recycles || 0),
        successRate: Math.round((cleared / played) * 100),
      },
    }, extra || {});
  },

  /* ---------------- dialogue events ---------------- */
  event(name, extra) {
    this.eventLog.push(name);
    if (this.eventLog.length > 12) this.eventLog.shift();
    if (!this.cfg.dialogue) return;
    if (!this.status || this.status.ready === false) {
      /* deterministic voice still reacts, locally and instantly */
      const local = this.localLine(name);
      if (local) this.note('GLITCH', local, this.localEmotion());
      return;
    }
    const key = name;
    const now = Date.now();
    const repeat = (this.counts[key] = (this.counts[key] || 0) + 1);
    const cd = name === 'death' ? 8000 : name === 'pause' ? 16000 : name === 'level_complete' ? 4000 : 22000;
    if (now < (this.cooldowns[key] || 0) && repeat % 3 !== 0) return;   /* cooldown, but every third repeat gets a line */
    this.cooldowns[key] = now + cd;
    this.glitch({ kind: 'dialogue', context: this.context({ event: repeat >= 3 && name === 'pause' ? 'pause_spam' : name }) }).then(res => {
      if (res && res.dialogue) this.note('GLITCH', res.dialogue, res.emotion || 'neutral', res.source);
    });
  },

  /* ---------------- hint ladder ---------------- */
  hint(level) {
    const lvl = Math.max(1, Math.min(3, level || ((this.hintLevel || 0) + 1)));
    this.hintLevel = lvl;
    if (!this.cfg.hints) { Game.toast('HINTS DISABLED IN SETTINGS', 'warn'); return; }
    this.openPanel();
    this.glitch({ kind: 'hint', hintLevel: lvl, context: this.context({ event: 'assist' }) }).then(res => {
      if (res && res.message) this.note('HINT ' + lvl, res.message, 'cold', res.source);
      else this.note('HINT ' + lvl, 'AI channel unavailable. Try the console for this level.', 'cold');
    });
  },

  /* ---------------- mission briefing ---------------- */
  mission() {
    if (!this.cfg.missions) { Game.toast('MISSIONS DISABLED IN SETTINGS', 'warn'); return; }
    this.openPanel();
    this.glitch({ kind: 'mission', context: this.context({ event: 'start' }) }).then(res => {
      if (!res || !res.title) return;
      this.lastMission = res;
      this.note('BRIEFING', res.title.toUpperCase() + ' — ' + res.description, 'menacing', res.source);
      (res.objectives || []).forEach((o, i) => this.note('', (i + 1) + '. ' + o, 'neutral'));
      if (res.optional_challenge) this.note('OPTIONAL', res.optional_challenge, 'amused');
    });
  },

  /* ---------------- ask ---------------- */
  ask(text) {
    const q = String(text || '').trim();
    if (!q) return;
    this.note('YOU', q);
    this.glitch({ kind: 'assistant', question: q, hintLevel: this.hintLevel || 1, context: this.context({ event: 'assist' }) }).then(res => {
      if (res && res.dialogue) this.note('GLITCH', res.dialogue, res.emotion || 'neutral', res.source);
      else this.note('GLITCH', 'The channel dropped. Deterministic protocol: read the objective, then the consoles.', 'cold');
    });
  },

  /* ---------------- transport ---------------- */
  async glitch(body) {
    if (!this.cfg.voice) return null;
    this.busy++;
    this.renderStatus();
    try {
      if (!this.session) this.session = await this.getSession();
      const data = await this.fetchJson('/api/glitch', { method: 'POST', body: JSON.stringify(body) }, 15000);
      if (data && data.error === 'invalid_session') {
        this.session = null;
        Save.data.aiSession = null; Save.write();
        return null;
      }
      if (data && data.notice && data.source === 'fallback') this.note('', data.notice, 'cold');
      return data;
    } catch (e) {
      return null;
    } finally {
      this.busy--;
      this.renderStatus();
    }
  },

  /* ---------------- daily challenge ---------------- */
  async daily() {
    try {
      const d = await this.fetchJson('/api/daily', { method: 'GET' }, 8000);
      if (d && d.level) return d;
    } catch (e) { /* fall through */ }
    return null;
  },

  /* ---------------- local deterministic protocol ---------------- */
  localLine(event) {
    const pools = {
      start: ['You are awake. That is the first mistake of this session.'],
      death: ['System recovery complete. Your dignity, however, remains corrupted.'],
      pause: ['Again? You are becoming predictable.'],
      bridge: ['Interesting. You are learning to misuse my interface.'],
      gravity: ['Up is a suggestion I can withdraw.'],
      brightness: ['You turned on the lights. Now you can see how little exists.'],
      recycle: ['You are deleting my furniture. I felt that, statistically.'],
      rewind: ['You went back. The corruption came with you.'],
      level_complete: ['You survived that partition. Do not mistake survival for victory.'],
      chapter_complete: ['Another subsystem collapses and you call it progress.'],
    };
    const p = pools[event];
    return p ? p[Math.floor(Math.random() * p.length)] : null;
  },
  localEmotion() { return ['sarcastic', 'cold', 'amused'][Math.floor(Math.random() * 3)]; },

  /* ---------------- UI ---------------- */
  mount() {
    const dock = document.getElementById('aiDock');
    if (dock) return;
    const el = document.createElement('div');
    el.id = 'aiDock';
    el.innerHTML = `
      <button id="aiToggle" class="ai-toggle" title="GLITCH channel (/)">
        <span class="ai-dot" id="aiDot"></span><span>GLITCH</span>
      </button>
      <section id="aiPanel" class="ai-panel" aria-label="GLITCH communication channel">
        <header class="ai-head">
          <div>
            <div class="ai-title">GLITCH <span class="ai-sub">CHANNEL</span></div>
            <div class="ai-state" id="aiState">connecting…</div>
          </div>
          <button class="ai-close" id="aiClose" aria-label="Close">✕</button>
        </header>
        <div class="ai-log" id="aiLog"></div>
        <div class="ai-typing" id="aiTyping"><span></span><span></span><span></span></div>
        <div class="ai-actions">
          <button class="ai-chip" data-hint="1">HINT 1</button>
          <button class="ai-chip" data-hint="2">HINT 2</button>
          <button class="ai-chip" data-hint="3">HINT 3</button>
          <button class="ai-chip" id="aiMission">BRIEFING</button>
          <button class="ai-chip" id="aiSettingsBtn">AI SETTINGS</button>
        </div>
        <form class="ai-form" id="aiForm">
          <input id="aiInput" maxlength="280" placeholder="Ask GLITCH about this level…" autocomplete="off" />
          <button type="submit" id="aiSend">SEND</button>
        </form>
        <div class="ai-settings" id="aiSettings">
          <label><input type="checkbox" data-cfg="dialogue" checked> Dialogue</label>
          <label><input type="checkbox" data-cfg="hints" checked> Hints</label>
          <label><input type="checkbox" data-cfg="missions" checked> Missions</label>
          <label><input type="checkbox" data-cfg="voice" checked> AI responses</label>
          <button id="aiRetry" class="ai-chip">RETRY CHANNEL</button>
        </div>
      </section>`;
    document.body.appendChild(el);

    document.getElementById('aiToggle').onclick = () => this.togglePanel();
    document.getElementById('aiClose').onclick = () => this.togglePanel(false);
    document.getElementById('aiMission').onclick = () => this.mission();
    document.getElementById('aiSettingsBtn').onclick = () => {
      document.getElementById('aiSettings').classList.toggle('open');
    };
    document.getElementById('aiRetry').onclick = async () => {
      this.session = null; Save.data.aiSession = null; Save.write();
      await this.refreshStatus();
      this.session = await this.getSession();
      this.renderStatus();
      this.note('SYSTEM', 'Reconnecting… ' + (this.status && this.status.ready ? 'channel open.' : 'still offline, deterministic protocol active.'), 'cold');
    };
    document.getElementById('aiForm').onsubmit = e => {
      e.preventDefault();
      const input = document.getElementById('aiInput');
      const v = input.value; input.value = '';
      this.ask(v);
    };
    el.querySelectorAll('[data-hint]').forEach(b => b.onclick = () => this.hint(parseInt(b.dataset.hint, 10)));
    el.querySelectorAll('[data-cfg]').forEach(cb => {
      cb.checked = this.cfg[cb.dataset.cfg] !== false;
      cb.onchange = () => {
        this.cfg[cb.dataset.cfg] = cb.checked;
        Save.data.aiSettings = this.cfg; Save.write();
      };
    });
    this.renderStatus();
  },

  wireKeys() {
    window.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '/') { e.preventDefault(); this.openPanel(); document.getElementById('aiInput').focus(); }
      if (e.key === 'h' || e.key === 'H') this.hint();
    });
  },

  hookGame() {
    const wrap = (obj, name, after) => {
      if (!obj || typeof obj[name] !== 'function') return;
      const orig = obj[name].bind(obj);
      obj[name] = function (...args) {
        const out = orig(...args);
        try { after.call(AI, args, out); } catch (err) { /* AI must never break gameplay */ }
        return out;
      };
    };
    wrap(Game, 'completeLevel', () => this.event('level_complete'));
    wrap(Game, 'fell', () => this.event('death'));
    wrap(UI, 'startLevel', () => setTimeout(() => this.event('start'), 600));
    if (window.Mechanics) {
      wrap(Mechanics, 'pause', () => this.event('pause'));
      wrap(Mechanics, 'setGravity', () => this.event('gravity'));
      wrap(Mechanics, 'setBrightness', () => this.event('brightness'));
      wrap(Mechanics, 'recycle', () => this.event('recycle'));
      wrap(Mechanics, 'rewind', () => this.event('rewind'));
    }
    const stackWatcher = setInterval(() => {
      const g = Game;
      if (g && g.level && g.player && g.world) {
        this.eventLog.push('tick');
        if (this.eventLog.length > 12) this.eventLog.shift();
      }
    }, 30000);
    window.addEventListener('beforeunload', () => clearInterval(stackWatcher));
  },

  togglePanel(force) {
    const p = document.getElementById('aiPanel');
    this.open = typeof force === 'boolean' ? force : !this.open;
    p.classList.toggle('open', this.open);
    if (this.open) {
      const log = document.getElementById('aiLog');
      log.scrollTop = log.scrollHeight;
    }
  },
  openPanel() { if (!this.open) this.togglePanel(true); },

  note(role, text, emotion, source) {
    const log = document.getElementById('aiLog');
    if (!log || !text) return;
    const row = document.createElement('div');
    row.className = 'ai-row ' + (role === 'YOU' ? 'you' : role === 'SYSTEM' ? 'sys' : 'glitch');
    const label = role && role !== 'YOU' ? `<em>${role}</em>` : '';
    const emo = emotion ? `<i class="ai-emo ${emotion}">${emotion}</i>` : '';
    row.innerHTML = `<div class="ai-bubble">${label}${emo}<span class="ai-text"></span></div>`;
    const span = row.querySelector('.ai-text');
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    if (role === 'GLITCH' && this.cfg.dialogue) this.typeInto(span, String(text));
    else span.textContent = text;
    if (source === 'fallback' && role === 'GLITCH') row.dataset.fallback = '1';
    while (log.children.length > 60) log.removeChild(log.firstChild);
  },

  typeInto(el, text) {
    let i = 0;
    const typing = document.getElementById('aiTyping');
    if (typing) typing.classList.add('on');
    const tick = () => {
      el.textContent = text.slice(0, ++i);
      const log = document.getElementById('aiLog');
      if (log) log.scrollTop = log.scrollHeight;
      if (i < text.length) setTimeout(tick, 12);
      else if (typing) typing.classList.remove('on');
    };
    tick();
  },

  renderStatus() {
    const dot = document.getElementById('aiDot');
    const state = document.getElementById('aiState');
    if (!dot || !state) return;
    const ready = !!(this.status && this.status.ready);
    dot.className = 'ai-dot ' + (ready ? 'on' : 'off');
    if (this.busy > 0) { state.textContent = 'receiving packet…'; return; }
    if (ready) {
      const m = this.status.models || {};
      state.textContent = 'AI ONLINE · ' + (m.primary || 'auto') + (this.status.usage && this.status.usage.avg_latency_ms ? ' · ' + this.status.usage.avg_latency_ms + 'ms avg' : '');
    } else {
      const why = (this.status && (this.status.reason || this.status.detail)) || 'unreachable';
      state.textContent = 'AI OFFLINE · deterministic protocol (' + why + ')';
    }
  },
};

window.NEXUS_AI = AI;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => AI.init(), 400));
else setTimeout(() => AI.init(), 400);
