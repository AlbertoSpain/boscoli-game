'use strict';

// Sonido chiptune generado con Web Audio (sin archivos externos).
const Sound = (() => {
  let ctx = null;
  let master, musicBus, sfxBus;
  let muted = false;
  let tune = null;
  let pendingTune = null;
  let step = 0;
  let nextTime = 0;
  let timer = null;

  const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function freq(note) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(note);
    if (!m) return 0;
    const semi = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const midi = (Number(m[3]) + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.35;
    sfxBus.connect(master);
    if (pendingTune) playMusic(pendingTune);
  }

  function tone(f, t, dur, type = 'square', vol = 0.5, bus = sfxBus, slide = null) {
    if (!ctx || !f) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(t, dur, vol) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g);
    g.connect(sfxBus);
    src.start(t);
  }

  const arp = (t, notes, gap, dur = 0.15, type = 'square', vol = 0.4) =>
    notes.forEach((n, i) => tone(freq(n), t + i * gap, dur, type, vol));

  const SFX = {
    jump: t => tone(330, t, 0.18, 'square', 0.4, sfxBus, 700),
    star: t => { tone(988, t, 0.08, 'square', 0.35); tone(1319, t + 0.07, 0.2, 'square', 0.35); },
    stomp: t => tone(260, t, 0.15, 'square', 0.5, sfxBus, 80),
    hurt: t => { tone(440, t, 0.12, 'sawtooth', 0.35, sfxBus, 220); tone(330, t + 0.12, 0.2, 'sawtooth', 0.35, sfxBus, 110); },
    bump: t => tone(150, t, 0.1, 'triangle', 0.6),
    block: t => arp(t, ['C5', 'G5', 'C6'], 0.06, 0.12),
    heart: t => arp(t, ['E5', 'G5', 'B5', 'E6'], 0.07, 0.15, 'triangle', 0.6),
    checkpoint: t => arp(t, ['C5', 'E5', 'G5', 'C6'], 0.08),
    select: t => tone(660, t, 0.06, 'square', 0.3),
    move: t => tone(520, t, 0.03, 'square', 0.12),
    mark: t => tone(780, t, 0.07, 'triangle', 0.5),
    found: t => arp(t, ['G5', 'B5', 'D6', 'G6'], 0.06, 0.18, 'square', 0.35),
    nope: t => { tone(200, t, 0.12, 'square', 0.3); tone(150, t + 0.12, 0.18, 'square', 0.3); },
    spell: t => tone(300, t, 0.5, 'sawtooth', 0.2, sfxBus, 1600),
    hit: t => { noise(t, 0.25, 0.4); tone(180, t, 0.2, 'square', 0.35, sfxBus, 60); },
    evil: t => tone(900, t, 0.6, 'sawtooth', 0.18, sfxBus, 120),
    tick: t => tone(1000, t, 0.05, 'square', 0.2),
    poof: t => { noise(t, 0.4, 0.3); arp(t + 0.2, ['C6', 'E6', 'G6', 'C7'], 0.05, 0.12, 'triangle', 0.4); },
    win: t => arp(t, ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.11, 0.2),
    lose: t => arp(t, ['G4', 'F#4', 'F4', 'E4'], 0.22, 0.3, 'triangle', 0.6),
    goal: t => arp(t, ['G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.08, 0.2),
  };

  function play(name) {
    if (!ctx || muted || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.01);
  }

  // Cada token es una corchea; "-" es silencio.
  const TUNES = {
    title: {
      tempo: 132,
      lead: 'C5 E5 G5 E5 F5 A5 G5 - E5 G5 C6 G5 A5 F5 G5 - E5 D5 C5 D5 E5 G5 E5 - D5 E5 F5 E5 D5 B4 C5 -',
      bass: 'C3 - G3 - F3 - C3 - C3 - G3 - F3 - G3 - A2 - E3 - F3 - C3 - D3 - G2 - C3 - G2 -',
    },
    forest: {
      tempo: 150,
      lead: 'G4 C5 E5 G5 E5 C5 D5 E5 F5 A5 F5 D5 E5 G5 E5 - G4 C5 E5 G5 A5 G5 E5 C5 D5 F5 E5 D5 C5 - C5 -',
      bass: 'C3 - G2 - C3 - G2 - F2 - C3 - C3 - G2 - C3 - G2 - F2 - A2 - G2 - B2 - C3 - G2 -',
    },
    cave: {
      tempo: 128,
      lead: 'A4 C5 E5 C5 B4 D5 E5 - A4 C5 E5 A5 G5 E5 D5 - F5 E5 D5 C5 B4 C5 D5 - E5 D5 C5 B4 A4 - - -',
      bass: 'A2 - E3 - G2 - D3 - A2 - E3 - G2 - B2 - F2 - C3 - G2 - D3 - E2 - B2 - A2 - E2 -',
    },
    clouds: {
      tempo: 140,
      lead: 'F5 A5 C6 A5 G5 Bb5 A5 - F5 A5 C6 F6 E6 C6 D6 - C6 A5 F5 A5 G5 E5 C5 - D5 E5 F5 G5 A5 G5 F5 -',
      bass: 'F3 - C3 - Bb2 - C3 - F3 - A2 - Bb2 - C3 - D3 - A2 - Bb2 - C3 - Bb2 - C3 - F2 - C3 -',
    },
    battle: {
      tempo: 172,
      lead: 'E5 E5 G5 E5 A5 G5 F#5 D5 E5 E5 G5 B5 A5 G5 F#5 - C6 B5 A5 G5 F#5 G5 A5 F#5 G5 F#5 E5 D#5 E5 - E5 -',
      bass: 'E2 E3 E2 E3 C3 C3 D3 D3 E2 E3 E2 E3 C3 C3 B2 B2 A2 A3 A2 A3 B2 B3 B2 B3 E2 E3 B2 B3 E2 - E2 -',
    },
    victory: {
      tempo: 120,
      lead: 'C5 E5 G5 C6 - G5 C6 E6 D6 - B5 - G5 - - - A5 C6 A5 F5 G5 B5 G5 D5 C5 E5 G5 C6 - - - -',
      bass: 'C3 - G3 - C3 - G3 - G2 - D3 - G2 - D3 - F2 - C3 - G2 - D3 - C3 - G2 - C3 - - -',
    },
  };

  function schedule() {
    if (!tune) return;
    while (nextTime < ctx.currentTime + 0.15) {
      const lead = tune.lead[step % tune.lead.length];
      if (lead !== '-') tone(freq(lead), nextTime, tune.spb * 0.9, 'square', 0.5, musicBus);
      const bass = tune.bass[step % tune.bass.length];
      if (bass !== '-') tone(freq(bass), nextTime, tune.spb * 1.8, 'triangle', 0.9, musicBus);
      nextTime += tune.spb;
      step++;
    }
  }

  function stopMusic() {
    clearInterval(timer);
    timer = null;
    tune = null;
  }

  function playMusic(name) {
    pendingTune = name;
    if (!ctx) return;
    if (tune && tune.name === name) return;
    stopMusic();
    const def = TUNES[name];
    if (!def) return;
    tune = {
      name,
      lead: def.lead.split(/\s+/),
      bass: def.bass.split(/\s+/),
      spb: 60 / def.tempo / 2,
    };
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(schedule, 40);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.6;
    return muted;
  }

  return { init, play, playMusic, stopMusic, toggleMute, isMuted: () => muted };
})();
