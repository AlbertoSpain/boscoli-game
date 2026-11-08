'use strict';

const Game = {
  canvas: null,
  ctx: null,
  state: 'title',
  t: 0,
  heroIndex: 0,
  difficulty: 'peque',
  hero: HEROES[0],
  heroFrames: null,
  level: null,
  battle: null,
  levelIndex: 0,
  totalStars: 0,
  paused: false,
  input: { left: false, right: false, jumpHeld: false, jumpPressed: false },
  held: new Set(),
  pressed: new Set(),

  init() {
    this.canvas = document.getElementById('screen');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.portraits = HEROES.map(h => Sprites.animalFrames(h));
    this.villainPortraits = Object.fromEntries(Object.entries(VILLAINS).map(([k, v]) => [k, {
      evil: Sprites.animalFrames(v, true),
      good: Sprites.animalFrames(v, false),
    }]));
    this.titleTiles = Sprites.tileset(THEMES.forest);
    this.confetti = [];

    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup', e => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousedown', () => Sound.init());
    this.resize();
    Sound.playMusic('title');

    let last = performance.now();
    let acc = 0;
    const step = 1000 / 60;
    const frame = now => {
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= step) {
        this.update();
        this.pressed.clear();
        acc -= step;
      }
      this.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  resize() {
    const s = Math.min(window.innerWidth / 960, window.innerHeight / 540) * 0.95;
    document.getElementById('game').style.transform = `translate(-50%, -50%) scale(${s})`;
  },

  onKeyDown(e) {
    Sound.init();
    const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'];
    if (block.includes(e.code)) e.preventDefault();

    if (e.code === 'KeyM') {
      Sound.toggleMute();
      return;
    }
    if (this.state === 'battle' && this.battle) {
      const isAction = e.code === 'Space' || e.code === 'Enter';
      if (!(isAction && e.repeat)) this.battle.onKey(e.code);
      return;
    }
    if (!e.repeat) this.pressed.add(e.code);
    this.held.add(e.code);
  },

  anyPressed(...codes) {
    return codes.some(c => this.pressed.has(c));
  },

  setState(state) {
    this.state = state;
    this.t = 0;
  },

  // ---------- Flujo del juego ----------
  startGame() {
    this.hero = HEROES[this.heroIndex];
    this.heroFrames = this.portraits[this.heroIndex];
    this.totalStars = 0;
    this.goToStory(0);
  },

  goToStory(index) {
    this.levelIndex = index;
    this.setState('story');
    Sound.playMusic('title');
  },

  startLevel() {
    this.level = new Platformer(this, this.levelIndex);
    this.paused = false;
    this.setState('level');
    Sound.playMusic(LEVELS[this.levelIndex].music);
  },

  startBattle(index, starBonus) {
    if (this.battle) this.battle.destroy();
    this.battle = new Battle(this, index, starBonus);
    this.setState('battle');
  },

  retryBattle(index, starBonus) {
    this.startBattle(index, starBonus);
  },

  battleWon(index) {
    this.battle.destroy();
    this.battle = null;
    if (index + 1 < LEVELS.length) {
      this.goToStory(index + 1);
    } else {
      this.setState('ending');
      Sound.playMusic('victory');
    }
  },

  // ---------- Actualización ----------
  update() {
    this.t++;
    switch (this.state) {
      case 'title': this.updateTitle(); break;
      case 'story':
        if (this.t > 20 && this.anyPressed('Enter', 'Space')) { Sound.play('select'); this.startLevel(); }
        break;
      case 'level': this.updateLevel(); break;
      case 'battle': this.battle.update(); break;
      case 'ending': this.updateEnding(); break;
    }
  },

  updateTitle() {
    if (this.anyPressed('ArrowLeft', 'KeyA')) { this.heroIndex = (this.heroIndex + HEROES.length - 1) % HEROES.length; Sound.play('select'); }
    if (this.anyPressed('ArrowRight', 'KeyD')) { this.heroIndex = (this.heroIndex + 1) % HEROES.length; Sound.play('select'); }
    if (this.anyPressed('ArrowUp', 'ArrowDown', 'KeyW', 'KeyS')) {
      this.difficulty = this.difficulty === 'peque' ? 'mayor' : 'peque';
      Sound.play('select');
    }
    if (this.anyPressed('Enter', 'Space')) { Sound.play('checkpoint'); this.startGame(); }
  },

  updateLevel() {
    if (this.anyPressed('KeyP', 'Escape')) this.paused = !this.paused;
    if (this.paused) return;
    const h = this.held;
    this.input.left = h.has('ArrowLeft') || h.has('KeyA');
    this.input.right = h.has('ArrowRight') || h.has('KeyD');
    this.input.jumpHeld = h.has('ArrowUp') || h.has('KeyW') || h.has('Space');
    this.input.jumpPressed = this.anyPressed('ArrowUp', 'KeyW', 'Space');
    this.level.update(this.input);
    if (this.level.done) {
      this.totalStars += this.level.stars;
      this.startBattle(this.levelIndex, this.level.stars);
    }
  },

  updateEnding() {
    if (this.t % 3 === 0) {
      this.confetti.push({ x: Math.random() * 960, y: -10, vy: 2 + Math.random() * 2, vx: Math.random() - 0.5, c: WORD_COLORS[Math.floor(Math.random() * WORD_COLORS.length)], r: Math.random() * 6 });
    }
    this.confetti.forEach(c => { c.x += c.vx; c.y += c.vy; c.r += 0.1; });
    this.confetti = this.confetti.filter(c => c.y < 560);
    if (this.t > 120 && this.anyPressed('Enter', 'Space')) {
      this.confetti = [];
      this.setState('title');
      Sound.playMusic('title');
    }
  },

  // ---------- Dibujo ----------
  draw() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    switch (this.state) {
      case 'title': this.drawTitle(ctx); break;
      case 'story': this.drawStory(ctx); break;
      case 'level':
        this.level.draw(ctx);
        if (this.paused) {
          ctx.fillStyle = 'rgba(43,29,58,0.6)';
          ctx.fillRect(0, 0, 960, 540);
          UI.text(ctx, 'PAUSA', 480, 230, { size: 40, align: 'center' });
          UI.text(ctx, 'Pulsa P para seguir', 480, 300, { size: 14, align: 'center' });
        }
        break;
      case 'battle': this.battle.draw(ctx); break;
      case 'ending': this.drawEnding(ctx); break;
    }
    if (Sound.isMuted()) UI.text(ctx, '🔇', 940, 516, { size: 14, align: 'right', shadow: null });
  },

  drawScenery(ctx, theme, tiles) {
    UI.sky(ctx, theme, 960, 540, this.t);
    for (let i = 0; i < 4; i++) {
      const x = ((i * 300 - this.t * 0.4) % 1200 + 1200) % 1200 - 150;
      UI.sprite(ctx, tiles.cloud, x, 40 + (i % 2) * 70, 3);
    }
    UI.sprite(ctx, tiles.hillFar, -40, 540 - 56 * 3 - 40, 3);
    UI.sprite(ctx, tiles.hillFar, 560, 540 - 56 * 3 - 40, 3);
    UI.sprite(ctx, tiles.hillNear, 300, 540 - 40 * 3 - 40, 3);
    for (let x = 0; x < 960; x += 48) {
      UI.sprite(ctx, tiles.grass, x, 492, 3);
    }
  },

  drawTitle(ctx) {
    this.drawScenery(ctx, THEMES.forest, this.titleTiles);

    const title = 'BOSCOLI';
    const colors = ['#ff5c8a', '#ff922b', '#ffd23f', '#51cf66', '#4dabf7', '#9775fa', '#ff6f91'];
    ctx.font = `64px ${FONT}`;
    const total = ctx.measureText(title).width;
    let x = 480 - total / 2;
    [...title].forEach((ch, i) => {
      const y = 40 + Math.sin(this.t / 12 + i * 0.6) * 6;
      UI.text(ctx, ch, x, y, { size: 64, color: colors[i % colors.length], shadow: '#2b1d3a' });
      x += ctx.measureText(ch).width;
    });
    UI.text(ctx, 'Aventura en el Reino Cuqui', 480, 124, { size: 16, align: 'center', color: '#ffffff' });

    UI.panel(ctx, 120, 160, 720, 300, { fill: 'rgba(255,248,231,0.95)' });
    UI.text(ctx, 'Elige tu personaje', 480, 176, { size: 14, align: 'center', color: '#2b1d3a', shadow: null });
    HEROES.forEach((h, i) => {
      const cx = 210 + i * 180;
      const sel = i === this.heroIndex;
      const frames = this.portraits[i];
      const f = sel ? 1 + (Math.floor(this.t / 10) % 2) : 0;
      const by = sel ? -Math.abs(Math.sin(this.t / 8)) * 10 : 0;
      if (sel) {
        ctx.fillStyle = '#ffe066';
        UI.roundRect(ctx, cx - 70, 200, 140, 170, 12);
        ctx.fill();
      }
      UI.sprite(ctx, frames[f], cx - 60, 212 + by, 5);
      UI.text(ctx, h.name, cx, 340, { size: 12, align: 'center', color: '#2b1d3a', shadow: null });
    });
    UI.text(ctx, `◀ ▶  ${HEROES[this.heroIndex].desc}`, 480, 384, { size: 10, align: 'center', color: '#7a6a8a', shadow: null });

    const diff = DIFFICULTY[this.difficulty].label;
    UI.text(ctx, `▲ ▼  Nivel: ${diff}`, 480, 412, { size: 12, align: 'center', color: '#9b5cff', shadow: null });
    UI.text(ctx, this.difficulty === 'peque' ? 'Palabras en horizontal y vertical' : 'Palabras también en diagonal', 480, 434, { size: 8, align: 'center', color: '#7a6a8a', shadow: null });

    if (Math.floor(this.t / 30) % 2 === 0) UI.text(ctx, 'Pulsa ENTER para empezar', 480, 474, { size: 16, align: 'center', color: '#ffe066' });
    UI.text(ctx, 'M: sonido', 944, 520, { size: 8, align: 'right' });
  },

  drawStory(ctx) {
    const lvl = LEVELS[this.levelIndex];
    const theme = THEMES[lvl.theme];
    UI.sky(ctx, theme, 960, 540, this.t);
    UI.panel(ctx, 60, 50, 840, 440);
    UI.text(ctx, `Mundo ${this.levelIndex + 1}`, 480, 74, { size: 14, align: 'center', color: '#9b5cff', shadow: null });
    UI.text(ctx, lvl.name, 480, 100, { size: 24, align: 'center', color: '#2b1d3a', shadow: null });

    const v = this.villainPortraits[lvl.villain];
    const vf = VILLAINS[lvl.villain].wings ? Math.floor(this.t / 10) % 2 : 0;
    UI.sprite(ctx, v.evil[vf], 640, 150 + Math.sin(this.t / 15) * 4, 8, true);
    UI.sprite(ctx, this.heroFrames[0], 100, 330, 5);
    UI.text(ctx, `${VILLAINS[lvl.villain].name}`, 736, 352, { size: 12, align: 'center', color: '#e64980', shadow: null });

    let y = 160;
    lvl.story.forEach(s => {
      y += UI.paragraph(ctx, s, 100, y, 520, { size: 13, color: '#2b1d3a', shadow: null, lineHeight: 24 }) + 16;
    });

    UI.text(ctx, 'Flechas: moverse · ESPACIO o ▲: saltar · P: pausa', 480, 412, { size: 10, align: 'center', color: '#7a6a8a', shadow: null });
    if (Math.floor(this.t / 30) % 2 === 0) UI.text(ctx, 'Pulsa ENTER para empezar', 480, 446, { size: 14, align: 'center', color: '#e64980', shadow: null });
  },

  drawEnding(ctx) {
    this.drawScenery(ctx, THEMES.clouds, this.titleTiles);
    for (const c of this.confetti) {
      ctx.fillStyle = c.c;
      ctx.fillRect(c.x + Math.sin(c.r) * 6, c.y, 8, 8);
    }
    UI.text(ctx, '¡Has salvado el', 480, 50, { size: 28, align: 'center', color: '#ffe066' });
    UI.text(ctx, 'Reino Cuqui!', 480, 96, { size: 28, align: 'center', color: '#ffe066' });

    const friends = [this.heroFrames, ...Object.values(this.villainPortraits).map(v => v.good)];
    friends.forEach((frames, i) => {
      const x = 150 + i * 180;
      const jump = Math.abs(Math.sin(this.t / 9 + i)) * 30;
      UI.sprite(ctx, frames[jump > 15 ? 3 : 0], x, 330 - jump, 5, i > 0);
    });

    UI.panel(ctx, 230, 168, 500, 100);
    UI.text(ctx, `${this.hero.name} y sus nuevos amigos`, 480, 186, { size: 12, align: 'center', color: '#2b1d3a', shadow: null });
    UI.text(ctx, 'vuelven a ser felices.', 480, 208, { size: 12, align: 'center', color: '#2b1d3a', shadow: null });
    UI.text(ctx, `Estrellas recogidas: ${this.totalStars}`, 480, 240, { size: 12, align: 'center', color: '#b06a00', shadow: null });
    if (this.t > 120 && Math.floor(this.t / 30) % 2 === 0) UI.text(ctx, 'Pulsa ENTER para volver a jugar', 480, 470, { size: 14, align: 'center' });
  },
};

const boot = () => Game.init();
if (document.fonts && document.fonts.load) {
  Promise.race([document.fonts.load(`16px ${FONT}`), new Promise(r => setTimeout(r, 1500))]).then(boot, boot);
} else {
  boot();
}
