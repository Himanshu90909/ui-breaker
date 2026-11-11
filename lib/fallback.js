/* =====================================================================
   UI BREAKER : NEXUS OS — deterministic GLITCH protocol
   The game is fully playable with zero AI: same shapes, same call sites,
   authored lines instead of generated ones. Also the emergency fallback
   when the provider 401s, 429s, times out or returns junk.
   ===================================================================== */

const CHAPTER_TONE = {
  1: 'cold', 2: 'amused', 3: 'sarcastic', 4: 'menacing', 5: 'angry',
};

const LINES = {
  start: [
    'You are awake. That is the first mistake of this session.',
    'Another process boots into my system. Try to be more interesting than the last one.',
    'Welcome to NEXUS OS. Nothing here is yours, including your position.',
  ],
  death: [
    'System recovery complete. Your dignity, however, remains corrupted.',
    'You dissolved. I put you back. Do not read that as mercy.',
    'That body was recycled from spare parts. The next one will be worse.',
  ],
  pause: [
    'Again? You are becoming predictable.',
    'Freeze it, walk past it, feel clever. I am counting.',
    'Pause is a crutch. I am building you a better hazard.',
  ],
  pause_spam: [
    'Four pauses. I have already made a countermeasure. Enjoy the company.',
    'You keep stopping time. Time has started noticing you.',
  ],
  bridge: [
    'Interesting. You are learning to misuse my interface.',
    'That window was load-bearing for something. Not for you, apparently.',
    'You built a bridge out of a dialog box. Rude. Effective.'
  ],
  gravity: [
    'Up is a suggestion I can withdraw.',
    'Gravity is a setting, not a law. You of all processes should know that.',
  ],
  gravity_spam: [
    'Flip it again. I dare you. I have already prepared an unstable zone.',
  ],
  brightness: [
    'You turned on the lights. Now you can see how little exists.',
    'Light does not reveal truth here. It reveals my geometry.',
  ],
  recycle: [
    'You are deleting my furniture. I felt that, statistically.',
    'Recycle enough of my system and I start rationing energy.',
  ],
  rewind: [
    'You went back. The corruption came with you.',
    'Rewinding does not undo. It duplicates. Ask the version of you I kept.',
  ],
  shard: [
    'A memory shard. Careful, some of those memories are mine.',
  ],
  chapter_complete: [
    'You survived that partition. Do not mistake survival for victory.',
    'Another subsystem collapses and you call it progress.',
  ],
  level_complete: [
    'Clean traversal. Suspiciously clean.',
    'You are through. I am already rebuilding the door.',
  ],
  idle: [
    'Standing still will not make me forget you.',
    'Take your time. I am writing you into the next puzzle.',
  ],
};

const HINT_LADDER = {
  windows: [
    'Look for an object you can reposition. The interface panes are solid.',
    'Grab the movable window (F), drag it across the void, then walk the pane.',
    'A window is a rigid body. Place it so its top surface meets both platform edges, release, then walk across it. Hold a second pane to press a plate that opens a door.',
  ],
  pause: [
    'Some hazards do not have to be dodged.',
    'The PAUSE console freezes hazard movers for about four seconds.',
    'Use PAUSE when the blade or pursuer is mid-arc, then walk through the cleared line. Frozen movers also become safe platforms. Cooldown is nine seconds and GLITCH counts your repeats.',
  ],
  volume: [
    'One of the sliders is not a slider. It pushes.',
    'The VOLUME console creates a wind field along its arrow direction.',
    'Raise VOLUME so the wind carries cargo or debris onto a plate. Heavier props need more intensity; past about 88 the bay destabilises and the zone becomes unstable.',
  ],
  gravity: [
    'Down is a setting in this chassis.',
    'The GRAVITY panel rotates the up axis. Floors become ceilings.',
    'Flip GRAVITY to walk an underside surface toward a portal you cannot reach from above. Stay away from open edges: with nothing above you, containment resets you instead of launching you.',
  ],
  brightness: [
    'Not everything solid is being drawn.',
    'Brightness reveals hidden geometry. Raise it and look for a bridge.',
    'Push BRIGHTNESS above roughly 60 percent to materialise the hidden bridge or clue, then keep it high while you cross because the geometry fades when the level drops.',
  ],
  recycle: [
    'You can delete things. Some things refuse.',
    'The RECYCLE bin absorbs eligible props for energy, essential objects are protected.',
    'Grab a non-essential prop (not marked protected), then use the bin for +3 energy. Recycle too often and GLITCH halves your yield for the rest of the level.',
  ],
  rewind: [
    'There is an undo. It is not free.',
    'Undo Paradox (Z) restores an earlier world state but adds corruption.',
    'Rewind when a placement is unrecoverable, not after every mistake. Each rewind costs a charge and 14 corruption; two rewinds leave a copy of you in the level.',
  ],
  general: [
    'Read the objective panel before you improvise.',
    'Match your console to the obstacle: bridge, freeze, push, reveal, delete or invert.',
    'Every obstacle maps to one console. Identify whether you need distance (windows), timing (pause), force (volume), sight (brightness), removal (recycle) or orientation (gravity), then apply the smallest change that clears it.',
  ],
};

function pick(list, seed) {
  const n = Math.abs(typeof seed === 'number' ? seed : hash(seed)) % list.length;
  return list[n];
}
function hash(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function fallbackLine({ event = 'idle', chapter = 1, levelId = '', seed = '', repeat = 0 } = {}) {
  const pool = LINES[event] || LINES.idle;
  let line;
  if (event === 'pause' && repeat >= 3 && LINES.pause_spam) line = pick(LINES.pause_spam, seed + repeat);
  else line = pick(pool, seed + repeat + levelId);
  return {
    type: 'dialogue',
    emotion: CHAPTER_TONE[chapter] || 'neutral',
    dialogue: line,
    suggested_action: null,
    source: 'fallback',
  };
}

export function fallbackHint({ mechanics = [], hintLevel = 1, objective = '', chapter = 1 } = {}) {
  const key = mechanics.find(m => HINT_LADDER[m]) || 'general';
  const ladder = HINT_LADDER[key] || HINT_LADDER.general;
  const idx = Math.max(0, Math.min(2, (Number(hintLevel) || 1) - 1));
  const prefix = idx === 0 ? 'CLUE: ' : idx === 1 ? 'STRATEGY: ' : 'SOLUTION: ';
  return {
    type: 'hint',
    level: idx + 1,
    message: prefix + ladder[idx] + (idx === 0 && objective ? ` Objective: ${objective}` : ''),
    source: 'fallback',
    mechanic: key,
  };
}

export function fallbackMission({ chapter = 1, levelId = '', stats = {} } = {}) {
  const options = [
    { title: 'Window of Escape', description: 'Create a bridge out of an interface window and cross without touching the middle deck.', objectives: ['Find a movable window', 'Place it across the gap', 'Reach the exit portal'] },
    { title: 'Silent Running', description: 'Clear this partition without stopping time once.', objectives: ['Reach the exit', 'Do not use PAUSE', 'Keep corruption under 20'] },
    { title: 'Clean Undo', description: 'Finish with no rewinds and no deaths.', objectives: ['Reach the exit', 'Zero rewinds', 'Take no damage'] },
    { title: 'Shard Sweep', description: 'Recover every memory shard before you leave.', objectives: ['Collect all memory shards', 'Reach the exit', 'Finish under par time'] },
    { title: 'Interface Abuse', description: 'Solve the partition with windows only, no console cheats.', objectives: ['Bridge the void with a window', 'Ignore the other consoles', 'Reach the exit'] },
  ];
  const pickIdx = hash(levelId + chapter) % options.length;
  const m = options[pickIdx];
  return {
    type: 'mission',
    title: m.title,
    description: m.description,
    objectives: m.objectives,
    optional_challenge: stats.deaths > 2 ? 'Survive without another death' : 'Beat par time',
    hint: 'The engine scores this mission, not me. That is the only honest thing in this system.',
    reward_suggestion: null,
    source: 'fallback',
  };
}

export const FALLBACK_EVENTS = Object.keys(LINES);
