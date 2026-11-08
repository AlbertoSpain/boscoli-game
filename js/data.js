'use strict';

const HEROES = [
  {
    id: 'gato', name: 'Michi', desc: 'Gatito valiente',
    ears: 'cat', tail: 'cat', stripes: true,
    body: '#ffa94d', belly: '#fff1d6', inner: '#ff9fb6', feet: '#e07b2a',
  },
  {
    id: 'conejo', name: 'Nube', desc: 'Conejita saltarina',
    ears: 'bunny', tail: 'puff',
    body: '#fff6fb', belly: '#ffd9ec', inner: '#ff9fc8', feet: '#f2b8d6',
  },
  {
    id: 'panda', name: 'Bambú', desc: 'Panda dormilón',
    ears: 'panda', tail: 'panda',
    body: '#ffffff', belly: '#f1f1f1', patch: '#3a3550', feet: '#3a3550',
  },
  {
    id: 'perro', name: 'Toby', desc: 'Perrito juguetón',
    ears: 'dog', tail: 'dog', muzzle: true,
    body: '#e3ad72', belly: '#fff0d9', inner: '#9a5f33', feet: '#9a5f33',
  },
];

const VILLAINS = {
  zorro: {
    name: 'Rufo', title: 'el Zorro Gruñón',
    ears: 'fox', tail: 'fox', muzzle: true,
    body: '#ff7b39', belly: '#fff3e6', inner: '#5a2a3a', feet: '#4a2a3a',
    taunts: ['¡Ja! ¡Nunca encontrarás mis palabras!', '¡Mis hechizos son los mejores!', '¡Grrr! ¡Qué rabia!'],
  },
  murcielago: {
    name: 'Murci', title: 'la Murciélaga Traviesa',
    ears: 'bat', wings: true,
    body: '#8a6bd1', belly: '#c9b6ff', inner: '#ff9fc8', feet: '#5b3f9e',
    taunts: ['¡Ji, ji! ¡Las palabras están a oscuras!', '¡Murci-magia!', '¡No me pillarás!'],
  },
  lobo: {
    name: 'Lobo Gruñón', title: 'el Rey de las Nubes',
    ears: 'fox', tail: 'fox', muzzle: true, crown: true,
    body: '#8e9ab8', belly: '#e8ecf6', inner: '#4a4466', feet: '#4a5070',
    taunts: ['¡Soy el rey de la magia!', '¡Auuuu! ¡Rendíos!', '¡Mi corona brilla más que tú!'],
  },
};

const THEMES = {
  forest: {
    sky: ['#7fd3ff', '#d6f6ff'], grass: '#5ed16a', grassDark: '#36a24a',
    dirt: '#c27c4a', dirtDark: '#9a5a33', brick: '#e0734f', brickDark: '#a84a33',
    hillFar: '#a3e48f', hillNear: '#6cc96b', cloud: '#ffffff', plat: '#c98a4b',
    blob: '#9b6bff', castle: '#f4a6c0',
  },
  cave: {
    sky: ['#231c4a', '#5b3f8f'], grass: '#b77cff', grassDark: '#8a4fd6',
    dirt: '#4a3a7a', dirtDark: '#352a5c', brick: '#6f5bb5', brickDark: '#4c3c8c',
    hillFar: '#3e3270', hillNear: '#55418f', cloud: '#7d6cc4', plat: '#8fd3ff',
    blob: '#4dd6a8', castle: '#8fd3ff', stars: true,
  },
  clouds: {
    sky: ['#ffb3d9', '#ffe8a8'], grass: '#ffffff', grassDark: '#d9defa',
    dirt: '#ffd1e8', dirtDark: '#f5b0d0', brick: '#ffcf5c', brickDark: '#e09a2b',
    hillFar: '#ffd9ec', hillNear: '#fff0f7', cloud: '#ffffff', plat: '#ffffff',
    blob: '#ff6f91', castle: '#c9b6ff', sun: true,
  },
};

// Operaciones de construcción de nivel. Filas: 0 arriba, 10-11 suelo.
// gap(x,w) · hill(x,w,h) · stairs(x,n,dir) · blocks(x,y,'B?') · plat(x,y,w)
// stars(x,y,n) · enemy(x) · check(x) · heart(x,y) · goal(x)
const LEVELS = [
  {
    name: 'Bosque Arcoíris', theme: 'forest', villain: 'zorro', music: 'forest', width: 125,
    story: [
      '¡Oh, no! Rufo, el Zorro Gruñón, ha escondido las palabras mágicas del bosque.',
      'Salta por las plataformas y recoge estrellas. ¡Cada estrella te da 1 segundo más en la batalla!',
    ],
    ops: [
      ['stars', 6, 8, 4],
      ['blocks', 12, 6, 'B?B?B'], ['stars', 13, 5, 3],
      ['enemy', 19],
      ['gap', 23, 2],
      ['stairs', 28, 3, 'up'], ['stairs', 31, 3, 'down'], ['stars', 29, 5, 4],
      ['enemy', 37],
      ['plat', 40, 7, 4], ['stars', 40, 6, 4],
      ['gap', 45, 3],
      ['check', 52],
      ['blocks', 56, 6, '?'], ['blocks', 60, 6, 'B?B'],
      ['enemy', 63], ['enemy', 67],
      ['hill', 71, 5, 2], ['stars', 71, 6, 5],
      ['gap', 77, 2],
      ['plat', 80, 7, 3], ['heart', 81, 6], ['plat', 84, 5, 3], ['stars', 84, 4, 3],
      ['enemy', 90],
      ['stairs', 95, 4, 'up'], ['gap', 99, 2], ['stairs', 101, 4, 'down'],
      ['stars', 106, 8, 5],
      ['enemy', 110],
      ['goal', 116],
    ],
  },
  {
    name: 'Cueva de Cristal', theme: 'cave', villain: 'murcielago', music: 'cave', width: 135,
    story: [
      'Murci, la Murciélaga Traviesa, ha apagado las luces de la Cueva de Cristal.',
      'Cuidado con los bichitos: ¡salta sobre su cabeza para que se vayan!',
    ],
    ops: [
      ['stars', 5, 8, 3],
      ['blocks', 10, 6, '?B?'],
      ['enemy', 15], ['enemy', 18],
      ['gap', 22, 4], ['plat', 23, 7, 2], ['stars', 23, 6, 2],
      ['hill', 29, 3, 1], ['hill', 32, 3, 2], ['hill', 35, 4, 3], ['stars', 35, 5, 4],
      ['gap', 39, 3],
      ['hill', 42, 4, 3], ['hill', 46, 3, 1],
      ['enemy', 50],
      ['check', 54],
      ['blocks', 58, 6, 'B?B?B?B'],
      ['enemy', 60], ['enemy', 63],
      ['gap', 68, 12], ['plat', 68, 7, 3], ['plat', 72, 5, 3], ['plat', 76, 7, 3],
      ['stars', 72, 4, 3], ['heart', 77, 6],
      ['check', 83],
      ['enemy', 88], ['enemy', 92],
      ['blocks', 95, 6, '???'],
      ['stairs', 100, 4, 'up'], ['gap', 104, 3], ['stairs', 107, 4, 'down'],
      ['stars', 112, 8, 4],
      ['enemy', 116], ['enemy', 119],
      ['goal', 126],
    ],
  },
  {
    name: 'Castillo de las Nubes', theme: 'clouds', villain: 'lobo', music: 'clouds', width: 148,
    story: [
      'El Lobo Gruñón se ha coronado Rey de las Nubes con todas las palabras mágicas.',
      '¡Es la última batalla! Sube por las nubes y devuélvele la alegría al Reino Cuqui.',
    ],
    ops: [
      ['stars', 5, 8, 3],
      ['gap', 10, 3],
      ['blocks', 16, 6, '?B?'],
      ['enemy', 20],
      ['gap', 23, 4], ['plat', 24, 7, 2],
      ['hill', 30, 4, 2], ['stars', 30, 6, 4],
      ['gap', 35, 3],
      ['check', 42],
      ['gap', 46, 16], ['plat', 46, 8, 3], ['plat', 50, 6, 3], ['plat', 54, 4, 3], ['plat', 58, 6, 3],
      ['stars', 54, 3, 3], ['stars', 50, 5, 3],
      ['enemy', 65], ['enemy', 68], ['enemy', 71],
      ['blocks', 74, 6, 'B?B?B'],
      ['check', 80],
      ['stairs', 84, 3, 'up'], ['hill', 87, 6, 3], ['enemy', 89], ['stairs', 93, 3, 'down'],
      ['gap', 97, 4], ['plat', 98, 7, 2], ['stars', 98, 6, 2],
      ['enemy', 104], ['enemy', 107],
      ['heart', 110, 7],
      ['gap', 113, 3],
      ['hill', 116, 3, 1], ['hill', 119, 3, 2], ['hill', 122, 3, 3],
      ['gap', 125, 2], ['hill', 127, 3, 3], ['stairs', 130, 3, 'down'],
      ['stars', 134, 8, 4],
      ['goal', 138],
    ],
  },
];

const WORD_POOLS = {
  forest: [
    ['ARBOL', '🌳'], ['FLOR', '🌸'], ['HOJA', '🍃'], ['SETA', '🍄'], ['RANA', '🐸'], ['SOL', '☀️'],
    ['ABEJA', '🐝'], ['OSO', '🐻'], ['PINO', '🌲'], ['FRESA', '🍓'], ['MIEL', '🍯'], ['CARACOL', '🐌'],
  ],
  cave: [
    ['LUNA', '🌙'], ['ESTRELLA', '⭐'], ['BUHO', '🦉'], ['NOCHE', '🌃'], ['GEMA', '💎'], ['CRISTAL', '🔮'],
    ['VELA', '🕯️'], ['ROCA', '🪨'], ['MAPA', '🗺️'], ['LLAVE', '🔑'], ['COFRE', '🧰'], ['TESORO', '💰'],
  ],
  clouds: [
    ['MAGIA', '✨'], ['VARITA', '🪄'], ['HADA', '🧚'], ['DRAGON', '🐉'], ['CORONA', '👑'], ['POCION', '🧪'],
    ['NUBE', '☁️'], ['ARCOIRIS', '🌈'], ['CASTILLO', '🏰'], ['HECHIZO', '💫'], ['RAYO', '⚡'], ['VIENTO', '🌬️'],
  ],
};

const DIFFICULTY = {
  peque: {
    label: 'Peque (6-7 años)', hearts: 5, dirs: 'hv',
    battles: [{ size: 7, words: 4, time: 150 }, { size: 8, words: 5, time: 170 }, { size: 8, words: 6, time: 190 }],
  },
  mayor: {
    label: 'Mayor (8-10 años)', hearts: 3, dirs: 'hvd',
    battles: [{ size: 8, words: 5, time: 120 }, { size: 9, words: 6, time: 140 }, { size: 10, words: 7, time: 160 }],
  },
};

const MAX_STAR_BONUS = 40;
