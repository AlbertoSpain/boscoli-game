'use strict';

const WORD_COLORS = ['#ff6f91', '#4dabf7', '#40c057', '#f59f00', '#9775fa', '#ff922b', '#12b886', '#e64980'];

class Battle {
  constructor(game, levelIndex, starBonus) {
    this.game = game;
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.theme = THEMES[this.level.theme];
    this.villain = VILLAINS[this.level.villain];
    this.hero = game.hero;
    this.cfg = DIFFICULTY[game.difficulty].battles[levelIndex];
    this.starBonus = Math.min(starBonus, MAX_STAR_BONUS);
    this.totalTime = this.cfg.time + this.starBonus;
    this.timeLeft = this.totalTime;

    this.heroImg = game.heroFrames;
    this.evilImg = Sprites.animalFrames(this.villain, true);
    this.goodImg = Sprites.animalFrames(this.villain, false);
    this.starImg = Sprites.star(12);
    this.heartImg = Sprites.heart();

    this.puzzle = WordSearch.create(WORD_POOLS[this.level.theme], this.cfg.size, this.cfg.words, DIFFICULTY[game.difficulty].dirs);
    this.found = new Map();
    this.hp = this.puzzle.placements.length;
    this.maxHp = this.hp;
    this.cursor = [0, 0];
    this.start = null;
    this.dragging = false;
    this.hints = 3;
    this.hintCell = null;
    this.hintTimer = 0;

    this.phase = 'intro';
    this.t = 0;
    this.phaseT = 0;
    this.projectiles = [];
    this.particles = [];
    this.villainHit = 0;
    this.heroHit = 0;
    this.taunt = null;
    this.nextTaunt = 600;
    this.converted = false;
    this.lastTick = -1;

    this.buildDom();
    Sound.playMusic('battle');
  }

  // ---------- DOM de la sopa de letras ----------
  buildDom() {
    this.ui = document.getElementById('battle-ui');
    this.gridEl = document.getElementById('ws-grid');
    this.wordsEl = document.getElementById('ws-words');
    this.fillEl = document.getElementById('spell-fill');
    this.barEl = this.fillEl.parentElement;
    document.getElementById('spell-name').textContent = `⚡ Hechizo de ${this.villain.name}`;
    document.getElementById('hint-count').textContent = this.hints;

    const n = this.puzzle.size;
    this.gridEl.style.setProperty('--n', n);
    this.gridEl.innerHTML = '';
    this.cells = [];
    for (let r = 0; r < n; r++) {
      this.cells.push([]);
      for (let c = 0; c < n; c++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.textContent = this.puzzle.grid[r][c];
        el.dataset.r = r;
        el.dataset.c = c;
        this.gridEl.appendChild(el);
        this.cells[r].push(el);
      }
    }

    this.wordsEl.innerHTML = '';
    this.wordEls = new Map();
    for (const p of this.puzzle.placements) {
      const li = document.createElement('li');
      li.textContent = `${p.emoji} ${p.word}`;
      this.wordsEl.appendChild(li);
      this.wordEls.set(p.word, li);
    }

    const cellOf = e => {
      const el = e.target.closest('.cell');
      return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
    };
    this.onDown = e => {
      const cell = cellOf(e);
      if (!cell || this.phase !== 'fight') return;
      e.preventDefault();
      Sound.init();
      this.cursor = cell;
      if (this.start && !this.same(this.start, cell)) {
        this.trySelection(this.start, cell);
      } else if (this.start) {
        this.start = null;
      } else {
        this.start = cell;
        this.dragging = true;
        Sound.play('mark');
      }
      this.refresh();
    };
    this.onOver = e => {
      const cell = cellOf(e);
      if (!cell || this.phase !== 'fight') return;
      this.cursor = cell;
      this.refresh();
    };
    this.onUp = e => {
      if (!this.dragging) return;
      this.dragging = false;
      const cell = cellOf(e);
      if (cell && this.start && !this.same(cell, this.start)) {
        this.trySelection(this.start, cell);
        this.refresh();
      }
    };
    this.gridEl.addEventListener('mousedown', this.onDown);
    this.gridEl.addEventListener('mouseover', this.onOver);
    window.addEventListener('mouseup', this.onUp);

    this.ui.classList.remove('hidden');
    this.refresh();
    this.updateMeter();
  }

  destroy() {
    this.gridEl.removeEventListener('mousedown', this.onDown);
    this.gridEl.removeEventListener('mouseover', this.onOver);
    window.removeEventListener('mouseup', this.onUp);
    this.ui.classList.add('hidden');
    this.barEl.classList.remove('danger');
  }

  same(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }

  refresh() {
    const preview = this.start ? WordSearch.line(this.start, this.cursor) || [] : [];
    const inPreview = new Set(preview.map(([r, c]) => `${r},${c}`));
    const showCursor = this.phase === 'fight';
    this.cells.forEach((row, r) => row.forEach((el, c) => {
      el.classList.toggle('cursor', showCursor && this.cursor[0] === r && this.cursor[1] === c);
      el.classList.toggle('start', !!this.start && this.start[0] === r && this.start[1] === c);
      el.classList.toggle('preview', inPreview.has(`${r},${c}`));
      el.classList.toggle('hint', !!this.hintCell && this.hintCell[0] === r && this.hintCell[1] === c);
    }));
  }

  trySelection(a, b) {
    const cells = WordSearch.line(a, b);
    const foundWords = new Set(this.found.keys());
    const p = WordSearch.match(this.puzzle, cells, foundWords);
    this.start = null;
    this.dragging = false;
    if (p) {
      const color = WORD_COLORS[this.found.size % WORD_COLORS.length];
      this.found.set(p.word, color);
      p.cells.forEach(([r, c]) => {
        const el = this.cells[r][c];
        el.classList.add('found');
        el.style.background = color;
      });
      const li = this.wordEls.get(p.word);
      li.classList.add('found');
      li.style.background = color;
      if (this.hintCell && p.cells.some(c => this.same(c, this.hintCell))) this.hintCell = null;
      Sound.play('found');
      this.castSpell(color, p.word);
      if (this.found.size === this.maxHp) this.phase = 'finishing';
    } else {
      Sound.play('nope');
      (cells || [a, b]).forEach(([r, c]) => {
        const el = this.cells[r][c];
        el.classList.remove('wrong');
        void el.offsetWidth;
        el.classList.add('wrong');
        setTimeout(() => el.classList.remove('wrong'), 320);
      });
    }
  }

  useHint() {
    if (this.hints <= 0) { Sound.play('nope'); return; }
    const remaining = this.puzzle.placements.filter(p => !this.found.has(p.word));
    if (!remaining.length) return;
    const p = remaining[Math.floor(Math.random() * remaining.length)];
    this.hints--;
    document.getElementById('hint-count').textContent = this.hints;
    this.hintCell = p.cells[0];
    this.hintTimer = 240;
    Sound.play('select');
    this.refresh();
  }

  onKey(code) {
    if (this.phase === 'intro') {
      if (code === 'Enter' || code === 'Space') this.beginFight();
      return;
    }
    if (this.phase === 'won' && this.phaseT > 90 && (code === 'Enter' || code === 'Space')) {
      this.game.battleWon(this.levelIndex);
      return;
    }
    if (this.phase === 'lost' && this.phaseT > 90 && (code === 'Enter' || code === 'Space')) {
      this.game.retryBattle(this.levelIndex, this.starBonus);
      return;
    }
    if (this.phase !== 'fight') return;

    const n = this.puzzle.size;
    const moves = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] };
    if (moves[code]) {
      const [dr, dc] = moves[code];
      this.cursor = [Math.max(0, Math.min(n - 1, this.cursor[0] + dr)), Math.max(0, Math.min(n - 1, this.cursor[1] + dc))];
      Sound.play('move');
    } else if (code === 'Space' || code === 'Enter') {
      if (!this.start) {
        this.start = [...this.cursor];
        Sound.play('mark');
      } else if (this.same(this.start, this.cursor)) {
        this.start = null;
      } else {
        this.trySelection(this.start, this.cursor);
      }
    } else if (code === 'Escape' || code === 'Backspace') {
      this.start = null;
    } else if (code === 'KeyH') {
      this.useHint();
    }
    this.refresh();
  }

  beginFight() {
    this.phase = 'fight';
    this.phaseT = 0;
    this.refresh();
  }

  castSpell(color, word) {
    Sound.play('spell');
    this.projectiles.push({ from: [200, 360], to: [345, 190], t: 0, dur: 40, color, evil: false, word });
  }

  villainAttack() {
    Sound.play('evil');
    this.projectiles.push({ from: [320, 200], to: [150, 370], t: 0, dur: 45, color: '#9b5cff', evil: true });
    const taunts = this.villain.taunts;
    this.taunt = { text: taunts[Math.floor(Math.random() * taunts.length)], frames: 180 };
  }

  burst(x, y, color, n = 16, speed = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20, color, size: 4 + Math.floor(Math.random() * 4) });
    }
  }

  updateMeter() {
    const pct = 100 * (1 - this.timeLeft / this.totalTime);
    this.fillEl.style.width = `${pct}%`;
    document.getElementById('spell-time').textContent = `⏳ ${Math.ceil(this.timeLeft)}s`;
    this.barEl.classList.toggle('danger', this.timeLeft <= 20 && this.phase === 'fight');
  }

  update() {
    this.t++;
    this.phaseT++;

    if (this.phase === 'intro' && this.phaseT > 420) this.beginFight();

    if (this.phase === 'fight') {
      this.timeLeft = Math.max(0, this.timeLeft - 1 / 60);
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 10 && sec !== this.lastTick) { this.lastTick = sec; Sound.play('tick'); }
      if (--this.nextTaunt <= 0) { this.villainAttack(); this.nextTaunt = 720 + Math.random() * 300; }
      if (this.timeLeft <= 0) this.lose();
      this.updateMeter();
    }

    if (this.hintTimer > 0 && --this.hintTimer === 0) { this.hintCell = null; this.refresh(); }
    if (this.taunt && --this.taunt.frames <= 0) this.taunt = null;
    if (this.villainHit > 0) this.villainHit--;
    if (this.heroHit > 0) this.heroHit--;

    for (const pr of this.projectiles) {
      pr.t++;
      const k = pr.t / pr.dur;
      const [x, y] = this.projPos(pr, k);
      if (pr.t % 2 === 0) this.particles.push({ x, y, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), life: 18, color: pr.t % 4 ? pr.color : '#ffffff', size: 4 });
      if (pr.t >= pr.dur) {
        if (pr.evil) {
          this.heroHit = 24;
          this.burst(x, y, '#9b5cff', 12, 3);
          Sound.play('hit');
        } else {
          this.villainHit = 24;
          this.hp--;
          this.burst(x, y, pr.color, 22, 5);
          this.burst(x, y, '#ffe066', 10, 3);
          Sound.play('hit');
          if (this.hp <= 0 && this.phase === 'finishing') this.win();
        }
      }
    }
    this.projectiles = this.projectiles.filter(pr => pr.t < pr.dur);

    for (const q of this.particles) { q.x += q.vx; q.y += q.vy; q.vy += 0.05; q.life--; }
    this.particles = this.particles.filter(q => q.life > 0);

    if (this.phase === 'won') {
      if (this.phaseT === 70) {
        this.converted = true;
        Sound.play('poof');
        this.burst(345, 190, '#ffffff', 30, 5);
        this.burst(345, 190, '#ff8fb1', 20, 4);
      }
      if (this.converted && this.t % 20 === 0) {
        this.particles.push({ x: 300 + Math.random() * 90, y: 230, vx: 0, vy: -1.2, life: 80, color: '#ff4f7b', size: 0, heart: true });
      }
    }
  }

  projPos(pr, k) {
    const [x0, y0] = pr.from, [x1, y1] = pr.to;
    return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 70];
  }

  win() {
    this.phase = 'won';
    this.phaseT = 0;
    this.start = null;
    this.hintCell = null;
    this.refresh();
    this.updateMeter();
    Sound.playMusic('victory');
    Sound.play('win');
  }

  lose() {
    this.phase = 'lost';
    this.phaseT = 0;
    this.start = null;
    this.refresh();
    this.updateMeter();
    Sound.stopMusic();
    Sound.play('evil');
    setTimeout(() => Sound.play('lose'), 500);
    this.burst(150, 370, '#9b5cff', 40, 6);
  }

  // ---------- Dibujo de la arena ----------
  draw(ctx) {
    const W = 488;
    UI.sky(ctx, this.theme, 960, 540, this.t);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, 280 + i * 44, W, 22);

    const ellipse = (cx, cy, rx, ry, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    ellipse(345, 262, 120, 26, Sprites.shade(this.theme.grassDark, -0.1));
    ellipse(345, 256, 120, 24, this.theme.grass);
    ellipse(140, 452, 130, 30, Sprites.shade(this.theme.grassDark, -0.1));
    ellipse(140, 446, 130, 28, this.theme.grass);

    // Villano (mirando a la izquierda)
    const vFrames = this.converted ? this.goodImg : this.evilImg;
    let vx = 345 - 72, vy = 262 - 138 + Math.sin(this.t / 15) * 3;
    if (this.villainHit > 0) vx += Math.sin(this.villainHit * 2) * 6;
    let vFrame = this.villain.wings ? (Math.floor(this.t / 10) % 2 ? 1 : 0) : 0;
    if (this.phase === 'won' && !this.converted) {
      vx = 345 - 72 + Math.sin(this.phaseT) * 4;
      vFrame = 3;
    }
    if (this.converted) vy -= Math.abs(Math.sin(this.t / 8)) * 14;
    if (!(this.villainHit > 0 && this.villainHit % 6 < 3)) UI.sprite(ctx, vFrames[vFrame], vx, vy, 6, true);

    // Héroe (mirando a la derecha)
    let hx = 140 - 84, hy = 452 - 161 + Math.sin(this.t / 18) * 2;
    if (this.heroHit > 0) hx += Math.sin(this.heroHit * 2) * 5;
    const casting = this.projectiles.some(p => !p.evil && p.t < 12);
    const hFrame = casting ? 3 : this.phase === 'won' ? (Math.floor(this.t / 12) % 2 ? 3 : 0) : 0;
    if (this.phase === 'won') hy -= Math.abs(Math.sin(this.t / 7)) * 16;
    UI.sprite(ctx, this.heroImg[hFrame], hx, hy, 7);
    if (this.phase === 'lost') {
      for (let i = 0; i < 3; i++) {
        const a = this.t / 12 + (i * Math.PI * 2) / 3;
        UI.sprite(ctx, this.starImg, 128 + Math.cos(a) * 46, 285 + Math.sin(a) * 12, 2);
      }
    }

    for (const pr of this.projectiles) {
      const [x, y] = this.projPos(pr, pr.t / pr.dur);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      if (!pr.evil) UI.sprite(ctx, this.starImg, x - 12, y - 12, 2);
    }

    for (const q of this.particles) {
      ctx.globalAlpha = Math.min(1, q.life / 20);
      if (q.heart) UI.sprite(ctx, this.heartImg, q.x, q.y, 3);
      else { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    }
    ctx.globalAlpha = 1;

    this.drawBoxes(ctx);

    if (this.taunt && this.phase === 'fight') {
      const lines = UI.wrap(ctx, this.taunt.text, 200, 10);
      UI.panel(ctx, 250, 64, 220, lines.length * 18 + 16, { fill: '#ffffff', radius: 10 });
      lines.forEach((l, i) => UI.text(ctx, l, 260, 74 + i * 18, { size: 10, color: '#2b1d3a', shadow: null }));
    }

    if (this.phase === 'lost') {
      ctx.fillStyle = `rgba(110,40,200,${Math.max(0, 0.5 - this.phaseT / 120)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    this.drawMessage(ctx);
  }

  drawBoxes(ctx) {
    const v = this.villain;
    UI.panel(ctx, 16, 16, 236, 72);
    UI.text(ctx, v.name, 28, 26, { size: 14, color: '#2b1d3a', shadow: null });
    UI.text(ctx, v.title, 28, 46, { size: 8, color: '#7a6a8a', shadow: null });
    for (let i = 0; i < this.maxHp; i++) {
      ctx.globalAlpha = i < this.hp ? 1 : 0.2;
      UI.sprite(ctx, this.heartImg, 28 + i * 30, 60, 3);
    }
    ctx.globalAlpha = 1;

    UI.panel(ctx, 284, 312, 188, 64);
    UI.text(ctx, this.hero.name, 296, 322, { size: 14, color: '#2b1d3a', shadow: null });
    UI.text(ctx, `Palabras ${this.found.size}/${this.maxHp}`, 296, 346, { size: 10, color: '#2b7a4b', shadow: null });
    if (this.starBonus) UI.text(ctx, `⭐ +${this.starBonus}s`, 296, 362, { size: 8, color: '#b06a00', shadow: null });
  }

  drawMessage(ctx) {
    let text = null;
    let sub = null;
    if (this.phase === 'intro') {
      text = `¡${this.villain.name}, ${this.villain.title}, quiere luchar!`;
      sub = 'Encuentra todas las palabras para lanzar tu magia. ENTER: ¡a jugar!';
    } else if (this.phase === 'won') {
      text = this.converted ? `¡${this.villain.name} vuelve a ser cuqui y ahora es tu amigo!` : '¡Magia final!';
      if (this.phaseT > 90) sub = 'Pulsa ENTER para continuar';
    } else if (this.phase === 'lost') {
      text = `¡Uy! El hechizo de ${this.villain.name} te ha mareado...`;
      if (this.phaseT > 90) sub = 'Pulsa ENTER para intentarlo otra vez';
    } else {
      return;
    }
    const lines = UI.wrap(ctx, text, 432, 12);
    const subLines = sub ? UI.wrap(ctx, sub, 432, 9) : [];
    const h = lines.length * 20 + subLines.length * 16 + 20;
    UI.panel(ctx, 16, 524 - h, 456, h);
    lines.forEach((l, i) => UI.text(ctx, l, 28, 534 - h + i * 20, { size: 12, color: '#2b1d3a', shadow: null }));
    const blink = Math.floor(this.t / 30) % 2 === 0;
    subLines.forEach((l, i) => UI.text(ctx, l, 28, 534 - h + lines.length * 20 + 4 + i * 16, { size: 9, color: blink ? '#e64980' : '#9b5cff', shadow: null }));
  }
}
