import { readFileSync, writeFileSync, mkdirSync } from 'fs';

/* UI BREAKER : NEXUS OS — single-file build
   Concatenates src/*.js + src/10_style.css + src/20_body.html into index.html. */

const S = './src/';
const css = readFileSync(S + '10_style.css', 'utf8');
const body = readFileSync(S + '20_body.html', 'utf8');
const jsFiles = ['30_core.js', '31_engine.js', '32_world.js', '33_mechanics.js', '34_levels.js', '35_game.js', '36_ui.js', '37_editor.js', '38_boot.js'];
const js = jsFiles.map(f => `\n/* ===== ${f} ===== */\n` + readFileSync(S + f, 'utf8')).join('\n');

mkdirSync('./build', { recursive: true });
writeFileSync('./build/bundle.mjs', js);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#090B12">
<title>UI BREAKER · NEXUS OS</title>
<meta name="description" content="UI BREAKER: NEXUS OS — a premium 3D physics puzzle game where the interface is the weapon.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%23090B12'/><rect x='12' y='14' width='40' height='28' rx='4' fill='none' stroke='%2325D9FF' stroke-width='3'/><path d='M20 52h24' stroke='%23FF6A24' stroke-width='4' stroke-linecap='round'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
${css}
#errbox{position:fixed;left:12px;bottom:12px;z-index:9999;display:none;max-width:70vw;padding:10px 14px;background:rgba(30,6,10,.95);border:1px solid #ff3d5a;color:#ffb8c4;font:11px/1.5 monospace}
</style>
</head>
<body>
${body}
<div id="errbox"></div>
<script type="module">
${js}
</script>
</body>
</html>`;
writeFileSync('./index.html', html);
console.log('built index.html', (html.length / 1024).toFixed(1) + 'kb', 'js', (js.length / 1024).toFixed(1) + 'kb');
