/* =====================================================================
   UI — screens, HUD, menus
   ===================================================================== */
const UI = {
  current: 'boot',
  init() {
    this.screens = {};
    ['boot', 'menu', 'chapters', 'levels', 'timeattack', 'pause', 'objectives', 'complete',
      'profile', 'achievements', 'leaderboard', 'settings', 'editor', 'ending'].forEach(id => {
        this.screens[id] = document.getElementById(id);
      });
    this.bind();
    this.renderMenu();
    this.buildThemeButtons();
  },
  bind() {
    $$('[data-go]').forEach(b => on(b, 'click', () => { Sfx.ui(); this.go(b.dataset.go); }));
    $$('[data-pause]').forEach(b => on(b, 'click', () => { Sfx.ui(); this.pauseAction(b.dataset.pause); }));
    on(document.getElementById('objClose'), 'click', () => { Sfx.ui(); this.closeObjectives(); });
    on(document.getElementById('compNext'), 'click', () => { Sfx.ui(); this.nextLevel(); });
    on(document.getElementById('compRetry'), 'click', () => { Sfx.ui(); Game.loadLevel(Game.level, { mode: Game.mode }); });
    on(document.getElementById('compMenu'), 'click', () => { Sfx.ui(); Game.quitToMenu(); });
    on(document.getElementById('settingsBack'), 'click', () => { Sfx.ui(); this.backFromSettings(); });
    on(window, 'keydown', e => {
      if (e.key === 'Escape') {
        if (['objectives'].includes(this.current)) this.closeObjectives();
        else if (this.current === 'settings') this.backFromSettings();
      }
    });
    // settings controls
    const S = Save.data.settings;
    const bindRange = (id, key, after) => {
      const inp = document.getElementById(id);
      if (!inp) return;
      inp.value = key === 'sens' ? S.sens : Math.round(S[key] * 100);
      on(inp, 'input', () => {
        const st = Save.data.settings;
        st[key] = key === 'sens' ? parseInt(inp.value, 10) : parseFloat(inp.value) / 100;
        Save.write();
        if (after) after();
      });
    };
    bindRange('volMaster', 'master', () => Sfx.applyVolumes());
    bindRange('volMusic', 'music', () => Sfx.applyVolumes());
    bindRange('volSfx', 'sfx', () => Sfx.applyVolumes());
    bindRange('setSens', 'sens');
    const bindSw = (id, key, after) => {
      const sw = document.getElementById(id);
      if (!sw) return;
      sw.classList.toggle('on', !!Save.data.settings[key]);
      on(sw, 'click', () => {
        const st = Save.data.settings;
        st[key] = !st[key];
        sw.classList.toggle('on', st[key]);
        Save.write();
        Sfx.click(); if (after) after();
      });
    };
    bindSw('setShadows', 'shadows', () => Game.applySettings());
    bindSw('setParticles', 'particles', () => Game.applySettings());
    bindSw('setShake', 'shake');
    bindSw('setInvert', 'invert');
    bindSw('setTouch', 'touch', () => this.updateTouchMode());
    bindSw('setHints', 'hints');
    bindSw('setMotion', 'motion', () => Game.applySettings());
    bindSw('setContrast', 'contrast', () => this.applyContrast());
    bindSw('setBigHud', 'bighud', () => Game.applySettings());
    bindSw('setSubs', 'subs');
    on(document.getElementById('setQuality'), 'change', e => {
      S.quality = e.target.value; Save.write(); Game.applySettings();
    });
    document.getElementById('setQuality').value = S.quality;
    on(document.getElementById('dataWipe'), 'click', () => {
      if (!confirm('Erase all local progress, scores and achievements?')) return;
      Save.data = Save.defaults(); Save.write(); this.renderMenu(); this.renderProfile(); this.renderAchievements(); this.toastBlock('SAVE WIPED');
    });
    on(document.getElementById('dataExport'), 'click', () => {
      const blob = new Blob([JSON.stringify(Save.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'uibreaker-save.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
    on(document.getElementById('dataHints'), 'click', () => {
      Save.data.hintsSeen = false; Save.write(); this.toastBlock('HINTS RESET');
    });
    on(document.getElementById('profSaveName'), 'click', () => {
      const v = document.getElementById('profNameInput').value.trim().slice(0, 16);
      Save.data.name = v; Save.write(); this.renderMenu(); this.renderProfile(); Sfx.ui();
    });
    on(document.getElementById('profNameInput'), 'keydown', e => { if (e.key === 'Enter') document.getElementById('profSaveName').click(); });
    on(document.getElementById('lbReset'), 'click', () => {
      if (!confirm('Clear local leaderboard records?')) return;
      Save.data.lb = {}; Save.write(); this.renderLeaderboard(); this.toastBlock('RECORDS CLEARED');
    });
    on(document.getElementById('hudPause'), 'click', () => { this.togglePause(); });
    on(document.getElementById('footContinue'), 'click', () => this.continueRun());
    on(document.querySelector('[data-go="continue"]'), 'click', () => this.continueRun());
  },
  applyContrast() {
    document.body.classList.toggle('contrast', !!Save.data.settings.contrast);
    document.documentElement.style.setProperty('--dim', Save.data.settings.contrast ? '#c2d2e4' : '#8ea0b8');
    document.documentElement.style.setProperty('--dim2', Save.data.settings.contrast ? '#9fb2c6' : '#5d6c82');
  },
  updateTouchMode() {
    const on_ = Save.data.settings.touch || matchMedia('(hover:none)').matches;
    document.getElementById('touch').classList.toggle('on', on_ && Game.state === 'playing');
    Touch.enabled = on_;
  },
  toastBlock(msg) {
    Game.toast(msg, 'good');
  },
  show(name) {
    Object.values(this.screens).forEach(s => s && s.classList.remove('active'));
    if (this.screens[name]) this.screens[name].classList.add('active');
    this.current = name;
    if (name === 'menu') this.renderMenu();
    if (name === 'chapters') this.renderChapters();
    if (name === 'levels') this.renderLevels();
    if (name === 'timeattack') this.renderTimeAttack();
    if (name === 'profile') this.renderProfile();
    if (name === 'achievements') this.renderAchievements();
    if (name === 'leaderboard') this.renderLeaderboard();
    if (name === 'settings') { this.syncSettings(); this.applyContrast(); }
    if (name === 'editor') EditorUI.render();
  },
  go(target) {
    switch (target) {
      case 'menu': Game.quitToMenu(); this.show('menu'); break;
      case 'play': case 'chapters': this.show('chapters'); break;
      case 'levels': this.renderLevels(); this.show('levels'); break;
      case 'daily': this.startDaily(); break;
      case 'timeattack': this.show('timeattack'); break;
      case 'sandbox': this.startLevel(SANDBOX_LEVEL, 'sandbox'); break;
      case 'continue': this.continueRun(); break;
      case 'profile': case 'achievements': case 'leaderboard': case 'settings': case 'editor':
        this.show(target); break;
      case 'back': this.show('menu'); break;
      default: this.show('menu');
    }
  },
  continueRun() {
    const last = Save.data.lastLevel || '1-1';
    const lvl = levelById(last) || LEVELS[0];
    this.startLevel(lvl, 'story');
  },
  enterGame(level) {
    Object.values(this.screens).forEach(s => s && s.classList.remove('active'));
    this.current = 'game';
    this._objSig = null;
    document.getElementById('hud').classList.add('active');
    this.updateTouchMode();
    this.buildDock();
    this.renderObjectivesPanel();
  },
  startLevel(level, mode) {
    if (!level) return;
    this.show('none');
    Object.values(this.screens).forEach(s => s && s.classList.remove('active'));
    Game.loadLevel(level, { mode });
    document.getElementById('hud').classList.add('active');
    this.updateTouchMode();
    this.renderObjectivesPanel();
    this.buildDock();
  },
  startDaily() {
    const key = todayKey();
    const lvl = makeDailyLevel(key);
    this.startLevel(lvl, 'daily');
  },
  /* ------------------------------------------------ menu ----------- */
  renderMenu() {
    const S = Save.data;
    const lvl = Save.xpLevel();
    document.getElementById('sideName').textContent = S.name || 'GUEST';
    document.getElementById('sideRank').textContent = 'Level ' + lvl + ' · ' + (lvl > 8 ? 'Root' : lvl > 5 ? 'Operator' : lvl > 2 ? 'Runner' : 'Intruder');
    document.getElementById('sideXP').textContent = fmtNum(S.xp);
    document.getElementById('sideXPbar').style.width = ((S.xp % 1200) / 1200 * 100).toFixed(1) + '%';
    const cleared = Object.values(S.levels).filter(l => l.cleared).length;
    document.getElementById('sideCleared').textContent = cleared + ' / ' + LEVELS.length;
    document.getElementById('sideBest').textContent = fmtNum(S.stats.total || 0);
    const shards = Object.values(S.levels).reduce((a, l) => a + (l.shards || 0), 0);
    document.getElementById('sideShards').textContent = shards;
    document.getElementById('sideAch').textContent = Object.keys(S.ach).length + ' / ' + ACHIEVEMENTS.length;
    const lastLvl = levelById(S.lastLevel || '1-1');
    document.getElementById('navcontinue').textContent = lastLvl ? lastLvl.id + ' ' + lastLvl.name : '—';
    document.getElementById('dailyline').textContent = makeDailyLevel(todayKey()).name.replace('DAILY GLITCH · ', 'Today · ');
    document.getElementById('menustamp').textContent = 'SESSION · ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() + ' · ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    this.buildThemeButtons();
  },
  buildThemeButtons() {
    const host = document.getElementById('themeBtns');
    if (!host) return;
    host.innerHTML = '';
    THEMES.forEach(t => {
      const unlocked = Save.data.xp >= t.xp;
      const b = el('button', 'themesw' + (Save.data.theme === t.id ? ' on' : ''));
      b.style.background = unlocked ? t.color : 'rgba(255,255,255,.08)';
      b.style.opacity = unlocked ? '1' : '.35';
      b.title = t.name + (unlocked ? '' : ' · unlocks at ' + t.xp + ' XP');
      on(b, 'click', () => {
        if (!unlocked) { Game.toast('THEME LOCKED · ' + t.xp + ' XP', 'warn'); return; }
        Save.data.theme = t.id; Save.write(); Game.applyTheme(); this.buildThemeButtons(); this.renderProfile(); Sfx.ui();
      });
      host.appendChild(b);
    });
  },
  renderChapters() {
    const host = document.getElementById('chapterCards');
    host.innerHTML = '';
    CHAPTERS.forEach(ch => {
      const lvls = levelsInChapter(ch.id);
      const done = lvls.filter(l => Save.level(l.id)?.cleared).length;
      const unlocked = chapterUnlocked(ch.id);
      const c = el('button', 'card' + (unlocked ? '' : ' locked') + (done === lvls.length ? ' done' : ''));
      c.innerHTML = '<div class="cidx">0' + ch.id + '</div>' +
        '<div class="micro" style="color:' + ch.color + '">Chapter ' + ch.id + '</div>' +
        '<h4>' + ch.name + '</h4><p>' + ch.sub + '</p>' +
        '<div class="foot"><span class="tag">' + done + '/' + lvls.length + ' CLEARED</span>' +
        (unlocked ? '' : '<span class="tag hot">LOCKED</span>') + '</div>';
      on(c, 'click', () => {
        if (!unlocked) { Game.toast('CLEAR THE PREVIOUS CHAPTER FIRST', 'warn'); return; }
        this.openChapter(ch.id); Sfx.ui();
      });
      host.appendChild(c);
    });
  },
  openChapter(ch) {
    this.chapterFilter = ch;
    document.getElementById('levelsKicker').textContent = 'Chapter ' + ch + ' · ' + CHAPTERS[ch - 1].name;
    document.getElementById('levelsBack').dataset.go = 'chapters';
    this.renderLevels(ch);
    this.show('levels');
  },
  renderLevels(ch) {
    const host = document.getElementById('levelCards');
    host.innerHTML = '';
    const list = ch ? levelsInChapter(ch) : LEVELS;
    document.getElementById('levelsTitle').textContent = ch ? 'CHAPTER ' + ch : 'ALL LEVELS';
    list.forEach(l => {
      const rec = Save.level(l.id);
      const unlocked = ch ? levelUnlocked(l) : (rec?.cleared || l.id === '1-1');
      const optTotal = (l.optional || []).length + 1;
      const optDone = (rec?.cleared ? 1 : 0) + (rec?.shards && l.shards && rec.shards >= l.shards.length ? 1 : 0);
      const c = el('button', 'card' + (unlocked ? '' : ' locked') + (rec?.cleared ? ' done' : ''));
      c.innerHTML = '<div class="cidx">' + l.id + '</div>' +
        '<div class="micro" style="color:' + (CHAPTERS[l.chapter - 1].color) + '">' + l.id + ' · ' + CHAPTERS[l.chapter - 1].name + '</div>' +
        '<h4>' + l.name + '</h4><p>' + l.brief.slice(0, 108) + '…</p>' +
        '<div class="foot">' +
        '<span class="stars">' + Array.from({ length: optTotal }).map((_, i) => '<i class="' + (i < optDone ? 'on' : '') + '"></i>').join('') + '</span>' +
        (rec?.best ? '<span class="best">BEST ' + fmtNum(rec.best) + '</span>' : '') +
        (l.boss ? '<span class="tag hot">BOSS</span>' : '') +
        (unlocked ? '' : '<span class="tag">LOCKED</span>') +
        '</div>';
      on(c, 'click', () => {
        if (!unlocked) { Game.toast('CLEAR THE PREVIOUS LEVEL FIRST', 'warn'); return; }
        this.startLevel(l, 'story'); Sfx.ui();
      });
      host.appendChild(c);
    });
  },
  renderTimeAttack() {
    const host = document.getElementById('taCards');
    host.innerHTML = '';
    const cleared = LEVELS.filter(l => Save.level(l.id)?.cleared);
    if (!cleared.length) {
      host.innerHTML = '<div class="glass" style="padding:20px;color:var(--dim);font-size:12px">Clear at least one story level to unlock Time Attack.</div>';
      return;
    }
    cleared.forEach(l => {
      const rec = Save.level(l.id);
      const c = el('button', 'card');
      c.innerHTML = '<div class="cidx">' + l.id + '</div><h4>' + l.name + '</h4>' +
        '<p>Fastest clear: ' + (rec.time ? fmtTime(rec.time) : '—') + '</p>' +
        '<div class="foot"><span class="tag">TIME ATTACK</span><span class="best">PAR ' + fmtTime(l.par) + '</span></div>';
      on(c, 'click', () => { this.startLevel(l, 'timeattack'); Sfx.ui(); });
      host.appendChild(c);
    });
  },
  /* ------------------------------------------------ hud ------------ */
  buildDock() {
    const host = document.getElementById('dock');
    host.innerHTML = '';
    DOCK.forEach(d => {
      const b = el('button', 'ab');
      b.dataset.act = d.id;
      b.innerHTML = '<span class="k">' + d.key + '</span>' +
        '<span class="ic"><svg viewBox="0 0 24 24">' + d.icon + '</svg></span>' +
        '<span class="nm">' + d.nm + '</span><span class="st"></span>' +
        '<span class="cd" style="display:none"></span>';
      on(b, 'click', () => { Sfx.ui(); this.dockAction(d.id); });
      host.appendChild(b);
    });
  },
  dockAction(id) {
    const g = Game;
    if (g.state !== 'playing') return;
    const has = k => !!(g.world && g.world.consoles[k]);
    switch (id) {
      case 'pause': has('pause') ? Mechanics.pause(g) : g.toast('PAUSE CONSOLE NOT IN THIS LEVEL', 'warn'); break;
      case 'volume': has('volume') ? g.nudgeSlider('volume', 15) : g.toast('VOLUME CONSOLE NOT IN THIS LEVEL', 'warn'); break;
      case 'gravity': has('gravity') ? g.cycleGravity() : g.toast('GRAVITY PANEL NOT IN THIS LEVEL', 'warn'); break;
      case 'bright': has('brightness') ? g.nudgeSlider('brightness', 15) : g.toast('BRIGHTNESS CONSOLE NOT IN THIS LEVEL', 'warn'); break;
      case 'bin': g.held ? (Mechanics.recycle(g, g.held), g.held = null) : g.toast('GRAB AN OBJECT FIRST', 'warn'); break;
      case 'window': g.keyGrabWindow(); break;
      case 'undo': Mechanics.rewind(g); break;
      case 'dj': Mechanics.spend(g, 'doubleJump'); break;
      case 'slow': Mechanics.spend(g, 'slow'); break;
      case 'shield': Mechanics.spend(g, 'shield'); break;
    }
  },
  liveScore(g) {
    const par = g.level.par || 70;
    return Math.max(0, Math.round(1000 + Math.min(350, Math.max(-200, (par - g.levelTime) * 8)) + g.stats.shards * 150 - g.stats.damage * 120 - g.stats.rewinds * 100));
  },
  updateHUD(g) {
    if (!g.level) return;
    const q = id => document.getElementById(id);
    q('hudTime').textContent = fmtTime(g.levelTime);
    q('hudScore').textContent = fmtNum(this.liveScore(g));
    q('hudEnergy').textContent = g.energy;
    q('hudRewinds').textContent = g.rewinds;
    q('objtitle').textContent = g.level.objective || '';
    const par = g.level.par || 70;
    q('objsub').textContent = (g.level.timeattack ? '' : 'PAR ' + fmtTime(par) + ' · ') + 'SHARDS ' + g.stats.shards + '/' + (g.level.shards || []).length + (g.level.boss ? ' · BOSS' : '');
    // hp
    const hp = q('hpbar');
    if (hp.children.length !== g.player.maxHp) { hp.innerHTML = Array.from({ length: g.player.maxHp }).map(() => '<i></i>').join(''); }
    Array.from(hp.children).forEach((c, i) => {
      c.className = i < g.player.hp ? 'on' : '';
      if (g.player.hp <= 1 && i < g.player.hp) c.className = 'on hot';
    });
    const aw = g.director ? g.director.awareness() : 0;
    q('glitchaware').firstElementChild.style.width = Math.max(aw, g.corruption) + '%';
    q('corruption').textContent = 'GLITCH AWARENESS ' + Math.max(aw, Math.round(g.corruption)) + '%';
    // objective checklist
    const list = q('objprog');
    const items = (g.level.objectives || []).map(o => ({ text: o.text, on: this.objDone(g, o) }));
    const sig = items.map(i => (i.on ? 1 : 0) + i.text).join('|');
    if (this._objSig !== sig) {
      this._objSig = sig;
      list.innerHTML = items.map(i => '<div class="objit ' + (i.on ? 'on' : '') + '"><span class="bx"></span><span>' + i.text + '</span></div>').join('');
    }
    // dock state
    Array.from(document.querySelectorAll('#dock .ab')).forEach(b => {
      const act = b.dataset.act;
      const st = b.querySelector('.st');
      const cd = b.querySelector('.cd');
      b.classList.remove('off', 'ready');
      cd.style.display = 'none';
      let label = '';
      if (act === 'pause') {
        const has = !!(g.world && g.world.consoles.pause);
        if (!has) b.classList.add('off');
        if (g.pauseCd > 0) { cd.style.display = 'grid'; cd.textContent = Math.ceil(g.pauseCd); }
        else if (g.world && g.world.freezeTimer > 0) { label = g.world.freezeTimer.toFixed(1) + 's'; b.classList.add('ready'); }
        else if (has) { label = 'READY'; b.classList.add('ready'); }
        else label = 'N/A';
      } else if (act === 'volume' || act === 'bright') {
        const key = act === 'volume' ? 'volume' : 'brightness';
        const has = !!(g.world && g.world.consoles[key]);
        if (!has) b.classList.add('off');
        label = has ? (key === 'volume' ? g.world.volume : g.world.brightness) + '%' : 'N/A';
      } else if (act === 'gravity') {
        const has = !!(g.world && g.world.consoles.gravity);
        if (!has) b.classList.add('off');
        label = has ? g.gravityMode.toUpperCase() : 'N/A';
      } else if (act === 'undo') {
        label = g.rewinds + ' LEFT';
        if (!g.rewinds || !g.snapshots.length) b.classList.add('off');
      } else if (act === 'bin') {
        const has = !!(g.world && g.world.consoles.bin);
        if (!has) b.classList.add('off');
        label = g.energy + ' EN';
      } else if (act === 'window') {
        const n = g.world ? g.world.windows.filter(w => w.active).length : 0;
        label = n + ' WIN';
        if (!n) b.classList.add('off');
      } else if (act === 'dj') {
        label = g.abilities.doubleJump ? 'ONLINE' : '5 EN';
        if (g.abilities.doubleJump) b.classList.add('ready');
      } else if (act === 'slow') {
        label = (g.slowUntil > g.time ? Math.ceil(g.slowUntil - g.time) + 's' : '4 EN');
        if (g.slowUntil > g.time) b.classList.add('ready');
      } else if (act === 'shield') {
        label = (g.shieldUntil > g.time ? Math.ceil(g.shieldUntil - g.time) + 's' : '6 EN');
        if (g.shieldUntil > g.time) b.classList.add('ready');
      }
      st.textContent = label;
    });
    // boss bar
    const hb = document.getElementById('hintbar');
    if (g.boss && g.boss.active) hb.textContent = 'GLITCH · STAGE ' + (g.boss.stage + 1) + '/5';
    else hb.textContent = g.level.boss ? '' : '';
  },
  objDone(g, o) {
    if (o.id === 'exit') return false;
    if (o.id === 'plate') return !!g.flags.plate;
    if (o.id === 'reveal') return !!g.flags.reveal;
    if (o.id === 'shield') return !!g.flags.shield;
    if (o.id === 'reset') return !!g.gateHome;
    if (/^s\d$/.test(o.id)) return g.boss ? g.boss.stage >= parseInt(o.id.slice(1), 10) : false;
    return false;
  },
  bossBanner(txt) {
    const hb = document.getElementById('hintbar');
    if (hb) hb.textContent = txt;
  },
  bossBar(v) {
    const hb = document.getElementById('hintbar');
    if (hb) hb.textContent = 'PURGING CORE · ' + Math.round(clamp(v, 0, 1) * 100) + '%';
    const pr = document.getElementById('prompt');
    if (pr && v > 0) { pr.innerHTML = '<kbd>E</kbd>EXECUTE ESCAPE SEQUENCE'; pr.classList.add('on'); }
  },
  renderObjectivesPanel() {
    const g = Game;
    if (!g.level) return;
    document.getElementById('objScreenTitle').textContent = g.level.name;
    document.getElementById('objScreenSub').textContent = g.level.brief;
    document.getElementById('objScreenList').innerHTML = (g.level.objectives || []).map(o =>
      '<div class="objit ' + (this.objDone(g, o) ? 'on' : '') + '"><span class="bx"></span><span>' + o.text + '</span></div>').join('')
      + (g.level.optional || []).map(o => '<div class="objit dim"><span class="bx"></span><span>OPTIONAL · ' + o.text + '</span></div>').join('');
    const mech = [];
    if (g.world && g.world.consoles.pause) mech.push('PAUSE');
    if (g.world && g.world.consoles.volume) mech.push('VOLUME');
    if (g.world && g.world.consoles.gravity) mech.push('GRAVITY');
    if (g.world && g.world.consoles.brightness) mech.push('BRIGHTNESS');
    if (g.world && g.world.consoles.bin) mech.push('RECYCLE');
    if (g.world && g.world.windows.length) mech.push('WINDOWS');
    mech.push('REWIND');
    document.getElementById('objScreenMech').innerHTML = mech.map(m => '<span class="tag">' + m + '</span>').join('');
  },
  showObjectives() {
    if (Game.state !== 'playing') return;
    this.renderObjectivesPanel();
    this.screens.objectives.classList.add('active');
    this.current = 'objectives';
    Game.paused = true;
  },
  closeObjectives() {
    this.screens.objectives.classList.remove('active');
    this.current = 'game';
    Game.paused = false;
  },
  /* ------------------------------------------------ pause ---------- */
  togglePause() {
    if (Game.state !== 'playing') return;
    if (Game.paused) this.resume();
    else this.pauseGame();
  },
  pauseGame() {
    Game.paused = true;
    this.screens.pause.classList.add('active');
    document.getElementById('pauseLevel').textContent = (Game.level?.id || '') + ' · ' + (Game.level?.name || '');
    document.getElementById('pauseStats').innerHTML =
      'TIME ' + fmtTime(Game.levelTime) + ' · SCORE ' + fmtNum(this.liveScore(Game)) + '<br>' +
      'SHARDS ' + Game.stats.shards + '/' + (Game.level?.shards || []).length + ' · DAMAGE ' + Game.stats.damage + '<br>' +
      'REWINDS ' + Game.stats.rewinds + ' · CORRUPTION ' + Math.round(Game.corruption) + '%';
    this.current = 'pause';
    Sfx.click();
  },
  resume() {
    this.screens.pause.classList.remove('active');
    this.current = 'game';
    Game.paused = false;
    Sfx.click();
  },
  pauseAction(a) {
    if (a === 'resume') this.resume();
    if (a === 'restart') { this.resume(); Game.loadLevel(Game.level, { mode: Game.mode }); }
    if (a === 'settings') { this.pauseReturn = true; this.screens.pause.classList.remove('active'); this.show('settings'); }
    if (a === 'objectives') { this.screens.pause.classList.remove('active'); this.showObjectives(); }
    if (a === 'quit') { this.resume(); Game.quitToMenu(); }
  },
  backFromSettings() {
    if (this.pauseReturn) { this.pauseReturn = false; this.screens.settings.classList.remove('active'); this.screens.pause.classList.add('active'); }
    else this.show('menu');
  },
  syncSettings() {
    const S = Save.data.settings;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('volMaster', Math.round(S.master * 100));
    set('volMusic', Math.round(S.music * 100));
    set('volSfx', Math.round(S.sfx * 100));
    set('setSens', S.sens);
    document.getElementById('setQuality').value = S.quality;
    ['setShadows|shadows', 'setParticles|particles', 'setShake|shake', 'setInvert|invert', 'setTouch|touch',
      'setHints|hints', 'setMotion|motion', 'setContrast|contrast', 'setBigHud|bighud', 'setSubs|subs'].forEach(pair => {
      const [id, key] = pair.split('|');
      document.getElementById(id).classList.toggle('on', !!S[key]);
    });
  },
  /* ------------------------------------------------ complete ------- */
  showComplete(d) {
    const S = Save.data;
    const isBoss = !!d.boss;
    document.getElementById('compKicker').textContent = isBoss ? 'SYSTEM ROOTED' : (d.mode === 'daily' ? 'DAILY GLITCH CLEARED' : d.mode === 'custom' ? 'CUSTOM LEVEL CLEARED' : 'LEVEL CLEARED');
    document.getElementById('compTitle').textContent = isBoss ? 'GLITCH PURGED' : d.level.name;
    document.getElementById('compSub').textContent = d.level.brief;
    document.getElementById('compScore').textContent = fmtNum(d.score.total);
    document.getElementById('compTime').textContent = fmtTime(d.st.time);
    document.getElementById('compRank').textContent = d.score.rank;
    document.getElementById('compXP').textContent = '+' + fmtNum(d.xpGain) + ' XP';
    const rec = Save.level(d.level.id);
    document.getElementById('compRecord').textContent = rec ? (rec.best === d.score.total ? 'NEW BEST' : 'BEST ' + fmtNum(rec.best)) : '—';
    document.getElementById('compBreak').innerHTML = d.score.rows.map(([k, v]) =>
      '<div class="bd ' + (v < 0 ? 'minus' : '') + '"><span>' + k + '</span><b>' + (v > 0 ? '+' : '') + fmtNum(v) + '</b></div>').join('');
    document.getElementById('compShards').textContent = Array.from({ length: (d.level.shards || []).length }).map((_, i) => i < d.st.shards ? '◆' : '◇').join(' ') || '—';
    document.getElementById('compAch').innerHTML = d.unlocked.length
      ? d.unlocked.map(a => '<div class="tag hot" style="text-align:left">ACHIEVEMENT · ' + a.name + '</div>').join('')
      : '';
    const optDone = d.opt.length;
    document.getElementById('compKicker').textContent += optDone ? ' · ' + optDone + ' OPTIONAL' : '';
    const next = nextLevelId(d.level.id);
    const nextBtn = document.getElementById('compNext');
    nextBtn.textContent = isBoss ? 'Final transmission' : (d.mode === 'story' && next ? 'Next · ' + (levelById(next)?.name || '') : 'Continue');
    nextBtn.disabled = false;
    this._nextId = next;
    this._isBoss = isBoss;
    this.screens.complete.classList.add('active');
    this.current = 'complete';
  },
  nextLevel() {
    this.screens.complete.classList.remove('active');
    if (this._isBoss) { this.showEnding(); return; }
    if (Game.mode === 'daily' || Game.mode === 'custom' || !this._nextId) {
      if (Game.mode === 'daily') { this.show('menu'); Game.quitToMenu(); return; }
      this.show('menu'); Game.quitToMenu(); return;
    }
    const lvl = levelById(this._nextId);
    if (!lvl) { this.show('menu'); Game.quitToMenu(); return; }
    this.startLevel(lvl, 'story');
  },
  showEnding() {
    Game.quitToMenu();
    document.getElementById('endScore').textContent = fmtNum(Save.data.stats.total || 0);
    document.getElementById('endXP').textContent = fmtNum(Save.data.xp);
    this.show('ending');
  },
  /* ------------------------------------------------ profile -------- */
  renderProfile() {
    const S = Save.data;
    document.getElementById('profName').textContent = S.name || 'GUEST';
    document.getElementById('profNameInput').value = S.name || '';
    document.getElementById('profRank').textContent = 'Level ' + Save.xpLevel() + ' · ' + fmtNum(S.xp) + ' XP';
    document.getElementById('profXP').textContent = fmtNum(S.xp);
    document.getElementById('profXPbar').style.width = ((S.xp % 1200) / 1200 * 100).toFixed(1) + '%';
    document.getElementById('profCleared').textContent = Object.values(S.levels).filter(l => l.cleared).length + ' / ' + LEVELS.length;
    document.getElementById('profTotal').textContent = fmtNum(S.stats.total || 0);
    document.getElementById('profFastest').textContent = S.stats.fastest ? fmtTime(S.stats.fastest) : '—';
    document.getElementById('profRewinds').textContent = S.stats.rewinds || 0;
    document.getElementById('profBoss').textContent = S.stats.boss || 0;
    const th = document.getElementById('profThemes');
    th.innerHTML = '';
    THEMES.forEach(t => {
      const un = S.xp >= t.xp;
      const c = el('button', 'card' + (un ? '' : ' locked'));
      c.style.minHeight = 'auto';
      c.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span class="themesw" style="background:' + t.color + '"></span><b style="font-family:var(--ff-d);font-size:11px;letter-spacing:.08em">' + t.name + '</b></div>' +
        '<p>' + (un ? (S.theme === t.id ? 'ACTIVE' : 'EQUIP') : t.xp + ' XP TO UNLOCK') + '</p>';
      on(c, 'click', () => {
        if (!un) { Game.toast('LOCKED · ' + t.xp + ' XP', 'warn'); return; }
        S.theme = t.id; Save.write(); Game.applyTheme(); this.renderProfile(); this.buildThemeButtons(); Sfx.ui();
      });
      th.appendChild(c);
    });
    const tr = document.getElementById('profTrails');
    tr.innerHTML = '';
    TRAILS.forEach(t => {
      const un = S.xp >= t.xp;
      const c = el('button', 'card' + (un ? '' : ' locked'));
      c.style.minHeight = 'auto';
      c.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span class="themesw" style="background:' + t.color + ';border-radius:2px"></span><b style="font-family:var(--ff-d);font-size:11px;letter-spacing:.08em">' + t.name + '</b></div>' +
        '<p>' + (un ? (S.trail === t.id ? 'ACTIVE' : 'EQUIP') : t.xp + ' XP TO UNLOCK') + '</p>';
      on(c, 'click', () => {
        if (!un) { Game.toast('LOCKED · ' + t.xp + ' XP', 'warn'); return; }
        S.trail = t.id; Save.write();
        const col = (TRAILS.find(x => x.id === t.id) || TRAILS[0]).color;
        if (Game.player) Game.player.trail.material.color.set(col);
        this.renderProfile(); Sfx.ui();
      });
      tr.appendChild(c);
    });
  },
  renderAchievements() {
    const host = document.getElementById('achGrid');
    host.innerHTML = '';
    ACHIEVEMENTS.forEach((a, i) => {
      const got = !!Save.data.ach[a.id];
      const d = el('div', 'ach' + (got ? ' on' : ''));
      d.innerHTML = '<div class="badge">' + String(i + 1).padStart(2, '0') + '</div><div><h5>' + a.name + '</h5><p>' + a.desc + '</p></div>';
      host.appendChild(d);
    });
  },
  renderLeaderboard() {
    const tabs = document.getElementById('lbTabs');
    const ids = ['ALL', ...LEVELS.map(l => l.id), 'daily'];
    if (!this.lbTab) this.lbTab = 'ALL';
    tabs.innerHTML = '';
    ids.forEach(id => {
      const b = el('button', 'tab' + (this.lbTab === id ? ' on' : ''), id === 'ALL' ? 'ALL LEVELS' : id.toUpperCase());
      on(b, 'click', () => { this.lbTab = id; this.renderLeaderboard(); Sfx.ui(); });
      tabs.appendChild(b);
    });
    const table = document.getElementById('lbTable');
    const rows = [];
    const collect = id => (Save.data.lb[id] || []).map(r => ({ ...r, id }));
    let source = [];
    if (this.lbTab === 'ALL') source = Object.keys(Save.data.lb).flatMap(collect).sort((a, b) => b.score - a.score);
    else source = collect(this.lbTab).sort((a, b) => b.score - a.score);
    table.innerHTML = '<tr><th>#</th><th>Operative</th><th>Level</th><th>Score</th><th>Time</th><th>Date</th></tr>' +
      (source.length ? source.slice(0, 25).map((r, i) =>
        '<tr class="' + (r.name === (Save.data.name || 'GUEST') ? 'me' : '') + '"><td>' + (i + 1) + '</td><td>' + (r.name || 'GUEST') + '</td><td>' + r.id.toUpperCase() + '</td><td>' + fmtNum(r.score) + '</td><td>' + fmtTime(r.time) + '</td><td>' + new Date(r.date).toLocaleDateString('en-GB') + '</td></tr>').join('')
        : '<tr><td colspan="6" style="color:var(--dim2);padding:18px 6px">No records yet. Clear a level to appear here.</td></tr>');
  },
};
