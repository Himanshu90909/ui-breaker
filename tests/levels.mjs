import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
const server = spawn('python3',['-m','http.server','8124','--directory','.'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,800));
const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--mute-audio']});
const page = await browser.newPage(); await page.setViewport({width:960,height:600});
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
page.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('Failed to load')) errs.push('c:'+m.text()); });
await page.goto('http://localhost:8133/index.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction('window.__UI_BREAKER_READY__===true',{timeout:20000});
await page.evaluate(()=>{ const S=NEXUS.Save.data.settings; S.quality='low'; S.shadows=false; NEXUS.Game.applySettings(); });
await page.keyboard.press('Space'); await new Promise(r=>setTimeout(r,400));
const wait = ms => new Promise(r=>setTimeout(r,ms));

// A) gravity-up containment + ceiling walking in 3-3
await page.evaluate(()=>NEXUS.loadLevel('3-3')); await wait(700);
const up = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  NEXUS.setGravity('up');
  await new Promise(r=>setTimeout(r,5000));
  const afterHover = { y:+G.player.pos.y.toFixed(2), hp:G.player.hp, state:G.state };
  // now stand under the slab on purpose
  NEXUS.teleport(0, 5, -4);
  await new Promise(r=>setTimeout(r,1800));
  const onCeil = { y:+G.player.pos.y.toFixed(2), grounded:G.player.grounded, hp:G.player.hp };
  return { afterHover, onCeil };
});
console.log('GRAV-UP', JSON.stringify(up));

// B) every level: load, teleport to exit, confirm completion screen
const ids = ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3','4-1','4-2','4-3','5-1','5-2'];
const results = [];
for (const id of ids){
  await page.evaluate((i)=>NEXUS.loadLevel(i), id); await wait(500);
  const r = await page.evaluate(async ()=>{
    const G=NEXUS.Game;
    NEXUS.teleportToExit();
    await new Promise(r=>setTimeout(r,700));
    return { screen:NEXUS.screen(), score:document.getElementById('compScore')?.textContent, stars:document.querySelectorAll('#compStars .on').length, level:G.level && G.level.id };
  });
  results.push([id, r.screen, r.score, r.stars]);
  await page.evaluate(()=>{ if (NEXUS.screen()==='complete') NEXUS.UI.show('menu'); });
  await wait(150);
}
console.log('LEVELS', JSON.stringify(results));
console.log('ERRORS', errs.slice(0,8));
await browser.close(); server.kill();
