/* Live regression + AI channel browser test.
   Usage: node tests/ai-browser.mjs [url]   (default: production) */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const URL = process.argv[2] || 'https://ui-breaker-nexus.vercel.app/';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });

const ok = [], bad = [];
const check = (name, cond, extra = '') => (cond ? ok : bad).push(name + (extra ? ' :: ' + extra : ''));
const wait = ms => new Promise(r => setTimeout(r, ms));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__UI_BREAKER_READY__===true', { timeout: 40000 });
await page.keyboard.press('Space');
await wait(900);

/* ---- existing game intact ---- */
const menu = await page.evaluate(() => ({ levels: NEXUS.LEVELS.length, title: document.title, screen: NEXUS.screen() }));
check('15 levels present', menu.levels === 15, 'got ' + menu.levels);

const ids = await page.evaluate(() => NEXUS.LEVELS.map(l => l.id));
let loaded = 0;
for (const id of ids) {
  await page.evaluate(l => NEXUS.loadLevel(l), id);
  await wait(320);
  const st = await page.evaluate(() => ({ s: NEXUS.state(), screen: NEXUS.screen() }));
  const good = st.s.state === 'playing' && Array.isArray(st.s.player) && st.s.player.every(n => Number.isFinite(n));
  if (good) loaded++;
}
check('all 15 levels still load and simulate', loaded === 15, loaded + '/15');

/* ---- AI channel ---- */
const aiMounted = await page.evaluate(() => !!window.NEXUS_AI && !!document.getElementById('aiPanel'));
check('GLITCH channel mounted', aiMounted);
await wait(1200);
const stateText = await page.evaluate(() => document.getElementById('aiState').textContent);
check('AI status is explicit', /AI (ONLINE|OFFLINE)/.test(stateText), stateText);

await page.keyboard.press('h');
await wait(2200);
const afterHint = await page.evaluate(() => ({
  open: document.getElementById('aiPanel').classList.contains('open'),
  rows: [...document.querySelectorAll('.ai-row .ai-text')].map(n => n.textContent).filter(Boolean),
}));
check('hint key opens channel and answers', afterHint.open && afterHint.rows.length > 0, 'rows:' + afterHint.rows.length);
check('hint has ladder depth label', JSON.stringify(afterHint.rows).includes('HINT') || afterHint.rows.some(r => /CLUE|STRATEGY|SOLUTION/.test(r)));

await page.evaluate(() => { const i = document.getElementById('aiInput'); i.value = 'How do I use gravity?'; document.getElementById('aiForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await wait(2500);
const afterAsk = await page.evaluate(() => [...document.querySelectorAll('.ai-row .ai-text')].map(n => n.textContent).filter(Boolean));
check('assistant answers a player question', afterAsk.length > afterHint.rows.length, afterAsk.length + ' rows');

const mission = await page.evaluate(async () => {
  document.getElementById('aiMission').click();
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    const txt = [...document.querySelectorAll('.ai-row')].map(n => n.textContent).join(' | ');
    if (/BRIEFING/.test(txt)) return txt;
  }
  return [...document.querySelectorAll('.ai-row')].map(n => n.textContent).join(' | ');
});
check('mission briefing delivered', /BRIEFING/.test(mission), mission.slice(0, 90));

/* ---- gameplay unaffected while AI talks ---- */
const baseBefore = await page.evaluate(() => NEXUS.state().framed);
await wait(900);
const baselineFps = (await page.evaluate(() => NEXUS.state().framed)) - baseBefore;
const before = await page.evaluate(() => NEXUS.state().framed);
await page.evaluate(() => { NEXUS.hold('w', true); });
await wait(900);
await page.evaluate(() => { NEXUS.hold('w', false); });
const after = await page.evaluate(() => NEXUS.state().framed);
check('render loop keeps running during AI traffic', (after - before) >= Math.max(2, baselineFps * 0.4),
  'baseline ' + baselineFps + ' frames/s, during AI ' + (after - before) + ' frames');

/* ---- daily challenge from the backend ---- */
const daily = await page.evaluate(async () => {
  const d = await window.NEXUS_AI.daily();
  if (!d) return null;
  NEXUS.loadLevel(d.level);
  await new Promise(r => setTimeout(r, 1200));
  return { identity: d.identity, valid: d.validation.valid, state: NEXUS.state().state, level: NEXUS.state().level };
});
check('daily challenge is validated and playable', !!daily && daily.valid === true && daily.state === 'playing', JSON.stringify(daily));

/* ---- mobile layout ---- */
await page.setViewport({ width: 390, height: 844 });
await wait(500);
const mob = await page.evaluate(() => {
  const p = document.getElementById('aiPanel');
  p.classList.add('open');
  const r = p.getBoundingClientRect();
  return { w: Math.round(r.width), right: Math.round(r.right), vw: window.innerWidth, toggle: !!document.getElementById('aiToggle') };
});
check('AI panel fits 390px viewport', mob.right <= mob.vw + 1 && mob.w > 200 && mob.toggle, JSON.stringify(mob));

await page.screenshot({ path: 'ai-panel-mobile.png' });

/* ---- console health ---- */
check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' ;; '));

console.log('\nPASS (' + ok.length + ')');
ok.forEach(o => console.log('  + ' + o));
if (bad.length) {
  console.log('\nFAIL (' + bad.length + ')');
  bad.forEach(b => console.log('  - ' + b));
  fs.writeFileSync('ai-browser-fail.txt', bad.join('\n') + '\n' + errors.join('\n'));
}
await browser.close();
process.exit(bad.length ? 1 : 0);
