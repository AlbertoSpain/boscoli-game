'use strict';

const TILE = 16;
const SCALE = 3;
const VIEW_W = 960 / SCALE;
const VIEW_H = 540 / SCALE;
const ROWS = 12;
const SOLID = new Set(['G', 'B', '?', 'U']);

function buildLevel(def) {
  const grid = Array.from({ length: ROWS }, (_, y) => Array(def.width).fill(y >= 10 ? 'G' : '.'));
  const set = (x, y, ch) => { if (x >= 0 && x < def.width && y >= 0 && y < ROWS) grid[y][x] = ch; };
  const enemies = [];
  const checkpoints = [];
  let goal = null;

  const surface = x => {
    for (let y = ROWS - 1; y >= 0; y--) if (!SOLID.has(grid[y][x])) return y;
    return 0;
  };

  for (const [op, ...a] of def.ops) {
    switch (op) {
      case 'gap':
        for (let x = a[0]; x < a[0] + a[1]; x++) { set(x, 10, '.'); set(x, 11, '.'); }
        break;
      case 'hill':
        for (let x = a[0]; x < a[0] + a[1]; x++) for (let y = 10 - a[2]; y < 10; y++) set(x, y, 'G');
        break;
      case 'stairs':
        for (let i = 0; i < a[1]; i++) {
          const h = a[2] === 'up' ? i + 1 : a[1] - i;
          for (let y = 10 - h; y < 10; y++) set(a[0] + i, y, 'G');
        }
        break;
      case 'blocks':
        [...a[2]].forEach((ch, i) => set(a[0] + i, a[1], ch));
        break;
      case 'plat':
        for (let x = a[0]; x < a[0] + a[2]; x++) set(x, a[1], '=');
        break;
      case 'stars':
        for (let i = 0; i < a[2]; i++) set(a[0] + i, a[1], 'S');
        break;
      case 'heart':
        set(a[0], a[1], 'H');
        break;
      case 'enemy':
        enemies.push(a[0]);
        break;
      case 'check':
        checkpoints.push(a[0]);
        break;
      case 'goal':
        goal = a[0];
        break;
    }
  }

  return {
    grid,
    width: def.width,
    enemies: enemies.map(x => ({ x: x * TILE + 1, y: surface(x) * TILE + 6, w: 14, h: 10, vx: -0.5, vy: 0, alive: true, squash: 0, anim: 0, onGround: false })),
    checkpoints: checkpoints.map(x => ({ x: x * TILE, y: (surface(x) - 1) * TILE, active: false })),
    goal: { x: goal * TILE, y: (surface(goal) - 2) * TILE },
    start: { x: 2 * TILE + 2, y: (surface(2) + 1) * TILE },
  };
}

class Platformer {
  constructor(game, levelIndex) {
    this.game = game;
    this.def = LEVELS[levelIndex];
    this.theme = THEMES[this.def.theme];
    this.tiles = Sprites.tileset(this.theme);
    const lvl = buildLevel(this.def);
    Object.assign(this, lvl);
    this.maxHearts = DIFFICULTY[game.difficulty].hearts;
    this.hearts = this.maxHearts;
    this.stars = 0;
    this.respawn = { ...this.start };
    this.player = { x: this.start.x, y: this.start.y - 16, w: 12, h: 16, vx: 0, vy: 0, onGround: false, face: 1, anim: 0, invuln: 0, coyote: 0, jumpBuf: 0 };
    this.cam = { x: 0 };
    this.particles = [];
    this.bumps = [];
    this.message = null;
    this.t = 0;
    this.goalTimer = 0;
    this.done = false;
    this.showMessage(this.def.name, 150);
  }

  tile(tx, ty) {
    if (tx < 0 || tx >= this.width) return 'G';
    if (ty < 0 || ty >= ROWS) return '.';
    return this.grid[ty][tx];
  }

  solid(tx, ty) {
    return SOLID.has(this.tile(tx, ty));
  }

  showMessage(text, frames = 120) {
    this.message = { text, frames };
  }

  moveX(e) {
    e.x += e.vx;
    let hit = false;
    const top = Math.floor(e.y / TILE), bottom = Math.floor((e.y + e.h - 0.01) / TILE);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / TILE);
      for (let ty = top; ty <= bottom; ty++) if (this.solid(tx, ty)) { e.x = tx * TILE - e.w; hit = true; break; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / TILE);
      for (let ty = top; ty <= bottom; ty++) if (this.solid(tx, ty)) { e.x = (tx + 1) * TILE; hit = true; break; }
    }
    if (hit) e.vx = 0;
    return hit;
  }

  moveY(e, isPlayer = false) {
    const prevBottom = e.y + e.h;
    e.y += e.vy;
    e.onGround = false;
    const left = Math.floor(e.x / TILE), right = Math.floor((e.x + e.w - 0.01) / TILE);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let tx = left; tx <= right; tx++) {
        const t = this.tile(tx, ty);
        if (SOLID.has(t) || (t === '=' && prevBottom <= ty * TILE + 0.01)) {
          e.y = ty * TILE - e.h;
          e.vy = 0;
          e.onGround = true;
          break;
        }
      }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / TILE);
      const hits = [];
      for (let tx = left; tx <= right; tx++) if (this.solid(tx, ty)) hits.push(tx);
      if (hits.length) {
        e.y = (ty + 1) * TILE;
        e.vy = 0;
        if (isPlayer) {
          const cx = Math.floor((e.x + e.w / 2) / TILE);
          this.bumpTile(hits.includes(cx) ? cx : hits[0], ty);
        }
      }
    }
  }

  bumpTile(tx, ty) {
    const t = this.tile(tx, ty);
    this.bumps.push({ tx, ty, t: 8 });
    if (t === '?') {
      this.grid[ty][tx] = 'U';
      this.stars++;
      Sound.play('block');
      this.particles.push({ type: 'star', x: tx * TILE + 2, y: ty * TILE - 12, vx: 0, vy: -3, life: 30 });
      this.floatText('+1', tx * TILE + 8, ty * TILE - 10);
    } else {
      Sound.play('bump');
    }
    for (const e of this.enemies) {
      if (e.alive && Math.abs(e.x + e.w / 2 - (tx * TILE + 8)) < 14 && Math.abs(e.y + e.h - ty * TILE) < 4) this.defeatEnemy(e);
    }
  }

  floatText(text, x, y, color = '#ffffff') {
    this.particles.push({ type: 'text', text, x, y, vx: 0, vy: -0.6, life: 45, color });
  }

  burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      this.particles.push({ type: 'dot', x, y, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5 - 0.5, life: 25, color });
    }
  }

  defeatEnemy(e) {
    e.alive = false;
    e.squash = 40;
    Sound.play('stomp');
    this.burst(e.x + e.w / 2, e.y + e.h / 2, '#ffffff', 8);
  }

  hurt() {
    const p = this.player;
    if (p.invuln > 0) return;
    this.hearts--;
    Sound.play('hurt');
    if (this.hearts <= 0) {
      this.respawnPlayer();
      this.hearts = this.maxHearts;
      this.showMessage('¡Ánimo! ¡Otra vez!', 120);
      return;
    }
    p.invuln = 90;
    p.vy = -3.5;
    p.vx = -p.face * 2.5;
  }

  respawnPlayer() {
    const p = this.player;
    p.x = this.respawn.x;
    p.y = this.respawn.y - p.h;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 90;
  }

  update(input) {
    this.t++;
    const p = this.player;

    if (this.message && --this.message.frames <= 0) this.message = null;

    if (this.goalTimer > 0) {
      this.goalTimer++;
      p.vx = 0.8;
      p.face = 1;
      p.anim += 0.15;
      p.vy = Math.min(p.vy + 0.35, 7);
      this.moveX(p);
      this.moveY(p);
      if (this.goalTimer === 150) this.done = true;
      this.updateParticles();
      return;
    }

    if (input.left) { p.vx -= 0.35; p.face = -1; }
    else if (input.right) { p.vx += 0.35; p.face = 1; }
    else p.vx *= p.onGround ? 0.72 : 0.92;
    p.vx = Math.max(-2, Math.min(2, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;

    p.coyote = p.onGround ? 6 : p.coyote - 1;
    p.jumpBuf = input.jumpPressed ? 7 : p.jumpBuf - 1;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -6.4;
      p.coyote = 0;
      p.jumpBuf = 0;
      Sound.play('jump');
    }
    if (!input.jumpHeld && p.vy < -2.5) p.vy = -2.5;
    p.vy = Math.min(p.vy + 0.35, 7);

    this.moveX(p);
    this.moveY(p, true);
    if (p.x < 0) p.x = 0;
    p.anim = p.onGround && p.vx !== 0 ? p.anim + Math.abs(p.vx) * 0.09 : 0;
    if (p.invuln > 0) p.invuln--;

    if (p.y > ROWS * TILE + 24) {
      this.hearts--;
      Sound.play('hurt');
      if (this.hearts <= 0) {
        this.hearts = this.maxHearts;
        this.showMessage('¡Ánimo! ¡Otra vez!', 120);
      }
      this.respawnPlayer();
    }

    this.collectTiles();
    this.updateEnemies();
    this.updateCheckpoints();
    this.updateParticles();
    this.bumps = this.bumps.filter(b => --b.t > 0);

    const g = this.goal;
    if (p.x + p.w / 2 > g.x + 18 && p.y + p.h > g.y) {
      this.goalTimer = 1;
      Sound.stopMusic();
      Sound.play('goal');
      this.showMessage('¡Has llegado!', 150);
    }

    const target = p.x + p.w / 2 - VIEW_W / 2.4;
    this.cam.x += (target - this.cam.x) * 0.12;
    this.cam.x = Math.max(0, Math.min(this.width * TILE - VIEW_W, this.cam.x));
  }

  collectTiles() {
    const p = this.player;
    const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.01) / TILE);
    const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tile(tx, ty);
        if (t === 'S') {
          this.grid[ty][tx] = '.';
          this.stars++;
          Sound.play('star');
          this.burst(tx * TILE + 8, ty * TILE + 8, '#ffd93b', 6);
        } else if (t === 'H') {
          this.grid[ty][tx] = '.';
          this.hearts = Math.min(this.maxHearts, this.hearts + 1);
          Sound.play('heart');
          this.floatText('♥', tx * TILE + 8, ty * TILE, '#ff4f7b');
        }
      }
    }
  }

  updateEnemies() {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) { if (e.squash > 0) e.squash--; continue; }
      if (e.x < this.cam.x - 64 || e.x > this.cam.x + VIEW_W + 48) continue;
      e.anim++;
      e.vy = Math.min(e.vy + 0.35, 6);
      const dir = Math.sign(e.vx) || -1;
      if (this.moveX(e)) e.vx = -dir * 0.5;
      this.moveY(e);
      if (e.onGround) {
        const aheadX = Math.floor((dir > 0 ? e.x + e.w + 1 : e.x - 1) / TILE);
        const belowY = Math.floor((e.y + e.h + 1) / TILE);
        const t = this.tile(aheadX, belowY);
        if (!SOLID.has(t) && t !== '=') e.vx = -dir * 0.5;
      }
      if (e.y > ROWS * TILE) e.alive = false;

      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        if (p.vy > 0 && p.y + p.h - e.y < 9) {
          this.defeatEnemy(e);
          p.vy = this.game.input.jumpHeld ? -6.2 : -4.2;
          this.floatText('¡Bien!', e.x + e.w / 2, e.y - 6, '#ffe066');
        } else {
          this.hurt();
        }
      }
    }
  }

  updateCheckpoints() {
    const p = this.player;
    for (const c of this.checkpoints) {
      if (!c.active && p.x + p.w > c.x + 6 && p.x < c.x + 10) {
        c.active = true;
        this.respawn = { x: c.x + 2, y: c.y + TILE * 2 };
        Sound.play('checkpoint');
        this.showMessage('¡Punto de control!', 100);
        this.burst(c.x + 8, c.y + 4, '#ff5c8a', 12);
      }
    }
  }

  updateParticles() {
    for (const q of this.particles) {
      q.x += q.vx;
      q.y += q.vy;
      if (q.type === 'dot') q.vy += 0.08;
      if (q.type === 'star') q.vy += 0.2;
      q.life--;
    }
    this.particles = this.particles.filter(q => q.life > 0);
  }

  // ---------- Dibujo ----------
  draw(ctx) {
    const camX = Math.round(this.cam.x);
    const camY = ROWS * TILE - VIEW_H;
    UI.sky(ctx, this.theme, 960, 540, this.t);

    ctx.imageSmoothingEnabled = false;
    const parallax = (img, factor, gap, y, offset = 0) => {
      const w = (img.width + gap) * SCALE;
      const start = -((camX * factor * SCALE + offset) % w);
      for (let x = start - w; x < 960 + w; x += w) ctx.drawImage(img, x, y, img.width * SCALE, img.height * SCALE);
    };
    parallax(this.tiles.cloud, 0.15, 70, 50, -this.t * 0.3);
    parallax(this.tiles.cloud, 0.25, 110, 140, 200);
    parallax(this.tiles.hillFar, 0.3, 40, 540 - 56 * SCALE - 70);
    parallax(this.tiles.hillNear, 0.5, 90, 540 - 40 * SCALE - 60, 100);

    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(-camX, -camY);

    const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(this.width - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.grid[ty][tx];
        if (t === '.') continue;
        const bump = this.bumps.find(b => b.tx === tx && b.ty === ty);
        const by = bump ? -Math.sin((bump.t / 8) * Math.PI) * 4 : 0;
        const x = tx * TILE, y = ty * TILE + by;
        let img = null;
        if (t === 'G') img = this.tile(tx, ty - 1) === 'G' ? this.tiles.dirt : this.tiles.grass;
        else if (t === 'B') img = this.tiles.brick;
        else if (t === '?') img = this.tiles.question;
        else if (t === 'U') img = this.tiles.used;
        else if (t === '=') img = this.tiles.plat;
        if (img) ctx.drawImage(img, x, y);
        else if (t === 'S') ctx.drawImage(this.tiles.star, x + 2, y + 2 + Math.sin(this.t / 10 + tx) * 1.5);
        else if (t === 'H') ctx.drawImage(this.tiles.heart, x + 3, y + 4 + Math.sin(this.t / 8) * 1.5, 10, 9);
      }
    }

    for (const c of this.checkpoints) ctx.drawImage(c.active ? this.tiles.flagOn : this.tiles.flagOff, c.x, c.y);
    ctx.drawImage(this.tiles.castle, this.goal.x - 8, this.goal.y);

    for (const e of this.enemies) {
      if (!e.alive && e.squash <= 0) continue;
      const frame = e.alive ? Math.floor(e.anim / 15) % 2 : 2;
      ctx.drawImage(this.tiles.blob[frame], Math.round(e.x - 1), Math.round(e.y - 6));
    }

    const p = this.player;
    const hidePlayer = this.goalTimer > 60 || (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0);
    if (!hidePlayer) {
      const frames = this.game.heroFrames;
      let f = 0;
      if (!p.onGround) f = 3;
      else if (p.vx !== 0) f = 1 + (Math.floor(p.anim) % 2);
      const img = frames[f];
      const sx = Math.round(p.x - 6), sy = Math.round(p.y - 7);
      if (p.face < 0) {
        ctx.save();
        ctx.translate(sx + 24, sy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy);
      }
    }

    for (const q of this.particles) {
      if (q.type === 'dot') { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }
      if (q.type === 'star') ctx.drawImage(this.tiles.star, Math.round(q.x), Math.round(q.y));
    }
    ctx.restore();

    for (const q of this.particles) {
      if (q.type === 'text') UI.text(ctx, q.text, (q.x - camX) * SCALE, (q.y - camY) * SCALE, { size: 14, color: q.color, align: 'center' });
    }

    this.drawHud(ctx);
  }

  drawHud(ctx) {
    for (let i = 0; i < this.maxHearts; i++) {
      ctx.globalAlpha = i < this.hearts ? 1 : 0.3;
      UI.sprite(ctx, this.tiles.heart, 16 + i * 32, 14, 3);
    }
    ctx.globalAlpha = 1;
    UI.sprite(ctx, this.tiles.star, 16, 50, 3);
    UI.text(ctx, `x ${this.stars}`, 58, 60, { size: 16 });
    UI.text(ctx, `+${Math.min(this.stars, MAX_STAR_BONUS)}s de magia`, 16, 92, { size: 10, color: '#ffe066' });

    const v = VILLAINS[this.def.villain];
    UI.text(ctx, `Meta: ${v.name}`, 944, 18, { size: 12, align: 'right' });
    const progress = Math.min(1, this.player.x / this.goal.x);
    ctx.fillStyle = '#2b1d3a';
    ctx.fillRect(744, 40, 200, 12);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(746, 42, 196 * progress, 8);

    if (this.message) {
      const a = Math.min(1, this.message.frames / 20);
      ctx.globalAlpha = a;
      UI.text(ctx, this.message.text, 480, 150, { size: 24, align: 'center', color: '#ffffff' });
      ctx.globalAlpha = 1;
    }
  }
}
