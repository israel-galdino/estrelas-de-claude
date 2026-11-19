'use strict';
/* ===== Utilidades: RNG, ruído, cores, formatação e fonte bitmap 3x5 ===== */
const U = (() => {
  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.wpick = (items, w) => {
    let s = 0;
    for (const x of w) s += x;
    let r = Math.random() * s;
    for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  };
  U.smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  U.mulberry = seed => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Value noise 3D (suave, determinístico por seed)
  U.noise3 = seed => {
    const r = U.mulberry(seed * 9973 + 17);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const P = new Uint8Array(512);
    for (let i = 0; i < 512; i++) P[i] = p[i & 255];
    const V = new Float32Array(256);
    for (let i = 0; i < 256; i++) V[i] = r();
    return (x, y, z) => {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const X = xi & 255, Y = yi & 255, Z = zi & 255;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      const A = P[X] + Y, B = P[X + 1] + Y;
      const AA = P[A] + Z, AB = P[A + 1] + Z, BA = P[B] + Z, BB = P[B + 1] + Z;
      const x1 = V[P[AA]] + (V[P[BA]] - V[P[AA]]) * u;
      const x2 = V[P[AB]] + (V[P[BB]] - V[P[AB]]) * u;
      const x3 = V[P[AA + 1]] + (V[P[BA + 1]] - V[P[AA + 1]]) * u;
      const x4 = V[P[AB + 1]] + (V[P[BB + 1]] - V[P[AB + 1]]) * u;
      const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
      return y1 + (y2 - y1) * w;
    };
  };
  U.fbm = (n, x, y, z, oct = 4) => {
    let a = 0.5, f = 1, s = 0, t = 0;
    for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, z * f); t += a; a *= 0.5; f *= 2.03; }
    return s / t;
  };

  // Dithering ordenado (Bayer 4x4) — devolve -0.5..0.5
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
  U.bayer = (x, y) => BAY[((y & 3) << 2) + (x & 3)];

  U.hex = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  U.rgb = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  U.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  U.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

  // Sprite a partir de strings; outline opcional gera contorno escuro de 1px
  U.sprite = (rows, pal, outline) => {
    const h = rows.length, w = rows[0].length, o = outline ? 1 : 0;
    const c = U.canvas(w + o * 2, h + o * 2), g = c.getContext('2d');
    const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.' && rows[y][x] !== ' ';
    if (outline) {
      g.fillStyle = typeof outline === 'string' ? outline : '#06060e';
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x + o, y + o, 1, 1);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x + o, y + o, 1, 1);
    }
    return c;
  };
  U.flipX = src => {
    const c = U.canvas(src.width, src.height), g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  };

  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];
  U.fmt = n => {
    if (n === Infinity) return '∞';
    if (!isFinite(n)) return '0';
    if (n < 0) return '-' + U.fmt(-n);
    if (n < 10) return (Math.floor(n * 10) / 10).toFixed(n % 1 > 0.05 ? 1 : 0);
    if (n < 1000) return Math.floor(n).toString();
    const e = Math.floor(Math.log10(n) / 3);
    if (e >= SUF.length) return n.toExponential(2).replace('+', '');
    const v = n / Math.pow(1000, e);
    return (v < 10 ? Math.floor(v * 100) / 100 : v < 100 ? Math.floor(v * 10) / 10 : Math.floor(v)) + SUF[e];
  };
  U.fmtTime = s => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${x}s`;
    return `${x}s`;
  };

  /* ---- Fonte bitmap 3x5 para textos dentro do canvas ---- */
  const GL = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    '+': '000010111010000', '-': '000000111000000', '.': '000000000000010', ',': '000000000010100',
    '!': '010010010000010', '%': '101001010100101', ':': '000010000010000', '/': '001001010100100',
    '?': '111001010000010', ' ': '000000000000000', '×': '000101010101000', '(': '010100100100010',
    ')': '010001001001010', '>': '100010001010100', '<': '001010100010001', '#': '101111101111101',
    '*': '000101010101000', "'": '010010000000000', '=': '000111000111000'
  };
  U.norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  U.textW = (s, sc = 1) => U.norm(s).length * 4 * sc - sc;
  U.text = (ctx, str, x, y, col, sc = 1, align = 'left', shadow = 'rgba(4,3,12,0.9)') => {
    const s = U.norm(str);
    const w = s.length * 4 * sc - sc;
    if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    const draw = (ox, oy, c) => {
      ctx.fillStyle = c;
      for (let k = 0; k < s.length; k++) {
        const g = GL[s[k]] || GL['?'];
        for (let j = 0; j < 15; j++) if (g.charCodeAt(j) === 49) ctx.fillRect(x + ox + k * 4 * sc + (j % 3) * sc, y + oy + Math.floor(j / 3) * sc, sc, sc);
      }
    };
    if (shadow) { draw(sc, 0, shadow); draw(0, sc, shadow); draw(sc, sc, shadow); }
    draw(0, 0, col);
    return w;
  };

  U.store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* sem storage */ } }
  };
  return U;
})();
