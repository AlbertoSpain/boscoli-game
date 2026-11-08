'use strict';

const WordSearch = (() => {
  const DIRS = { h: [[0, 1]], v: [[1, 0]], d: [[1, 1], [-1, 1]] };
  const FILLER = 'AAAEEEIIOOUUBCDFGLLMNNPRRSSTTVZ';

  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function tryBuild(words, size, dirs) {
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const placements = [];
    const sorted = [...words].sort((a, b) => b.word.length - a.word.length);
    for (const item of sorted) {
      const L = item.word.length;
      const options = [];
      for (const [dr, dc] of dirs) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const er = r + dr * (L - 1), ec = c + dc * (L - 1);
            if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
            let fits = true;
            for (let i = 0; i < L && fits; i++) {
              const cell = grid[r + dr * i][c + dc * i];
              if (cell !== null && cell !== item.word[i]) fits = false;
            }
            if (fits) options.push({ r, c, dr, dc });
          }
        }
      }
      if (!options.length) return null;
      const o = options[Math.floor(Math.random() * options.length)];
      const cells = [];
      for (let i = 0; i < L; i++) {
        const r = o.r + o.dr * i, c = o.c + o.dc * i;
        grid[r][c] = item.word[i];
        cells.push([r, c]);
      }
      placements.push({ ...item, cells });
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) grid[r][c] = FILLER[Math.floor(Math.random() * FILLER.length)];
      }
    }
    const order = w => words.findIndex(x => x.word === w.word);
    placements.sort((a, b) => order(a) - order(b));
    return { grid, placements, size };
  }

  // pool: [[PALABRA, emoji], ...]
  function create(pool, size, count, dirKeys) {
    const dirs = [...dirKeys].flatMap(k => DIRS[k] || []);
    const candidates = shuffle(pool.filter(([w]) => w.length <= size));
    for (let n = Math.min(count, candidates.length); n > 0; n--) {
      const words = candidates.slice(0, n).map(([word, emoji]) => ({ word, emoji }));
      for (let attempt = 0; attempt < 60; attempt++) {
        const result = tryBuild(words, size, dirs);
        if (result) return result;
      }
    }
    throw new Error('No se pudo crear la sopa de letras');
  }

  // Devuelve las celdas en línea recta entre a y b (incluidas) o null.
  function line(a, b) {
    const dr = b[0] - a[0], dc = b[1] - a[1];
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const sr = Math.sign(dr), sc = Math.sign(dc);
    const cells = [];
    for (let i = 0; i <= steps; i++) cells.push([a[0] + sr * i, a[1] + sc * i]);
    return cells;
  }

  function sameCells(x, y) {
    return x.length === y.length && x.every((c, i) => c[0] === y[i][0] && c[1] === y[i][1]);
  }

  // Busca una palabra no encontrada que coincida con la selección (en ambos sentidos).
  function match(puzzle, cells, foundSet) {
    if (!cells) return null;
    const reversed = [...cells].reverse();
    return puzzle.placements.find(p => !foundSet.has(p.word) && (sameCells(p.cells, cells) || sameCells(p.cells, reversed))) || null;
  }

  return { create, line, match, shuffle };
})();

if (typeof module !== 'undefined') module.exports = WordSearch;
