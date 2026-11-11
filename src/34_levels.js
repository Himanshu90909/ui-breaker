/* =====================================================================
   LEVEL DATA — 5 chapters, 15 story levels, boss, sandbox, daily
   ===================================================================== */
/* helper: platform by TOP surface */
const pl = (x, top, z, w, d, h = 0.7) => [x, top - h / 2, z, w, h, d];
const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);

const CHAPTERS = [
  { id: 1, name: 'BOOT SEQUENCE', sub: 'Wake up inside the machine.', color: '#25D9FF' },
  { id: 2, name: 'WINDOWS OF CHAOS', sub: 'The interface becomes structure.', color: '#8A5CFF' },
  { id: 3, name: 'SYSTEM FAILURE', sub: 'Every dial is a weapon.', color: '#FF6A24' },
  { id: 4, name: 'UNDO PARADOX', sub: 'Reverse what you broke.', color: '#7CFFB2' },
  { id: 5, name: 'ROOT ACCESS', sub: 'Confront the thing that watches.', color: '#FF3D5A' },
];

const LEVELS = [
  /* ---------------- CHAPTER 1 ---------------- */
  {
    id: '1-1', chapter: 1, name: 'COLD BOOT', par: 55,
    brief: 'You are awake inside NEXUS OS with no credentials and no exit. Move. Jump. Learn what a button does.',
    objective: 'Reach the exit portal on the upper deck.',
    spawn: [0, 1.4, 9], exit: [-3.5, 3.9, -10.5], gravity: 'down',
    platforms: [pl(0, 0, 8, 14, 8), pl(0, 0, -1, 11, 7), pl(5, 1.3, -5.5, 5, 4), pl(-2, 2.5, -10, 12, 8)],
    walls: [[0, 3, 12.5, 16, 6, 0.6], [0, 3, -14.5, 16, 6, 0.6]],
    consoles: { pause: [4.2, 0, 8.5] },
    movers: [[0, 0.45, -1, 4.5, 0.5, 0.5, { hazard: true, axis: 'x', range: 3.4, speed: 1.5 }]],
    shards: [[-4.5, 1, 7], [5.2, 2.3, -5.2], [-6, 3.4, -10.5]],
    hints: ['WASD / arrows to move · SPACE to jump', 'The orange console freezes the simulation. Press E beside it.', 'Frozen obstacles stay frozen for four seconds. Time it.'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }],
  },
  {
    id: '1-2', chapter: 1, name: 'INPUT LAG', par: 70,
    brief: 'Physical UI objects are lying around. A window is a surface you can move.',
    objective: 'Use the floating window to climb the ledge, press the plate, and reach the exit.',
    spawn: [0, 1.4, 9], exit: [4.5, 1.4, -11], gravity: 'down',
    platforms: [pl(0, 0, 8, 13, 8), pl(0, 0, -1, 12, 7), pl(-4, 2.4, -7, 7, 5), pl(4.5, 0, -11, 8, 6)],
    walls: [[-9.5, 3, -2, 0.6, 6, 14]],
    windows: [[1, 1.1, 3.5, 3, 1.4], [-2, 1.1, 0.5, 3, 1.4]],
    plates: [[-4, 2.62, -7, { id: 'p1' }]],
    doors: [[4.5, 2.2, -7.6, 3, 4, { id: 'd1', plate: 'p1' }]],
    shards: [[-5.5, 1.2, 10], [-4, 3.6, -7], [6, 1.2, -12]],
    hints: ['Hold LEFT CLICK on a window title bar to drag it', 'Place a window on the orange plate to open the door', 'R rotates · [ and ] resize'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }, { id: 'plate', text: 'Open the security door with the plate' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'norewind', text: 'No rewinds' }],
  },
  {
    id: '1-3', chapter: 1, name: 'SAFE MODE', par: 75,
    brief: 'Moving geometry. Some of it will hit you. Read the pattern before you commit.',
    objective: 'Cross the moving decks and reach the exit.',
    spawn: [0, 1.4, 10], exit: [0, 4.6, -14], gravity: 'down',
    platforms: [pl(0, 0, 10, 10, 6), pl(0, 0, 3, 8, 5), pl(-6, 1.6, -3, 6, 5), pl(0, 1.6, -8, 6, 5), pl(0, 3.4, -13, 10, 6)],
    movers: [
      [0, 1.15, 5.6, 4, 0.5, 4, { axis: 'x', range: 3.2, speed: 1.2 }],
      [-3, 2.8, -2, 4, 0.5, 3, { axis: 'z', range: 2.4, speed: 0.9 }],
      [0, 0.4, -4, 1.2, 3, 1.2, { hazard: true, axis: 'y', range: 1.6, speed: 1.6 }],
      [3, 1.9, -8, 1.2, 3, 1.2, { hazard: true, axis: 'y', range: 1.4, speed: 1.3, phase: 1.2 }],
    ],
    consoles: { pause: [3.5, 0, 10] },
    shards: [[0, 1.4, 2], [-6, 3, -3], [0, 5, -14]],
    hints: ['Moving decks carry you if you stand on them', 'A paused world still carries you'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }],
    optional: [{ id: 'nodamage', text: 'Take no damage' }, { id: 'shards', text: 'Recover all 3 memory shards' }],
  },

  /* ---------------- CHAPTER 2 ---------------- */
  {
    id: '2-1', chapter: 2, name: 'DRAG & DROP', par: 85,
    brief: 'There is no bridge. There is a window. Same thing if you are brave.',
    objective: 'Bridge the void with windows and reach the far platform.',
    spawn: [0, 1.4, 11], exit: [0, 4.6, -15], gravity: 'down',
    platforms: [pl(0, 0, 11, 10, 6), pl(0, 0, 5.5, 6, 4), pl(0, 2.2, -6, 8, 6), pl(0, 3.2, -15, 10, 6), pl(-7, 0.4, -2, 5, 5)],
    windows: [[-1, 1.1, 1, 3, 1.4], [2, 1.1, 1, 3, 1.4, { essential: true }]],
    plates: [[0, 2.27, -6, { id: 'p1' }]],
    doors: [[0, 4.4, -8.6, 3.4, 4.4, { id: 'd1', plate: 'p1' }]],
    movers: [[0, 0.4, -1.5, 2, 2, 2, { hazard: true, axis: 'x', range: 2.2, speed: 1.1 }]],
    shards: [[-7, 1.4, -2], [0, 4.6, -15], [3.5, 2.4, -5]],
    hints: ['Two windows: one is a protected system object (you cannot recycle it)', 'Drag a window into the gap, then walk across it'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }, { id: 'plate', text: 'Hold the plate with a window' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'time', text: 'Finish under 70 seconds' }],
  },
  {
    id: '2-2', chapter: 2, name: 'RESIZE', par: 95,
    brief: 'A window is only as useful as its dimensions. Resize it until the gap gives up.',
    objective: 'Resize a window to span the wide gap and shield yourself from the sentry.',
    spawn: [0, 1.4, 12], exit: [0, 1.4, -10], gravity: 'down',
    platforms: [pl(0, 0, 12, 10, 6), pl(0, 0, 6, 5, 4), pl(0, 0, -8, 9, 6), pl(-4, 2.6, -8, 4, 3)],
    windows: [[0, 1.15, 3, 3, 1.3]],
    turrets: [[6, 1.25, 6, [-1, 0, 0], { rate: 2.0, delay: 1 }]],
    movers: [[-4.4, 0.4, 9, 2, 2, 2, { hazard: true, axis: 'z', range: 2.6, speed: 1.3 }]],
    shards: [[-4, 3.8, -8], [0, 1.2, -8], [0, 1.4, 6]],
    hints: ['Wheel or [ ] resizes the held window', 'Place a window between you and the sentry — projectiles die on glass'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }, { id: 'shield', text: 'Block a sentry shot with a window' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'nodamage', text: 'Take no damage' }],
  },
  {
    id: '2-3', chapter: 2, name: 'STACK', par: 105,
    brief: 'One window is a step. Three windows are a staircase. The sentry hates stairs.',
    objective: 'Stack windows to reach the beam relay, then break the beam to open the exit.',
    spawn: [0, 1.4, 12], exit: [8, 6.6, -11], gravity: 'down',
    platforms: [pl(0, 0, 12, 12, 8), pl(0, 0.2, 5, 8, 5), pl(-1, 4.4, -2, 9, 7), pl(8, 5.2, -10, 8, 6), pl(4, 1.2, -6, 4, 4)],
    windows: [[-3, 1.1, 8, 3.2, 1.2], [-1, 1.1, 9.4, 3.2, 1.2], [2, 1.1, 8, 3.2, 1.2]],
    beams: [[-4, 5.6, -2, 2.5, 5.6, -2, {}]],
    doors: [[8, 7.4, -6.8, 6.5, 4.6, { id: 'beamdoor', require: 'beam' }]],
    movers: [[0, 3, 0, 5, 0.4, 1, { hazard: true, axis: 'x', range: 3, speed: 1.4 }]],
    shards: [[2, 1.2, 11], [-1, 5.6, -2], [8, 7.8, -11]],
    hints: ['A window blocks the red beam', 'What you stack can also crush you — watch the sweeper'],
    objectives: [{ id: 'exit', text: 'Break the beam and reach the exit' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'norewind', text: 'No rewinds' }],
  },

  /* ---------------- CHAPTER 3 ---------------- */
  {
    id: '3-1', chapter: 3, name: 'SUSPEND', par: 80,
    brief: 'The pause button is not a convenience. It is a bridge made of stopped time.',
    objective: 'Freeze the rotating hazard field and cross to the exit.',
    spawn: [0, 1.4, 12], exit: [0, 1.4, -14], gravity: 'down',
    platforms: [pl(0, 0, 12, 9, 5), pl(0, 0, 5, 9, 5), pl(0, 0, -5, 9, 5), pl(0, 0, -13, 9, 5), pl(4.4, 0, 8.5, 3, 3)],
    consoles: { pause: [4.4, 0, 9] },
    movers: [
      [0, 0.5, 0, 8, 0.6, 0.6, { hazard: true, axis: 'x', range: 3.6, speed: 2.2 }],
      [0, 1.5, -5, 8, 0.6, 0.6, { hazard: true, axis: 'x', range: 3.6, speed: 2.8, phase: 1.1 }],
      [0, 0.4, -9, 8, 0.6, 0.6, { hazard: true, axis: 'x', range: 3.6, speed: 1.8, phase: 2.2 }],
    ],
    shards: [[0, 1.2, 12], [-3, 1.2, 5], [3, 1.2, -13]],
    hints: ['Pause is a resource: 4.2 seconds active, 9 seconds cooldown', 'GLITCH learns. Use pause three times and obstacles start resisting'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'time', text: 'Finish under 60 seconds' }],
  },
  {
    id: '3-2', chapter: 3, name: 'AMPLIFICATION', par: 95,
    brief: 'Volume is wind. Push the cargo onto the plate without blowing it off the map.',
    objective: 'Use the volume console to blow the cargo blocks onto the pressure plate, then cross.',
    spawn: [0, 1.4, 13], exit: [-4, 1.4, -9], gravity: 'down',
    platforms: [pl(0, 0, 12.5, 12, 7), pl(0, 0, 3, 16, 12), pl(-4, 0, -8, 10, 6)],
    consoles: { volume: [5.4, 0, 12.5] },
    props: [[-4, 0.6, 5.5], [-3.2, 0.6, 6.6]],
    plates: [[-4, 0.08, -1.05, { id: 'p1' }]],
    walls: [[-4, 0.28, -1.7, 10, 0.56, 0.4]],
    doors: [[-4, 2.5, -4.2, 5.4, 4.6, { id: 'd1', plate: 'p1' }]],
    wind: [[-4, 1.4, 3, 17, 7, 13, [0, 0, -1], { max: 30 }]],
    shards: [[5, 1.2, 12.5], [-4, 1.2, 3], [5, 1.2, 3]],
    hints: ['The volume slider blows air across the whole bay', 'Above 88% the environment destabilises — GLITCH notices'],
    objectives: [{ id: 'exit', text: 'Open the door and reach the exit' }, { id: 'plate', text: 'Load the pressure plate' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'nodamage', text: 'Take no damage' }],
  },
  {
    id: '3-3', chapter: 3, name: 'CONTRAST', par: 110,
    brief: 'Half of this room does not exist at normal brightness. The rest only exists upside down.',
    objective: 'Reveal the hidden bridge with brightness, then invert gravity to reach the ceiling exit.',
    spawn: [0, 1.4, 14], exit: [0, 8.9, -9], gravity: 'down',
    platforms: [pl(0, 0, 14, 12, 6), pl(0, 0, 6, 8, 5), pl(-7, 0, -2, 6, 6), pl(7, 0, -2, 6, 6), pl(0, 10.4, -4, 15, 17)],
    hidden: [[0, 0.05, -2, 6, 0.6, 8]],
    consoles: { brightness: [3.8, 0, 14], gravity: [-3.8, 0, 14] },
    clues: [[0, 3.2, 6, 'UP IS A CHOICE', { threshold: 74 }], [-7, 2.4, -2, 'LIGHT = TRUTH', { threshold: 80 }]],
    shards: [[-7, 1.2, -2], [7, 1.2, -2], [0, 8.9, -9]],
    hints: ['Brightness reveals platforms that are not there… yet', 'Gravity can be up. The ceiling becomes a floor after that'],
    objectives: [{ id: 'exit', text: 'Reach the portal under the ceiling' }, { id: 'reveal', text: 'Reveal the hidden bridge' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'norewind', text: 'No rewinds' }],
  },

  /* ---------------- CHAPTER 4 ---------------- */
  {
    id: '4-1', chapter: 4, name: 'ROLLBACK', par: 95,
    brief: 'You will make a mistake here. NEXUS OS can take it back, at a price in corruption.',
    objective: 'Cross the collapsing bridge and reach the exit. Rewind if you fall short.',
    spawn: [0, 1.4, 12], exit: [0, 4.6, -14], gravity: 'down',
    platforms: [pl(0, 0, 12, 10, 6), pl(0, 0, 6, 6, 4), pl(-1, 1.2, -1, 4, 4), pl(0, 2.6, -8, 5, 4), pl(0, 3.2, -14, 10, 6)],
    movers: [
      [0, 2.6, -8, 5, 0.4, 4, { axis: 'x', range: 2.6, speed: 1.6 }],
      [-1, 0.4, -2, 1.4, 3.4, 1.4, { hazard: true, axis: 'y', range: 1.4, speed: 2.1 }],
    ],
    windows: [[2.5, 1.2, 6, 3, 1.2]],
    consoles: { pause: [-3.5, 0, 12] },
    shards: [[0, 1.2, 12], [-1, 2.4, -1], [0, 4.6, -14]],
    hints: ['Z rewinds your last eligible interaction and restores world state', 'Each rewind adds corruption. Corruption invites worse things'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'maxrewinds', text: 'Use at most 1 rewind' }],
  },
  {
    id: '4-2', chapter: 4, name: 'PARADOX BAY', par: 120,
    brief: 'The verification gate only trusts windows that are exactly where they started. Move them to solve, then take it all back.',
    objective: 'Cross the bay, then return all three windows to their home positions to unlock the exit.',
    spawn: [0, 1.4, 14], exit: [0, 1.4, -4], gravity: 'down',
    platforms: [pl(0, 0, 14, 10, 6), pl(0, 0, 7, 6, 4), pl(-7, 0, 0, 6, 6), pl(0, 0, -4, 14, 8), pl(7, 0, 0, 6, 6)],
    movers: [[0, 1.8, 9.5, 4, 0.5, 4, { axis: 'x', range: 2, speed: 1.1 }]],
    windows: [[-7, 2.4, 1, 3, 1.2], [0, 2.4, -3, 3, 1.2], [7, 2.4, 1, 3, 1.2]],
    resetGate: { ids: [0, 1, 2], tol: 0.7, door: 'd1' },
    doors: [[0, 2.2, -1.6, 4.4, 4.4, { id: 'd1', locked: true }]],
    shards: [[-7, 1.2, 0], [0, 1.2, -4], [7, 1.2, 0]],
    hints: ['Three rewinds per level. This room is designed around exactly three.', 'The gate re-arms the moment a window leaves home'],
    objectives: [{ id: 'exit', text: 'Unlock the verification gate and exit' }, { id: 'reset', text: 'Return all windows to home position' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }],
  },
  {
    id: '4-3', chapter: 4, name: 'ENTROPY', par: 135,
    brief: 'Gravity, glass and stopped time in one room. GLITCH is already taking notes.',
    objective: 'Combine gravity, windows and pause to reach the kernel spire.',
    spawn: [0, 1.4, 14], exit: [10, 11.6, -10], gravity: 'down',
    platforms: [
      pl(0, 0, 14, 10, 6), pl(0, 0, 6, 8, 5), pl(-6, 2, 0, 6, 5), pl(0, 6, -2, 10, 6),
      pl(8, 6, -7, 6, 5), pl(10, 10.2, -10, 8, 6), pl(-8, 6, -8, 5, 5),
    ],
    consoles: { gravity: [3.5, 0, 14], pause: [-3.5, 0, 14] },
    windows: [[-2, 1.2, 3, 3.4, 1.2], [4, 1.2, 3, 3.4, 1.2]],
    movers: [
      [0, 3, 3, 4, 0.5, 3, { axis: 'y', range: 2.2, speed: 1.2 }],
      [4, 7, -4, 6, 0.5, 1, { hazard: true, axis: 'x', range: 2.4, speed: 1.9 }],
      [10, 8, -8, 1.2, 4, 1.2, { hazard: true, axis: 'y', range: 1.8, speed: 1.5 }],
    ],
    beams: [[-8, 7.4, -8, -8, 9.2, -8, {}]],
    shards: [[-6, 3.2, 0], [8, 7.2, -7], [10, 11.4, -10]],
    hints: ['Stacked windows trip GLITCH countermeasures', 'Pause holds a moving deck exactly where you need it'],
    objectives: [{ id: 'exit', text: 'Reach the kernel spire portal' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'time', text: 'Finish under 110 seconds' }],
  },

  /* ---------------- CHAPTER 5 ---------------- */
  {
    id: '5-1', chapter: 5, name: 'KERNEL PANIC', par: 140,
    brief: 'Everything at once. The system is no longer pretending to be stable.',
    objective: 'Traverse the failing kernel and reach the final gate.',
    spawn: [0, 1.4, 15], exit: [0, 9.4, -16], gravity: 'down',
    platforms: [
      pl(0, 0, 15, 10, 6), pl(0, 0, 8, 7, 5), pl(-7, 1.6, 2, 6, 5), pl(0, 3.2, -3, 7, 5),
      pl(7, 4.4, -6, 6, 5), pl(0, 6, -11, 8, 5), pl(0, 8, -16, 10, 6),
    ],
    consoles: { pause: [3.5, 0, 15], gravity: [-3.5, 0, 15], brightness: [0, 0, 10.5] },
    hidden: [[0, 4.8, -7, 4, 0.6, 6], [-4, 6.2, -11, 4, 0.6, 3]],
    windows: [[-2, 1.2, 5, 3, 1.2], [2, 1.2, 5, 3, 1.2]],
    movers: [
      [0, 0.4, 11, 6, 0.5, 0.5, { hazard: true, axis: 'x', range: 2.6, speed: 2.4 }],
      [-7, 3.2, 2, 5, 0.4, 4, { axis: 'z', range: 1.6, speed: 1.4 }],
      [7, 6, -6, 5, 0.5, 0.5, { hazard: true, axis: 'z', range: 2, speed: 2.6 }],
    ],
    turrets: [[0, 7, -13.5, [0, 0, 1], { rate: 2.0, delay: 1.5 }]],
    beams: [[-3, 8.6, -16, 3, 8.6, -16, {}]],
    shards: [[-7, 2.8, 2], [7, 5.6, -6], [0, 10.2, -16]],
    hints: ['Brightness reveals the missing floors in the kernel', 'Everything you learned is required here'],
    objectives: [{ id: 'exit', text: 'Reach the final gate' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'nodamage', text: 'Take no damage' }],
  },
  {
    id: '5-2', chapter: 5, name: 'FIREWALL', par: 150,
    brief: 'Two sentries, one narrow bridge, one very small window of opportunity.',
    objective: 'Cross the firewall with a glass shield and open the root gate.',
    spawn: [0, 1.4, 15], exit: [0, 1.6, -17], gravity: 'down',
    platforms: [pl(0, 0, 15, 10, 6), pl(0, 0, 8, 5, 5), pl(0, 0, -1, 5, 6), pl(0, 0, -9, 8, 6), pl(6.5, 0, -9, 5, 5), pl(-5, 0, -9, 4, 4), pl(0, 0.2, -17, 10, 7)],
    windows: [[0, 2.2, 11, 3.6, 1.4], [0, 2.2, 3, 3.6, 1.4]],
    turrets: [[-5, 1.6, 6, [1, 0, 0], { rate: 1.9, delay: 0.8 }], [5, 1.6, -4, [-1, 0, 0], { rate: 1.7, delay: 2 }]],
    plates: [[0, 0.3, -9, { id: 'p1' }], [6, 0.3, -9, { id: 'p2' }]],
    doors: [[0, 3.2, -13.4, 4, 6, { id: 'd1', require: 'allplates' }]],
    consoles: { bin: [-4, 0, 15], pause: [4, 0, 15] },
    props: [[6.5, 0.6, -6.5], [-3, 0.6, -6.5]],
    shards: [[0, 1.2, 8], [0, 1.2, -9], [0, 1.4, -17]],
    hints: ['The root gate needs every plate held at once', 'Recycle a blocking crate for energy — but not an essential one'],
    objectives: [{ id: 'exit', text: 'Reach the root gate portal' }, { id: 'plate', text: 'Hold both plates simultaneously' }],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }, { id: 'nodamage', text: 'Take no damage' }],
  },
  {
    id: '5-3', chapter: 5, name: 'ROOT ACCESS', par: 240, boss: true,
    brief: 'GLITCH has no health bar. It has a structure, and structures can be rearranged.',
    objective: 'Survive, redirect, invert, freeze and undo your way into the system core.',
    spawn: [0, 1.4, 16], exit: null, gravity: 'down',
    platforms: [
      pl(0, 0, 14, 14, 8), pl(-9, 0, 4, 6, 8), pl(9, 0, 4, 6, 8),
      pl(0, 0, 4, 8, 6), pl(0, 7.5, 4, 8, 6), pl(0, 0, -6, 16, 8), pl(0, 0, -16, 14, 8),
    ],
    walls: [[0, 5, 20, 24, 10, 0.6], [-13, 5, 0, 0.6, 10, 26], [13, 5, 0, 0.6, 10, 26]],
    consoles: { pause: [-4, 0, 15], gravity: [4, 0, 15] },
    windows: [[-2, 2.2, 10, 3.4, 1.3], [2, 2.2, 10, 3.4, 1.3]],
    movers: [
      [0, 2.2, 0, 6, 0.5, 0.5, { hazard: true, axis: 'x', range: 4, speed: 2.6 }],
      [-6, 0.4, -6, 1.4, 4, 1.4, { hazard: true, axis: 'y', range: 2, speed: 1.8 }],
      [6, 0.4, -6, 1.4, 4, 1.4, { hazard: true, axis: 'y', range: 2, speed: 1.8, phase: 1.4 }],
    ],
    glitchCore: [0, 3.4, -16.5],
    shards: [[-9, 1.2, 4], [9, 1.2, 4], [0, 1.2, -16]],
    bossData: {
      nodePositions: [[-9, 1.2, 4], [9, 1.2, 4]],
      surviveTime: 18,
      neededRedirects: 3,
    },
    hints: ['GLITCH is watching: every repeated trick makes it stronger', 'Windows redirect its attacks. Pause buys you time. Undo forgives'],
    objectives: [
      { id: 's1', text: 'Stage 1 · Survive the corrupted platform cycle' },
      { id: 's2', text: 'Stage 2 · Redirect three GLITCH attacks with windows' },
      { id: 's3', text: 'Stage 3 · Invert gravity and reach both system nodes' },
      { id: 's4', text: 'Stage 4 · Freeze the purge and undo what it breaks' },
      { id: 's5', text: 'Stage 5 · Reach the core and execute the escape' },
    ],
    optional: [{ id: 'shards', text: 'Recover all 3 memory shards' }],
  },
];

/* ---------------- SANDBOX ---------------- */
const SANDBOX_LEVEL = {
  id: 'sandbox', chapter: 0, name: 'SANDBOX', par: 0, sandbox: true,
  brief: 'Nothing here can kill you permanently. Build, break, and learn how the interface pushes back.',
  objective: 'Experiment freely. Step into the portal when you are done.',
  spawn: [0, 1.4, 10], exit: [0, 1.4, -18], gravity: 'down',
  platforms: [
    pl(0, 0, 10, 18, 10), pl(0, 0, -2, 18, 10), pl(0, 0, -14, 18, 10),
    pl(-10, 2, -2, 5, 8), pl(10, 2, -2, 5, 8), pl(0, 4, -8, 6, 5),
  ],
  consoles: { pause: [-5, 0, 10], gravity: [5, 0, 10], brightness: [-7, 0, 12], volume: [7, 0, 12], bin: [0, 0, 14] },
  windows: [[-3, 2, 4, 4, 1.6], [0, 2, 4, 4, 1.6], [3, 2, 4, 4, 1.6]],
  props: [[-2, 0.6, 8], [0, 0.6, 8], [2, 0.6, 8]],
  hidden: [[0, 3.2, -2, 5, 0.6, 4]],
  wind: [[0, 1.2, 4, 18, 5, 8, [0, 0, -1], { max: 26 }]],
  shards: [], hints: ['Try dragging a window mid-air while it holds you up', 'Drop a crate into the bin to recharge energy'],
  objectives: [{ id: 'exit', text: 'Leave through the portal whenever you like' }],
  optional: [],
};

/* ---------------- DAILY GLITCH GENERATOR ---------------- */
function makeDailyLevel(dateStr) {
  const seed = hashStr('GLITCH-' + dateStr);
  const rnd = mulberry32(seed);
  const platforms = [pl(0, 0, 12, 12, 8)];
  /* 7-stage descending path, must stay solvable with the given tools */
  const path = [];
  let x = 0, y = 0, z = 6;
  for (let i = 0; i < 7; i++) {
    z -= 5 + Math.round(rnd() * 1.6);
    x += (rnd() - 0.5) * 7;
    y = clamp(y + (rnd() < 0.45 ? 1.4 : (rnd() < 0.5 ? -0.7 : 0)), 0, 6.5);
    const w = 4 + Math.round(rnd() * 3), d = 4 + Math.round(rnd() * 2);
    platforms.push(pl(x, y, z, w, d));
    path.push([x, y, z]);
  }
  const exitAt = path[path.length - 1];
  const windows = [];
  for (let i = 0; i < 2; i++) windows.push([path[1][0] + (i ? 2.2 : -2.2), path[1][1] + 1.8, path[1][2] + 2, 3.2, 1.3]);
  const shards = path.filter((_, i) => i % 2 === 0).map(p => [p[0], p[1] + 1.2, p[2]]).slice(0, 3);
  const movers = [];
  for (let i = 1; i < path.length - 1; i += 2) {
    const p = path[i];
    movers.push([p[0], p[1] + 0.5, p[2], 5, 0.45, 0.45, { hazard: true, axis: 'x', range: 2.4, speed: 1.2 + rnd() * 1.4 }]);
  }
  if (movers.length < 2) movers.push([path[2][0], path[2][1] + 0.5, path[2][2], 5, 0.45, 0.45, { hazard: true, axis: 'z', range: 2.4, speed: 1.6 }]);
  return {
    id: 'daily', chapter: 0, name: 'DAILY GLITCH · ' + dateStr, par: 110 + Math.round(rnd() * 40),
    daily: true, seed,
    brief: 'A daily corrupted layout. Same seed for every operative, everywhere, today only.',
    objective: 'Reach the exit portal at the end of the corrupted path.',
    spawn: [0, 1.4, 12], exit: [exitAt[0], exitAt[1] + 1.4, exitAt[2]], gravity: 'down',
    platforms, windows, shards, movers,
    consoles: { pause: [-4, 0, 12], brightness: [4, 0, 12] },
    hidden: [[(path[3][0] + path[4][0]) / 2, path[3][1], (path[3][2] + path[4][2]) / 2, 4, 0.6, 5]],
    hints: ['Everyone faces this exact layout today', 'Pause and reveal are your tools for the gaps'],
    objectives: [{ id: 'exit', text: 'Reach the exit portal' }],
    optional: [{ id: 'shards', text: 'Recover all memory shards' }],
  };
}

const ALL_STORY = LEVELS;
function levelsInChapter(ch) { return LEVELS.filter(l => l.chapter === ch); }
function levelById(id) {
  if (id === 'sandbox') return SANDBOX_LEVEL;
  return LEVELS.find(l => l.id === id) || null;
}
function nextLevelId(id) {
  const i = LEVELS.findIndex(l => l.id === id);
  if (i < 0 || i >= LEVELS.length - 1) return null;
  return LEVELS[i + 1].id;
}
function chapterUnlocked(ch) {
  if (ch === 1) return true;
  const prev = levelsInChapter(ch - 1);
  return prev.every(l => Save.level(l.id)?.cleared);
}
function levelUnlocked(level) {
  if (!chapterUnlocked(level.chapter)) return false;
  const inCh = levelsInChapter(level.chapter);
  const idx = inCh.findIndex(l => l.id === level.id);
  if (idx === 0) return true;
  return !!Save.level(inCh[idx - 1].id)?.cleared;
}
