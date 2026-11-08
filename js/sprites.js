'use strict';

// Todos los gráficos se pintan píxel a píxel en lienzos pequeños y luego
// se escalan sin suavizado para conseguir el aspecto retro.
const Sprites = (() => {
  const OUTLINE = '#2b1d3a';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1, 7), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) {
      r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
    } else {
      r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
    }
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  class Painter {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.c = makeCanvas(w, h);
      this.ctx = this.c.getContext('2d');
    }

    px(x, y, col) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.ctx.fillStyle = col;
      this.ctx.fillRect(x, y, 1, 1);
    }

    rect(x, y, w, h, col) {
      this.ctx.fillStyle = col;
      this.ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    }

    ellipse(cx, cy, rx, ry, col) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.px(x, y, col);
        }
      }
    }

    tri(x1, y1, x2, y2, x3, y3, col) {
      const minX = Math.floor(Math.min(x1, x2, x3)), maxX = Math.ceil(Math.max(x1, x2, x3));
      const minY = Math.floor(Math.min(y1, y2, y3)), maxY = Math.ceil(Math.max(y1, y2, y3));
      const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const a = ((x2 - px) * (y3 - py) - (x3 - px) * (y2 - py)) / area;
          const b = ((x3 - px) * (y1 - py) - (x1 - px) * (y3 - py)) / area;
          const c = 1 - a - b;
          if (a >= 0 && b >= 0 && c >= 0) this.px(x, y, col);
        }
      }
    }

    poly(points, col) {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const px = x + 0.5, py = y + 0.5;
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i], [xj, yj] = points[j];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) this.px(x, y, col);
        }
      }
    }

    pattern(x, y, rows, col) {
      rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && ch !== ' ') this.px(x + i, y + j, col); }));
    }

    outline(col = OUTLINE) {
      const img = this.ctx.getImageData(0, 0, this.w, this.h);
      const d = img.data;
      const alpha = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : d[(y * this.w + x) * 4 + 3]);
      const pts = [];
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (alpha(x, y) === 0 && (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1))) pts.push([x, y]);
        }
      }
      pts.forEach(([x, y]) => this.px(x, y, col));
      return this;
    }
  }

  // ---------- Animales cuquis (24x24, mirando a la derecha) ----------
  // frame: 0 quieto, 1-2 caminar, 3 saltar
  function animal(spec, frame = 0, evil = false) {
    const p = new Painter(24, 24);
    const oy = frame === 1 || frame === 2 ? -1 : frame === 3 ? -1 : 0;
    const dark = shade(spec.body, -0.18);

    if (spec.wings) {
      const flap = frame === 1 || frame === 3 ? -3 : 0;
      p.tri(8, 14 + oy, 0, 7 + flap + oy, 2, 19 + oy, spec.feet);
      p.tri(16, 14 + oy, 24, 7 + flap + oy, 22, 19 + oy, spec.feet);
      p.tri(7, 15 + oy, 2, 11 + flap + oy, 3, 17 + oy, spec.belly);
      p.tri(17, 15 + oy, 22, 11 + flap + oy, 21, 17 + oy, spec.belly);
    }

    switch (spec.tail) {
      case 'cat': p.ellipse(5, 14 + oy, 1.4, 3.6, spec.body); p.px(5, 11 + oy, dark); break;
      case 'fox': p.ellipse(5, 16 + oy, 3.6, 2.6, spec.body); p.ellipse(2.6, 15.5 + oy, 1.5, 1.5, '#ffffff'); break;
      case 'puff': p.ellipse(6.5, 18 + oy, 2, 2, '#ffffff'); break;
      case 'panda': p.ellipse(6.5, 18 + oy, 1.6, 1.6, spec.patch); break;
      case 'dog': p.ellipse(5.5, 15 + oy, 1.3, 2.8, spec.body); break;
    }

    let lf = [8, 21], rf = [13, 21];
    if (frame === 1) { lf = [7, 20]; rf = [14, 21]; }
    if (frame === 2) { lf = [9, 21]; rf = [12, 20]; }
    if (frame === 3) { lf = [7, 20]; rf = [14, 19]; }
    p.rect(lf[0], lf[1], 3, 2, spec.feet);
    p.rect(rf[0], rf[1], 3, 2, spec.feet);

    p.ellipse(12, 17 + oy, 5.5, 4.2, spec.body);
    p.ellipse(13, 18 + oy, 3, 2.4, spec.belly);
    p.rect(16, 16 + oy, 2, 3, spec.patch || dark);

    switch (spec.ears) {
      case 'cat':
        p.tri(4, 8 + oy, 5, 1 + oy, 10, 5 + oy, spec.body);
        p.tri(14, 5 + oy, 19, 1 + oy, 20, 8 + oy, spec.body);
        p.tri(5.5, 6 + oy, 6, 3 + oy, 8.5, 5 + oy, spec.inner);
        p.tri(15.5, 5 + oy, 18, 3 + oy, 18.5, 6 + oy, spec.inner);
        break;
      case 'fox':
        p.tri(3, 9 + oy, 4, 0 + oy, 10, 5 + oy, spec.body);
        p.tri(14, 5 + oy, 20, 0 + oy, 21, 9 + oy, spec.body);
        p.tri(5, 6 + oy, 5, 2 + oy, 8, 5 + oy, spec.inner);
        p.tri(16, 5 + oy, 19, 2 + oy, 19, 6 + oy, spec.inner);
        break;
      case 'bunny':
        p.ellipse(9, 4 + oy, 2, 5, spec.body);
        p.ellipse(15, 4 + oy, 2, 5, spec.body);
        p.ellipse(9, 4 + oy, 0.9, 3.5, spec.inner);
        p.ellipse(15, 4 + oy, 0.9, 3.5, spec.inner);
        break;
      case 'panda':
        p.ellipse(5.5, 5 + oy, 2.6, 2.6, spec.patch);
        p.ellipse(18.5, 5 + oy, 2.6, 2.6, spec.patch);
        break;
      case 'bat':
        p.tri(5, 7 + oy, 6, 1 + oy, 10, 5 + oy, spec.body);
        p.tri(14, 5 + oy, 18, 1 + oy, 19, 7 + oy, spec.body);
        p.tri(6.5, 5 + oy, 6.8, 3 + oy, 8.5, 5 + oy, spec.inner);
        p.tri(15.5, 5 + oy, 17.2, 3 + oy, 17.5, 5 + oy, spec.inner);
        break;
    }

    p.ellipse(12, 10.5 + oy, 8, 6.3, spec.body);

    if (spec.ears === 'dog') {
      p.ellipse(4.5, 10 + oy, 2, 4, spec.inner);
      p.ellipse(19.5, 10 + oy, 2, 4, spec.inner);
    }
    if (spec.stripes) {
      p.rect(11, 5 + oy, 1, 2, dark);
      p.rect(13, 5 + oy, 1, 2, dark);
    }
    if (spec.muzzle) p.ellipse(14, 12.8 + oy, 3.6, 2.3, spec.belly);
    if (spec.patch && spec.ears === 'panda') {
      p.ellipse(9, 10.5 + oy, 2, 2.6, spec.patch);
      p.ellipse(15, 10.5 + oy, 2, 2.6, spec.patch);
    }

    const eye = spec.ears === 'panda' ? '#000000' : OUTLINE;
    const glint = evil ? '#ff5c8a' : '#ffffff';
    p.rect(8, 9 + oy, 2, 3, eye);
    p.rect(14, 9 + oy, 2, 3, eye);
    p.px(8, 9 + oy, glint);
    p.px(14, 9 + oy, glint);
    if (spec.ears === 'panda') { p.px(9, 9 + oy, glint); p.px(15, 9 + oy, glint); }

    if (evil) {
      [[7, 7], [8, 7], [9, 8], [10, 8], [13, 8], [14, 8], [15, 7], [16, 7]].forEach(([x, y]) => p.px(x, y + oy, OUTLINE));
    }

    p.rect(6, 12 + oy, 2, 1, '#ff8fb1');
    p.rect(16, 12 + oy, 2, 1, '#ff8fb1');
    p.px(13, 12 + oy, spec.ears === 'dog' || spec.muzzle ? OUTLINE : '#ff6f91');

    const mouth = '#5a2a3a';
    if (evil) {
      [[11, 14], [12, 14], [13, 14], [14, 13]].forEach(([x, y]) => p.px(x, y + oy, mouth));
    } else {
      [[11, 13], [12, 14], [13, 13], [14, 14], [15, 13]].forEach(([x, y]) => p.px(x, y + oy, mouth));
    }

    if (spec.crown) {
      p.rect(9, 2 + oy, 7, 3, '#ffd23f');
      [[9, 1], [12, 1], [15, 1]].forEach(([x, y]) => p.px(x, y + oy, '#ffd23f'));
      p.px(12, 3 + oy, '#ff4f7b');
    }

    return p.outline().c;
  }

  function animalFrames(spec, evil = false) {
    return [0, 1, 2, 3].map(f => animal(spec, f, evil));
  }

  // ---------- Bichito (enemigo del nivel) ----------
  function blob(color, frame) {
    const p = new Painter(16, 16);
    if (frame === 2) {
      p.ellipse(8, 13.5, 7, 2.2, color);
      p.rect(5, 13, 1, 1, OUTLINE);
      p.rect(10, 13, 1, 1, OUTLINE);
      return p.outline().c;
    }
    const sq = frame === 1 ? 1 : 0;
    p.ellipse(8, 11 + sq * 0.5, 6.5 + sq * 0.5, 4.5 - sq * 0.5, color);
    p.rect(7, 4 + sq, 1, 3, shade(color, -0.3));
    p.ellipse(7.5, 4 + sq, 1.3, 1.3, '#ffd23f');
    p.px(5, 9, shade(color, 0.6));
    p.rect(5, 10, 2, 2, OUTLINE);
    p.rect(10, 10, 2, 2, OUTLINE);
    p.px(5, 10, '#fff');
    p.px(10, 10, '#fff');
    p.px(4, 9, OUTLINE); p.px(6, 9, OUTLINE);
    p.px(12, 9, OUTLINE); p.px(10, 9, OUTLINE);
    p.rect(7, 13, 3, 1, '#5a2a3a');
    return p.outline().c;
  }

  // ---------- Tiles ----------
  function groundTile(t, grassTop) {
    const p = new Painter(16, 16);
    p.rect(0, 0, 16, 16, t.dirt);
    [[3, 8], [10, 5], [6, 13], [13, 11], [1, 3], [11, 1]].forEach(([x, y]) => p.rect(x, y, 2, 2, t.dirtDark));
    if (grassTop) {
      p.rect(0, 0, 16, 4, t.grass);
      for (let x = 0; x < 16; x++) if (x % 4 < 2) p.px(x, 4, t.grass);
      p.rect(0, 0, 16, 1, shade(t.grass, 0.35));
      [[2, 2], [7, 1], [12, 2]].forEach(([x, y]) => p.px(x, y, t.grassDark));
    }
    return p.c;
  }

  function brickTile(t) {
    const p = new Painter(16, 16);
    p.rect(0, 0, 16, 16, t.brick);
    p.rect(0, 0, 16, 1, shade(t.brick, 0.3));
    p.rect(0, 7, 16, 1, t.brickDark);
    p.rect(0, 15, 16, 1, t.brickDark);
    p.rect(7, 0, 1, 7, t.brickDark);
    p.rect(15, 0, 1, 7, t.brickDark);
    p.rect(3, 8, 1, 7, t.brickDark);
    p.rect(11, 8, 1, 7, t.brickDark);
    return p.c;
  }

  function questionTile(used) {
    const p = new Painter(16, 16);
    const base = used ? '#b5835a' : '#ffc93c';
    const dark = shade(base, -0.4);
    p.rect(0, 0, 16, 16, dark);
    p.rect(1, 1, 14, 14, base);
    p.rect(1, 1, 14, 1, shade(base, 0.4));
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([x, y]) => p.px(x, y, dark));
    if (!used) {
      p.pattern(5, 3, ['.XXXX.', 'XX..XX', '....XX', '...XX.', '..XX..', '..XX..', '......', '..XX..'], '#8a4b00');
      p.pattern(4, 3, ['.XXXX.', 'XX..XX', '....XX', '...XX.', '..XX..', '..XX..', '......', '..XX..'], '#fff7d1');
    }
    return p.c;
  }

  function platTile(t) {
    const p = new Painter(16, 16);
    if (t.plat === '#ffffff') {
      p.ellipse(4, 4, 4.5, 3.5, '#ffffff');
      p.ellipse(11, 3.5, 5, 3.5, '#ffffff');
      p.rect(0, 4, 16, 3, '#ffffff');
      p.rect(0, 6, 16, 1, '#e5e0ff');
    } else {
      p.rect(0, 0, 16, 6, t.plat);
      p.rect(0, 0, 16, 1, shade(t.plat, 0.4));
      p.rect(0, 5, 16, 1, shade(t.plat, -0.35));
      p.px(4, 2, shade(t.plat, -0.25));
      p.px(11, 3, shade(t.plat, -0.25));
    }
    return p.c;
  }

  function star(size = 12, color = '#ffd93b') {
    const p = new Painter(size, size);
    const c = size / 2, R = size / 2 - 1, r = R * 0.45;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 ? r : R;
      pts.push([c + Math.cos(a) * rad, c + Math.sin(a) * rad + 0.5]);
    }
    p.poly(pts, color);
    p.px(c - 1, c - 1, '#ffffff');
    return p.outline('#b06a00').c;
  }

  function heart(color = '#ff4f7b') {
    const p = new Painter(9, 8);
    p.pattern(1, 1, ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], color);
    p.px(2, 2, '#ffffff');
    return p.outline().c;
  }

  function flag(active) {
    const p = new Painter(16, 32);
    p.rect(7, 4, 2, 28, '#e8e8f0');
    p.ellipse(8, 3, 2, 2, '#ffd23f');
    p.tri(9, 5, 9, 14, 16, 9.5, active ? '#ff5c8a' : '#a9a3c0');
    if (active) p.px(11, 9, '#ffffff');
    return p.outline().c;
  }

  function castle(t) {
    const p = new Painter(48, 48);
    const wall = t.castle, dark = shade(wall, -0.3);
    p.rect(4, 20, 40, 28, wall);
    p.rect(0, 10, 12, 38, wall);
    p.rect(36, 10, 12, 38, wall);
    for (let x = 0; x < 12; x += 4) { p.rect(x, 6, 2, 4, wall); p.rect(36 + x, 6, 2, 4, wall); }
    for (let x = 14; x < 34; x += 5) p.rect(x, 16, 3, 4, wall);
    p.tri(0, 10, 6, 0, 12, 10, '#ff5c8a');
    p.tri(36, 10, 42, 0, 48, 10, '#ff5c8a');
    p.ellipse(24, 34, 7, 8, OUTLINE);
    p.rect(17, 34, 15, 14, OUTLINE);
    p.rect(4, 22, 3, 4, dark); p.rect(40, 22, 3, 4, dark);
    p.rect(5, 15, 2, 4, OUTLINE); p.rect(41, 15, 2, 4, OUTLINE);
    p.ellipse(24, 26, 2, 2, '#ffd23f');
    return p.outline().c;
  }

  function cloud(color) {
    const p = new Painter(32, 16);
    p.ellipse(9, 10, 7, 5, color);
    p.ellipse(18, 7, 8, 6, color);
    p.ellipse(25, 10, 6, 4.5, color);
    p.rect(4, 10, 24, 4, color);
    return p.outline(shade(color, -0.12)).c;
  }

  function hill(color, w = 96, h = 48) {
    const p = new Painter(w, h);
    p.ellipse(w / 2, h, w / 2, h - 2, color);
    const d = shade(color, -0.12);
    [[w * 0.3, h * 0.55], [w * 0.6, h * 0.4], [w * 0.45, h * 0.75], [w * 0.75, h * 0.7]].forEach(([x, y]) => p.rect(x, y, 2, 3, d));
    return p.outline(shade(color, -0.2)).c;
  }

  function tileset(theme) {
    return {
      grass: groundTile(theme, true),
      dirt: groundTile(theme, false),
      brick: brickTile(theme),
      question: questionTile(false),
      used: questionTile(true),
      plat: platTile(theme),
      star: star(12),
      heart: heart(),
      flagOff: flag(false),
      flagOn: flag(true),
      castle: castle(theme),
      cloud: cloud(theme.cloud),
      hillFar: hill(theme.hillFar, 128, 56),
      hillNear: hill(theme.hillNear, 80, 40),
      blob: [blob(theme.blob, 0), blob(theme.blob, 1), blob(theme.blob, 2)],
    };
  }

  return { animal, animalFrames, tileset, star, heart, shade, OUTLINE };
})();
