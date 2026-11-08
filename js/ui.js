'use strict';

const FONT = "'Press Start 2P', monospace";

const UI = {
  text(ctx, str, x, y, { size = 16, color = '#ffffff', align = 'left', shadow = '#2b1d3a', baseline = 'top' } = {}) {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.fillStyle = shadow;
      const o = Math.min(4, Math.max(2, Math.round(size / 6)));
      ctx.fillText(str, x + o, y + o);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  wrap(ctx, str, maxWidth, size) {
    ctx.font = `${size}px ${FONT}`;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  },

  paragraph(ctx, str, x, y, maxWidth, opts = {}) {
    const size = opts.size || 16;
    const lh = opts.lineHeight || Math.round(size * 1.7);
    const lines = UI.wrap(ctx, str, maxWidth, size);
    lines.forEach((l, i) => UI.text(ctx, l, x, y + i * lh, opts));
    return lines.length * lh;
  },

  panel(ctx, x, y, w, h, { fill = '#fff8e7', border = '#2b1d3a', radius = 12 } = {}) {
    ctx.fillStyle = border;
    UI.roundRect(ctx, x - 4, y - 4, w + 8, h + 8, radius + 3);
    ctx.fill();
    ctx.fillStyle = fill;
    UI.roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  sprite(ctx, img, x, y, scale, flip = false) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(Math.round(x + img.width * scale), Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
    } else {
      ctx.drawImage(img, Math.round(x), Math.round(y), img.width * scale, img.height * scale);
    }
    ctx.restore();
  },

  sky(ctx, theme, w, h, t = 0) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (theme.stars) {
      for (let i = 0; i < 60; i++) {
        const sx = (i * 157) % w, sy = (i * 89) % (h * 0.7);
        const tw = (Math.sin(t / 20 + i) + 1) / 2;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`;
        ctx.fillRect(sx, sy, 3, 3);
      }
    }
    if (theme.sun) {
      ctx.fillStyle = '#fff4b8';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.22, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe680';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.22, 42, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
