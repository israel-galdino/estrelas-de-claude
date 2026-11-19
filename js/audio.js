'use strict';
/* ===== Efeitos sonoros sintetizados (WebAudio) ===== */
const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null;
  const last = {};
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function tone(f0, f1, dur, type = 'square', vol = 0.2, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2, freq = 1200, delay = 0) {
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const defs = {
    hit: () => { tone(260 + Math.random() * 90, 110, 0.06, 'square', 0.08); noise(0.05, 0.08, 2200); },
    crit: () => { tone(700, 160, 0.14, 'square', 0.12); noise(0.12, 0.16, 3200); },
    boom: () => { noise(0.4, 0.28, 420); tone(130, 38, 0.32, 'triangle', 0.22); },
    coin: () => { tone(988, 988, 0.05, 'square', 0.07); tone(1319, 1319, 0.09, 'square', 0.07, 0.05); },
    buy: () => { tone(440, 660, 0.07, 'square', 0.08); tone(660, 990, 0.09, 'square', 0.07, 0.06); },
    comet: () => { [0, 0.07, 0.14, 0.21].forEach((d, k) => tone(660 + k * 220, 880 + k * 220, 0.12, 'triangle', 0.1, d)); },
    warp: () => { tone(70, 1400, 1.1, 'sawtooth', 0.07); noise(1.3, 0.12, 700); },
    unlock: () => { [523, 659, 784, 1046].forEach((f, k) => tone(f, f, 0.16, 'square', 0.08, k * 0.09)); },
    ach: () => { [784, 988, 1175].forEach((f, k) => tone(f, f, 0.12, 'triangle', 0.1, k * 0.07)); },
    zap: () => tone(1100, 320, 0.07, 'sawtooth', 0.04),
    ui: () => tone(520, 620, 0.03, 'square', 0.04),
    deny: () => tone(180, 120, 0.1, 'square', 0.06),
    prestige: () => { tone(60, 2000, 2.0, 'sawtooth', 0.08); noise(2.0, 0.15, 500); [262, 330, 392, 523, 659].forEach((f, k) => tone(f, f, 0.5, 'triangle', 0.08, 1 + k * 0.12)); }
  };
  function play(name, gap = 0.04) {
    if (typeof S === 'undefined' || !S || !S.settings.sound) return;
    init();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    try { defs[name] && defs[name](); } catch (e) { /* áudio indisponível */ }
  }
  return { play, init };
})();
