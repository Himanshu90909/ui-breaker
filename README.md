# UI BREAKER · NEXUS OS

**YOUR INTERFACE. YOUR WEAPON. YOUR REALITY.**

A 3D browser puzzle-platformer about breaking a corrupted operating system with its own interface controls. You are inside NEXUS OS, GLITCH has taken it over, and every window, slider and toggle you touch is real geometry and real force.

**Play:** https://ui-breaker-nexus.vercel.app

![Main menu](https://base44.app/api/apps/6a5eef297670ec1531c3af86/files/mp/public/6a5eef297670ec1531c3af86/4f19c5013_live-menu-hd.png)

## What it is

- **15 levels across 5 chapters**, each a subsystem of a dying operating system: BOOT (1-x), WINDOW MANAGEMENT (2-x), SYSTEM SETTINGS (3-x), CORRUPTION (4-x), KERNEL (5-x).
- **Six interface mechanics with real physics**, not decoration.
- **GLITCH** as an antagonist: rule-based countermeasures, dialogue, environmental glitches and a five-stage boss fight.
- **Real 3D**: Three.js scenes with shadows, a bloom and colour-grade pass, a rigged player character with run, jump, air and landing animation, holo-glass windows, volumetric dust and a distinct lighting mood per chapter.

## Mechanics

| Control | Physical effect |
| --- | --- |
| PAUSE | Freezes hazard movers for 4.2s on a 9s cooldown. Frozen blades become safe platforms, so it is exploitable on purpose. |
| VOLUME | A slider that is a wind field. Cargo, debris and the player are pushed with mass-based force; above 88 percent the bay destabilises. |
| GRAVITY | Flips the world's up axis (down, up, left, right). Player, props and camera roll follow; collision stays stable and the player is contained if nothing is above. |
| BRIGHTNESS | Reveals hidden geometry. Bridges and clues only exist above a brightness threshold. |
| RECYCLE BIN | Absorbs eligible objects for +3 energy with a particle burst. Essential mission objects are refused. |
| WINDOWS | Grab, drag, rotate and resize real solid panes. They work as bridges, shields and weights that press plates. |
| UNDO PARADOX | Rewinds to a stored world state. Each rewind costs a charge and adds 14 corruption. |

GLITCH adapts on deterministic thresholds so every counter is learnable rather than random: three pauses make hazards freeze-resistant, window stacking deploys pursuer programs, repeated gravity flips spawn an unstable zone, heavy recycling halves energy output, and two rewinds leave a copy of you behind.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| Space | Jump (hold for height) |
| Shift | Sprint |
| E | Interact / use console / use held object |
| F | Grab nearest window (again to release) |
| R | Rotate held window 90 degrees |
| [ ] or - = or wheel | Resize held window |
| 1-5 | Quick console access: pause, volume, gravity, brightness, recycle |
| Z | Undo paradox (rewind) |
| X C V | Spend energy on double jump, slow time, shield |
| J | Objectives |
| Esc | Pause menu |

Twin-stick touch controls with an interaction dock appear below 820px width. Progress, settings, achievements, custom levels and leaderboards persist in `localStorage`, so no account is needed.

## Project layout

```
index.html          built single-file game (this is what gets deployed)
build.mjs           concatenates src/ into index.html
vercel.json         static hosting headers
src/
  10_style.css      UI skin, HUD, menus, mobile shell
  20_body.html      DOM shell: hud, menus, pause, editor, touch layer
  30_core.js        config, math helpers, input, save manager, audio
  31_engine.js      renderer, bloom and grade pipeline, post effects
  32_world.js       level geometry, solids, windows, props, wind, plates
  33_mechanics.js   the six mechanics, rewind, GLITCH director
  34_levels.js      all 15 level definitions
  35_game.js        player controller, camera, interactions, boss, loop
  36_ui.js          HUD, menus, settings, leaderboards, toasts
  37_editor.js      level editor and custom level storage
  38_boot.js        boot sequence and the window.NEXUS test surface
tests/              puppeteer checks that drive a real Chrome
```

## Build and run

```bash
npm install        # puppeteer-core and pngjs, used by the tests only
npm run build      # src/ -> index.html
npm run serve      # http://localhost:8080
```

The game has no runtime dependencies beyond Three.js from a CDN; everything else is inlined into one file.

## Tests

The tests start a local static server, drive headless Chrome and read real game state back through the `window.NEXUS` surface.

```bash
node tests/mechanics.mjs   # pause, volume wind, brightness, gravity, windows, recycle, rewind, GLITCH counters
node tests/levels.mjs      # gravity containment plus every level reaching the completion screen
node tests/audit.mjs       # menus, settings, editor, achievements, leaderboards, persistence
node tests/live.mjs        # the deployed URL: boot time, render stats, play a level, complete it
```

Chrome is expected at `/usr/bin/google-chrome`; change `executablePath` in the test files if yours lives elsewhere.

## Deploy

Static site, no server or build step on the host. `vercel deploy --prod` from this folder publishes `index.html`; the Vercel project is linked to this repository, so a push to `main` triggers a production deployment.
