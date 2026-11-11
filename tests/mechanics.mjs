import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
const server = spawn('python3',['-m','http.server','8123','--directory','.'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,700));
const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--mute-audio']});
const page = await browser.newPage(); await page.setViewport({width:900,height:560});
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
page.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('Failed to load')) errs.push('c:'+m.text()); });
await page.goto('http://localhost:8131/index.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction('window.__UI_BREAKER_READY__===true',{timeout:20000});
await page.evaluate(()=>{ const S=NEXUS.Save.data.settings; S.quality='low'; S.shadows=false; NEXUS.Game.applySettings(); });
await page.keyboard.press('Space'); await new Promise(r=>setTimeout(r,400));
const wait = ms => new Promise(r=>setTimeout(r,ms));

// ---- 1. PAUSE
await page.evaluate(()=>NEXUS.loadLevel('1-1')); await wait(700);
const pause1 = await page.evaluate(async ()=>{
  const G=NEXUS.Game, m=G.world.movers[0];
  const before = m? m.pos.toArray().map(n=>+n.toFixed(2)) : null;
  NEXUS.pauseWorld();
  const fz = G.world.freezeTimer;
  const p0 = m? m.pos.x : null;
  await new Promise(r=>setTimeout(r,500));
  const p1 = m? m.pos.x : null;
  return { freeze:+fz.toFixed(1), cd:+G.pauseCd.toFixed(1), before, moved: p0!=null ? Math.abs(p1-p0) : null };
});
console.log('PAUSE', JSON.stringify(pause1));

// ---- 2. GLITCH countermeasure after 3 pauses
const adapt = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  for (let i=0;i<3;i++){ G.pauseCd=0; NEXUS.pauseWorld(); await new Promise(r=>setTimeout(r,60)); }
  const movers = G.world.movers.filter(m=>m.hazard);
  return { pauses:G.director.counts.pause, resist: movers.some(m=>m.freezeResist), hazardCount: movers.length, aware:G.director.awareness(), fired:Object.keys(G.director.fired) };
});
console.log('GLITCH-PAUSE', JSON.stringify(adapt));
await page.evaluate(()=>NEXUS.Game.quitToMenu());

// ---- 3. VOLUME wind
await page.evaluate(()=>NEXUS.loadLevel("3-2")); await wait(700);
const vol = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  const p = G.world.props[0];
  const a = p ? p.pos.toArray().map(n=>+n.toFixed(2)) : null;
  NEXUS.setVolume(100);
  await new Promise(r=>setTimeout(r,1400));
  const b = p ? p.pos.toArray().map(n=>+n.toFixed(2)) : null;
  const moved = a&&b ? Math.hypot(b[0]-a[0],b[2]-a[2]) : null;
  const door = G.world.doors[0];
  return { vol:G.world.volume, a, b, moved:+(moved||0).toFixed(2), plate:G.world.plates.map(pl=>pl.pressed), doorOpen: door? !!door.open : null, props:G.world.props.length };
});
console.log('VOLUME', JSON.stringify(vol));

// ---- 4. BRIGHTNESS + GRAVITY on 3-3
await page.evaluate(()=>NEXUS.loadLevel('3-3')); await wait(700);
const br = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  const s0 = NEXUS.solidCount();
  NEXUS.setBrightness(100);
  await new Promise(r=>setTimeout(r,300));
  const s1 = NEXUS.solidCount();
  const hiddenOn = G.world.hidden.filter(h=>h.kind==="hidden"||h.solid!==undefined).map(h=>!!(h.active!==false));
  return { solids:[s0,s1], brightness:G.world.brightness, hiddenOn };
});
console.log('BRIGHTNESS', JSON.stringify(br));
const grav = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  NEXUS.setGravity('up');
  await new Promise(r=>setTimeout(r,1600));
  const s = NEXUS.state();
  return { mode:s.gravity, y:s.player[1], grounded:s.grounded, up:G.player.up.toArray().map(n=>+n.toFixed(0)) };
});
console.log('GRAVITY-UP', JSON.stringify(grav));

// ---- 5. WINDOW plate on 2-1
await page.evaluate(()=>NEXUS.loadLevel('2-1')); await wait(700);
const win = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  const w = G.world.windows[0];
  const d = G.world.doors[0];
  const before = !!d.open;
  // place window flat on the plate
  const pl = G.world.plates[0];
  w.pos.set(pl.pos.x, pl.pos.y + 0.45, pl.pos.z);
  if (w.mesh) w.mesh.position.copy(w.pos);
  w.half.set(w.w/2, w.h/2, 0.26);
  // rotate flat
  if (w.mesh) { w.mesh.rotation.x = 0; }
  await new Promise(r=>setTimeout(r,900));
  return { platePressed:G.world.plates[0].pressed, doorBefore:before, doorAfter:!!d.open, win:{w:w.w,h:w.h} };
});
console.log('WINDOW-PLATE', JSON.stringify(win));
const resize = await page.evaluate(async ()=>{
  const G=NEXUS.Game, w=G.world.windows[0];
  const w0=w.w, h0=w.h;
  G.resizeWin(w, w0*0.6, h0*0.4);
  await new Promise(r=>setTimeout(r,200));
  return { from:[+w0.toFixed(2),+h0.toFixed(2)], to:[+w.w.toFixed(2),+w.h.toFixed(2)], meshChildren:w.mesh.children.length, half:w.half.toArray().map(n=>+n.toFixed(2)), solid:!!w.solid };
});
console.log('WINDOW-RESIZE', JSON.stringify(resize));

// ---- 6. RECYCLE
await page.evaluate(()=>NEXUS.loadLevel('5-2')); await wait(800);
const rec = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  const e0=G.energy;
  const dyn = G.world.props.find(p=>p.dynamic && !p.essential);
  const okProp = dyn ? NEXUS.Mechanics.recycle(G, dyn) : 'nodyn';
  const essential = G.world.consoles.bin ? { kind:'bin', essential:true } : null;
  const okEss = essential ? NEXUS.Mechanics.recycle(G, essential) : null;
  await new Promise(r=>setTimeout(r,200));
  return { e0, e1:G.energy, okProp, okEss, recycles:G.stats.recycles, dynFound:!!dyn };
});
console.log('RECYCLE', JSON.stringify(rec));

// ---- 7. REWIND restores state
await page.evaluate(()=>NEXUS.loadLevel('4-1')); await wait(800);
const rw = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  const p0 = G.player.pos.clone();
  NEXUS.setBrightness(30);            // creates snapshot
  await new Promise(r=>setTimeout(r,120));
  const moved = G.player.pos.clone();
  NEXUS.teleport(p0.x+5, p0.y, p0.z-4);
  await new Promise(r=>setTimeout(r,300));
  const afterMove = G.player.pos.clone();
  const antes = { rewinds:G.rewinds, corr:G.corruption, snaps:G.snapshots.length, bright:G.world.brightness };
  const ok = NEXUS.rewind();
  await new Promise(r=>setTimeout(r,300));
  return { ok, antes, depois:{ rewinds:G.rewinds, corr:G.corruption, snaps:G.snapshots.length, bright:G.world.brightness, pos:G.player.pos.toArray().map(n=>+n.toFixed(2)) }, movedBack: G.player.pos.distanceTo(afterMove) > 1 };
});
console.log('REWIND', JSON.stringify(rw));

// ---- 8. stacking + stack countermeasure, and 5-3 boss presence
const stack = await page.evaluate(async ()=>{
  const G=NEXUS.Game;
  G.director.count('stack',1);
  await new Promise(r=>setTimeout(r,200));
  return { fired:Object.keys(G.director.fired), pursuers:G.world.movers.filter(m=>m.pursuer).length };
});
console.log('STACK', JSON.stringify(stack));
console.log('ERRORS', errs.slice(0,8));
await browser.close(); server.kill();
