import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
const server = spawn('python3',['-m','http.server','8123','--directory','.'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,800));
const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--mute-audio']});
const page = await browser.newPage(); await page.setViewport({width:1280,height:800});
const errors=[];
page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
page.on('console',m=>{ if(m.type()==='error' && !m.text().includes('Failed to load')) errors.push('CONSOLE '+m.text()); });
await page.goto('http://localhost:8132/index.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction('window.__UI_BREAKER_READY__===true',{timeout:20000});
await page.keyboard.press('Space'); await new Promise(r=>setTimeout(r,700));
const S = () => page.evaluate(()=>NEXUS.screen());

console.log('menu:', await S());
// nav audit
for (const go of ['play','levels','daily','timeattack','sandbox','editor','profile','achievements','leaderboard','settings','continue']){
  const before = errors.length;
  try {
    if (go!=='continue') {
      await page.evaluate((g)=>{ document.querySelector(`[data-go="${g}"]`).click(); }, go);
    } else {
      await page.evaluate(()=>{ document.querySelector('[data-go="continue"]').click(); });
    }
    await new Promise(r=>setTimeout(r,450));
    const st = await page.evaluate(()=>({screen:NEXUS.screen(), state:NEXUS.Game.state, level:NEXUS.Game.level&&NEXUS.Game.level.id}));
    console.log('nav', go, '->', JSON.stringify(st), errors.length>before?'ERRORS':'');
    if (st.state==='playing') { await page.evaluate(()=>NEXUS.Game.quitToMenu()); await new Promise(r=>setTimeout(r,250)); }
    if (st.screen && !['menu','chapters','levels','timeattack','editor','profile','achievements','leaderboard','settings'].includes(st.screen)) {
      await page.evaluate(()=>NEXUS.UI.show('menu'));
    }
  } catch(e){ console.log('nav FAIL', go, e.message); }
}
// ensure back to menu
await page.evaluate(()=>NEXUS.UI.show('menu'));

// settings switches
const sw = await page.evaluate(async ()=>{
  NEXUS.UI.show('settings');
  const before = JSON.parse(JSON.stringify(NEXUS.Save.data.settings));
  document.getElementById('setMotion').click();
  document.getElementById('setContrast').click();
  document.getElementById('setBigHud').click();
  const after = NEXUS.Save.data.settings;
  const r = { motionBefore:before.motion, motionAfter:after.motion, contrast:after.contrast, bighud:after.bighud };
  document.getElementById('setMotion').click(); document.getElementById('setContrast').click(); document.getElementById('setBigHud').click();
  return r;
});
console.log('settings', sw);

// theme + name
const prof = await page.evaluate(()=>{
  NEXUS.UI.show('profile');
  document.getElementById('profNameInput').value = 'TESTER';
  document.getElementById('profSaveName').click();
  return { name: NEXUS.Save.data.name, themes: document.querySelectorAll('#profThemes .card').length, trails: document.querySelectorAll('#profTrails .card').length };
});
console.log('profile', prof);

// leaderboard tabs
const lb = await page.evaluate(async ()=>{
  NEXUS.UI.show('leaderboard');
  const tabs = document.querySelectorAll('#lbTabs .tab').length;
  document.querySelectorAll('#lbTabs .tab')[1].click();
  return { tabs, rows: document.querySelectorAll('#lbTable tr').length };
});
console.log('leaderboard', lb);

// editor flow
const ed = await page.evaluate(async ()=>{
  NEXUS.UI.show('editor');
  const cells = document.querySelectorAll('#edgrid .edcell');
  const paint = (i, tool) => { NEXUS.UI; const t=[...document.querySelectorAll('.edtool')].find(b=>b.dataset.tool===tool); t.click(); cells[i].click(); };
  paint(0,'floor'); paint(1,'floor'); paint(2,'floor'); paint(5,'shard'); paint(11,'exit'); paint(20,'spawn'); paint(30,'window');
  const count = document.getElementById('edCount').textContent;
  document.getElementById('edSave').click();
  const code = document.getElementById('edShare').value;
  const saved = NEXUS.Save.data.custom.length;
  document.getElementById('edPlay').click();
  await new Promise(r=>setTimeout(r,600));
  return { count, codeLen: code.length, saved, state: NEXUS.Game.state, level: NEXUS.Game.level && NEXUS.Game.level.id, platforms: NEXUS.Game.world ? NEXUS.Game.world.solids.length : 0, screen: NEXUS.screen() };
});
console.log('editor', ed);
await page.evaluate(()=>NEXUS.Game.quitToMenu());

// complete flow + persistence
const cmp = await page.evaluate(async ()=>{
  NEXUS.loadLevel('1-1');
  await new Promise(r=>setTimeout(r,300));
  NEXUS.teleportToExit();
  await new Promise(r=>setTimeout(r,600));
  return { screen: NEXUS.screen(), score: document.getElementById('compScore').textContent, rows: document.querySelectorAll('#compBreak .bd').length, next: document.getElementById('compNext').textContent };
});
console.log('complete', cmp);
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction('window.__UI_BREAKER_READY__===true',{timeout:20000});
const persist = await page.evaluate(()=>({ levels:Object.keys(NEXUS.save().levels), xp:NEXUS.save().xp, name:NEXUS.save().name, customs:NEXUS.save().custom.length, ach:Object.keys(NEXUS.save().ach) }));
console.log('persist', persist);
console.log('ERRORS:', errors.slice(0,10));
await browser.close(); server.kill();
