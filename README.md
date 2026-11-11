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

---

# AI INTELLIGENCE LAYER (GLITCH)

The game ships a real server-side AI layer. The browser never holds a provider
key and never talks to a model provider directly.

```
Browser game  →  /api/*  (Vercel serverless)  →  FreeLLMAPI (/v1/chat/completions)  →  provider
```

## Endpoints

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/status` | GET | Secret-free readiness report (`ready`, `reason`, model names, usage). `?probe=1` also tests provider reachability. |
| `/api/session` | POST | Issues an HMAC-signed session id (`x-nexus-session`). Random seed, no IP or device id stored. |
| `/api/glitch` | POST | GLITCH personality engine, hint ladder (1-3), mission director, in-game assistant. Returns validated structured JSON. |
| `/api/puzzle` | POST | Puzzle architect. The model proposes, the engine validates, invalid proposals are replaced by deterministic generations. |
| `/api/daily` | GET | One Daily Glitch per UTC date. Same seed for every player, edge-cached. |

## Configuration (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Notes |
| --- | --- | --- |
| `FREELLMAPI_BASE_URL` | yes | Your FreeLLMAPI instance, e.g. `https://your-router.example.com/v1`. Must be HTTPS and publicly reachable (`localhost` cannot work from Vercel). |
| `FREELLMAPI_API_KEY` | yes | Unified key from the FreeLLMAPI dashboard. |
| `GLITCH_PRIMARY_MODEL` | no | Defaults to `auto` (router picks). |
| `GLITCH_FALLBACK_MODEL` | no | Secondary model tried if the primary fails. |
| `GLITCH_REASONING_MODEL` | no | Stronger model used for puzzle generation when set. |
| `GLITCH_AI_ENABLED` | no | `0` disables all AI calls and forces the deterministic protocol. |
| `GLITCH_TIMEOUT_MS` | no | Per-call timeout, default `9000`. |
| `GLITCH_MAX_OUTPUT_TOKENS` | no | Output cap, default `420`. |
| `GLITCH_SESSION_SECRET` | no | Set a stable secret so sessions survive redeploys. |

Without the first two variables the game is fully playable: `/api/status`
reports `ready:false`, the panel shows `AI OFFLINE · deterministic protocol`,
and every call site answers from authored dialogue, rule-based hints and
engine-generated validated challenges.

## Guarantees enforced in code

- Keys only exist in `process.env` on the server; `/api/status` returns the host, never the key.
- Strict JSON schema per response type. Unknown fields, wrong types, unsafe action
  types and oversized strings are rejected. One repair attempt, never a loop.
- Player text is screened for prompt injection; flagged text is replaced before it
  reaches the model.
- HMAC session ownership + per-session, per-feature token buckets (dialogue, hint,
  mission, puzzle, daily).
- Timeouts with a single retry on 429/5xx and model fallback; full error mapping
  for 401/403/429/5xx/timeout/empty/invalid JSON, each with a player-facing message.
- Puzzle proposals are only published after `validatePuzzle` proves: bounds hold,
  critical objects do not intersect, spawn and exit sit on solid geometry, and a
  traversal path exists for the difficulty's bridge budget.
- The model never touches the physics engine, scores or rewards. All rewards and
  completion are computed by the game engine.
- Usage log records request id, model, latency, tokens, status and fallback flag.
  No prompt text, no credentials, no personal data.

## Tests

```bash
node tests/ai-unit.mjs        # 32 assertions: sessions, limits, schemas, injection,
                              # puzzle generation/validation/determinism, provider
                              # error mapping, HTTP handlers
node tests/live.mjs           # browser audit (needs puppeteer-core + pngjs)
```
