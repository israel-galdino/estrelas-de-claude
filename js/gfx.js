'use strict';
/* ===== Gráficos procedurais em pixel art: asteroides, planetas, nebulosas, estação, ícones (naves: js/ships.js) ===== */
const GFX = (() => {
  const X = {};
  const norm3 = v => { const m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; };
  const LIGHT = norm3([-0.55, -0.62, 0.56]);
  X.LIGHT = LIGHT; // usada também pelo gerador de naves (ships.js)

  /* ---------- Asteroide: rocha irregular, crateras, veios de minério, rotação no plano ---------- */
  X.makeAsteroid = function (o) {
    const R = o.r, S = Math.ceil(R * 2.5) + 4, N = o.frames || 24, half = S / 2;
    const rnd = U.mulberry(o.seed);
    const nA = U.noise3(o.seed), nB = U.noise3(o.seed + 7777);
    const harm = [];
    for (let k = 2; k <= 6; k++) harm.push([k, (rnd() * 0.12 + 0.02) / (k * 0.6), rnd() * 6.2832]);
    const shape = th => { let v = 0.9; for (const h of harm) v += h[1] * Math.sin(h[0] * th + h[2]); return v; };
    const craters = [];
    const nc = 1 + Math.floor(rnd() * 3 + R / 6);
    for (let i = 0; i < nc; i++) {
      const z = 0.3 + rnd() * 0.7, a = rnd() * 6.2832, s = Math.sqrt(1 - z * z);
      const cr = 0.16 + rnd() * 0.26;
      craters.push([s * Math.cos(a), s * Math.sin(a), z, Math.cos(cr), Math.cos(cr * 1.3)]);
    }
    const n = S * S;
    const ins = new Uint8Array(n), NX = new Float32Array(n), NY = new Float32Array(n), NZ = new Float32Array(n);
    const AL = new Float32Array(n), OR = new Uint8Array(n);
    const thr = 0.7 - (o.density || 0);
    for (let gy = 0; gy < S; gy++) for (let gx = 0; gx < S; gx++) {
      const ox = gx + 0.5 - half, oy = gy + 0.5 - half;
      const Re = R * shape(Math.atan2(oy, ox));
      if (Math.hypot(ox, oy) > Re) continue;
      const i = gy * S + gx;
      ins[i] = 1;
      const u = ox / Re, v = oy / Re, w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      const f = 2.4, e = 0.07;
      const h0 = U.fbm(nA, u * f + 9, v * f + 9, w * f + 9, 3);
      const hx = U.fbm(nA, (u + e) * f + 9, v * f + 9, w * f + 9, 3);
      const hy = U.fbm(nA, u * f + 9, (v + e) * f + 9, w * f + 9, 3);
      let nx = u - (hx - h0) * 6, ny = v - (hy - h0) * 6, nz = w + 0.12;
      let alb = h0;
      for (const c of craters) {
        const d = u * c[0] + v * c[1] + w * c[2];
        if (d > c[3]) { nx -= (u - c[0]) * 1.7; ny -= (v - c[1]) * 1.7; alb -= 0.1; }
        else if (d > c[4]) { nx += (u - c[0]) * 0.9; ny += (v - c[1]) * 0.9; alb += 0.08; }
      }
      const m = Math.hypot(nx, ny, nz) || 1;
      NX[i] = nx / m; NY[i] = ny / m; NZ[i] = nz / m; AL[i] = alb;
      if (o.density > 0) {
        const ov = nB(u * 3.4 + 3, v * 3.4 + 3, w * 3.4 + 3) * 0.7 + nB(u * 9 + 1, v * 9 + 1, w * 9 + 1) * 0.3;
        if (ov > thr) OR[i] = ov > thr + 0.05 && rnd() < 0.45 ? 2 : 1;
      }
    }
    const rock = o.rock.map(U.hex), ore = o.ore.map(U.hex);
    const outl = rock[0].map(v => v * 0.4);
    const frames = [];
    for (let f = 0; f < N; f++) {
      const ang = (f / N) * 6.2832, ca = Math.cos(ang), sa = Math.sin(ang);
      const lx = LIGHT[0] * ca + LIGHT[1] * sa, ly = -LIGHT[0] * sa + LIGHT[1] * ca, lz = LIGHT[2];
      const c = U.canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
      const mask = new Uint8Array(n);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - half, dy = y + 0.5 - half;
        const gx = Math.floor(dx * ca + dy * sa + half), gy = Math.floor(-dx * sa + dy * ca + half);
        if (gx < 0 || gy < 0 || gx >= S || gy >= S) continue;
        const i = gy * S + gx;
        if (!ins[i]) continue;
        const p = y * S + x;
        mask[p] = 1;
        const dif = Math.max(0, NX[i] * lx + NY[i] * ly + NZ[i] * lz);
        const val = 0.05 + dif * 0.95 + (AL[i] - 0.5) * 0.55;
        const b = U.bayer(x, y);
        let col;
        if (OR[i]) {
          let k = Math.floor(val * 4 + 1 + b * 0.8);
          if (o.glow) k = Math.max(k, 2);
          if (OR[i] === 2 && ((i * 7 + f * 3) % N) < 2) k = 5;
          col = k >= 5 ? [255, 255, 255] : ore[U.clamp(k, 0, 4)];
        } else col = rock[U.clamp(Math.floor(val * 5 + b * 0.9), 0, 4)];
        const q = p * 4;
        d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2]; d[q + 3] = 255;
      }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const p = y * S + x;
        if (mask[p]) continue;
        if ((x > 0 && mask[p - 1]) || (x < S - 1 && mask[p + 1]) || (y > 0 && mask[p - S]) || (y < S - 1 && mask[p + S])) {
          const q = p * 4;
          d[q] = outl[0]; d[q + 1] = outl[1]; d[q + 2] = outl[2]; d[q + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      frames.push(c);
    }
    return { frames, S, R };
  };

  /* ---------- Planeta com textura esférica rotativa, atmosfera e anéis ---------- */
  X.Planet = class {
    constructor(def, D, seed) {
      this.def = def; this.D = D;
      const TW = 192, TH = 96;
      this.TW = TW; this.TH = TH;
      const tex = new Float32Array(TW * TH), emi = new Float32Array(TW * TH);
      const n1 = U.noise3(seed), n2 = U.noise3(seed + 31);
      for (let ty = 0; ty < TH; ty++) {
        const lat = (ty / (TH - 1) - 0.5) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
        for (let tx = 0; tx < TW; tx++) {
          const lon = (tx / TW) * Math.PI * 2;
          const px = cl * Math.cos(lon), pz = cl * Math.sin(lon), py = sl;
          let v = 0, e = 0;
          switch (def.type) {
            case 'rock': {
              v = U.smooth(0.32, 0.7, U.fbm(n1, px * 2 + 4, py * 2 + 4, pz * 2 + 4, 5));
              const c = U.fbm(n2, px * 5, py * 5, pz * 5, 2);
              if (c > 0.6) v *= 0.7;
              break;
            }
            case 'gas': {
              const w = U.fbm(n1, px * 1.6, py * 1.6, pz * 1.6, 4);
              v = 0.5 + 0.42 * Math.sin(lat * def.bands + w * 2.6) + (U.fbm(n2, px * 6, py * 14, pz * 6, 2) - 0.5) * 0.35;
              const st = U.fbm(n2, px * 3 + 7, py * 3, pz * 3, 3);
              if (st > 0.66) v = 0.97;
              break;
            }
            case 'lava': {
              v = U.fbm(n1, px * 2.5, py * 2.5, pz * 2.5, 4) * 0.8;
              const c = Math.abs(U.fbm(n2, px * 3, py * 3, pz * 3, 4) - 0.5);
              e = U.clamp(1 - c * 16, 0, 1);
              break;
            }
            case 'ice':
              v = U.fbm(n1, px * 2.2, py * 2.2, pz * 2.2, 5) * 0.8 + Math.pow(Math.abs(sl), 6) * 0.6;
              break;
            case 'crystal': {
              const f = U.fbm(n1, px * 2, py * 2, pz * 2, 3) * 7;
              v = Math.floor(f) / 7 + 0.15;
              const fr = f % 1;
              e = fr < 0.07 || fr > 0.93 ? 0.9 : 0;
              break;
            }
            case 'dark': {
              v = U.fbm(n1, px * 2, py * 2, pz * 2, 4) * 0.5;
              const s = U.fbm(n2, px * 2.5 + v * 2, py * 6, pz * 2.5, 4);
              e = U.clamp((s - 0.55) * 6, 0, 1);
              break;
            }
            case 'star':
              v = U.fbm(n1, px * 6, py * 6, pz * 6, 3);
              e = 1;
              break;
          }
          tex[ty * TW + tx] = U.clamp(v, 0, 1);
          emi[ty * TW + tx] = e;
        }
      }
      this.tex = tex; this.emi = emi;
      this.pal = def.pal.map(U.hex);
      this.emiPal = def.emi.map(U.hex);
      this.atm = U.hex(def.atm);
      const r = D / 2;
      this.r = r;
      const P = Math.ceil(D) + 2;
      this.P = P;
      this.cv = U.canvas(P, P);
      this.g = this.cv.getContext('2d');
      this.img = this.g.createImageData(P, P);
      const tilt = def.tilt || 0, ct = Math.cos(tilt), st = Math.sin(tilt);
      const L = norm3([-0.75, -0.45, 0.5]);
      const idx = [], tyA = [], lonA = [], difA = [], rimA = [], bA = [];
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const u = (x + 0.5 - P / 2) / r, v = (y + 0.5 - P / 2) / r, d2 = u * u + v * v;
        if (d2 > 1) continue;
        const w = Math.sqrt(1 - d2);
        const ut = u * ct + v * st, vt = -u * st + v * ct;
        idx.push((y * P + x) * 4);
        tyA.push(Math.round((Math.asin(U.clamp(vt, -1, 1)) / Math.PI + 0.5) * (TH - 1)));
        lonA.push(Math.atan2(ut, w));
        difA.push(Math.max(0, u * L[0] + v * L[1] + w * L[2]));
        rimA.push(1 - w);
        bA.push(U.bayer(x, y));
      }
      this.cnt = idx.length;
      this.idx = Int32Array.from(idx); this.ty = Int16Array.from(tyA); this.lon = Float32Array.from(lonA);
      this.dif = Float32Array.from(difA); this.rim = Float32Array.from(rimA); this.bay = Float32Array.from(bA);

      // Halo atmosférico pontilhado
      const isStar = def.type === 'star';
      const hw = isStar ? Math.ceil(r * 0.9) : Math.max(3, Math.round(r * 0.09));
      this.hw = hw;
      const HS = P + hw * 2;
      this.halo = U.canvas(HS, HS);
      const hg = this.halo.getContext('2d');
      const ac = isStar ? this.pal[2] : this.atm;
      for (let y = 0; y < HS; y++) for (let x = 0; x < HS; x++) {
        const dx = x + 0.5 - HS / 2, dy = y + 0.5 - HS / 2, dist = Math.hypot(dx, dy);
        if (dist <= r - 0.5 || dist > r + hw) continue;
        let a = 1 - (dist - r) / hw;
        const lit = isStar ? 1 : 0.25 + 0.75 * U.clamp(-(dx * 0.75 + dy * 0.45) / dist + 0.3, 0, 1);
        a = a * a * lit;
        const lv = Math.floor(a * 4 + U.bayer(x, y) * 0.9);
        if (lv <= 0) continue;
        hg.fillStyle = U.rgb(ac, Math.min(0.85, lv * (isStar ? 0.22 : 0.17)));
        hg.fillRect(x, y, 1, 1);
      }

      // Anéis: metade de trás e metade da frente
      if (def.ring) {
        const rg = def.ring, ro = rg.outer * r, ri = rg.inner * r, flat = rg.flat, ca = Math.cos(rg.tilt), sa = Math.sin(rg.tilt);
        const RS = Math.ceil(ro * 2) + 4;
        this.ringBack = U.canvas(RS, RS); this.ringFront = U.canvas(RS, RS);
        const gb = this.ringBack.getContext('2d'), gf = this.ringFront.getContext('2d');
        const rn = U.noise3(seed + 5);
        const rc = rg.col.map(U.hex);
        for (let y = 0; y < RS; y++) for (let x = 0; x < RS; x++) {
          const dx = x + 0.5 - RS / 2, dy = y + 0.5 - RS / 2;
          const rx = dx * ca + dy * sa, ry = -dx * sa + dy * ca;
          const e = Math.sqrt(rx * rx + (ry / flat) * (ry / flat));
          if (e < ri || e > ro) continue;
          const t = (e - ri) / (ro - ri);
          const band = rn(t * 22, 0.5, 0.5) * 0.75 + rn(t * 60, 3.5, 0.5) * 0.25;
          if (band < 0.36) continue;
          // sombra do planeta sobre o anel (lado oposto à luz)
          const shadow = ry > 0 && rx > 0 && Math.abs(rx) < r * 1.05 && (dx * 0.75 + dy * 0.45) > 0 ? 0.45 : 1;
          const k = U.clamp(Math.floor((band - 0.36) * 4.5 + U.bayer(x, y) * 0.8), 0, 2);
          const col = rc[k].map(c => c * shadow);
          const g = ry < 0 ? gb : gf;
          g.fillStyle = U.rgb(col, 0.55 + k * 0.2);
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    render(t) {
      const d = this.img.data, def = this.def, pal = this.pal, ep = this.emiPal, atm = this.atm;
      const TW = this.TW, tex = this.tex, emi = this.emi, isStar = def.type === 'star';
      const off = t * (def.spin || 0.05);
      const k2pi = TW / 6.2832;
      for (let k = 0; k < this.cnt; k++) {
        let tx = Math.floor((this.lon[k] + off) * k2pi) % TW;
        if (tx < 0) tx += TW;
        const ti = this.ty[k] * TW + tx;
        const v = tex[ti], e = emi[ti], dif = this.dif[k], b = this.bay[k], rim = this.rim[k];
        let col;
        if (isStar) {
          const li = U.clamp(Math.floor((0.55 + v * 0.7 - rim * 0.5) * 5 + b), 0, 4);
          col = pal[li];
        } else {
          const lum = dif * (0.5 + v * 0.65) + v * 0.06;
          col = pal[U.clamp(Math.floor(lum * 6 + b), 0, 5)];
          if (e > 0.12) {
            const ei = U.clamp(Math.floor(e * 3 + b * 0.8), 0, 2);
            if (ei > 0 || dif < 0.3) col = ep[ei];
          }
          if (rim > 0.72) {
            const a = ((rim - 0.72) / 0.28) * (0.25 + dif * 0.75);
            if (a + b * 0.5 > 0.3) col = U.mix(col, atm, Math.min(0.85, a));
          }
        }
        const q = this.idx[k];
        d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2]; d[q + 3] = 255;
      }
      this.g.putImageData(this.img, 0, 0);
    }
    drawTo(c, x, y) {
      x = Math.round(x); y = Math.round(y);
      if (this.ringBack) c.drawImage(this.ringBack, x - (this.ringBack.width >> 1), y - (this.ringBack.height >> 1));
      c.drawImage(this.halo, x - (this.halo.width >> 1), y - (this.halo.height >> 1));
      c.drawImage(this.cv, x - (this.P >> 1), y - (this.P >> 1));
      if (this.ringFront) c.drawImage(this.ringFront, x - (this.ringFront.width >> 1), y - (this.ringFront.height >> 1));
    }
  };

  /* ---------- Nebulosa de fundo com dithering + estrelas fixas ---------- */
  X.makeNebula = (W, H, neb, seed) => {
    const c = U.canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const n = U.noise3(seed), m = U.noise3(seed + 3);
    const C = neb.c.map(U.hex), A = neb.alt.map(U.hex);
    const sc = 3 / Math.max(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const X0 = x * sc, Y0 = y * sc;
      const q = U.fbm(n, X0, Y0, 0.5, 3);
      const v = U.fbm(n, X0 * 1.4 + q * 2.4, Y0 * 1.4 + q * 2.4, 2.5, 5);
      const dens = U.smooth(0.4, 0.72, v);
      const hue = U.fbm(m, X0 * 0.9, Y0 * 0.9, 1.1, 3);
      const b = U.bayer(x, y);
      const k = U.clamp(Math.floor(dens * 3.99 + b * 0.9), 0, 3);
      let col = C[k];
      if (k > 0 && hue + b * 0.05 > 0.53) col = A[k - 1];
      const i = (y * W + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    const r = U.mulberry(seed + 9), sc2 = U.hex(neb.star);
    const count = Math.floor((W * H) / 120);
    for (let s = 0; s < count; s++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * H), br = r();
      const i = (y * W + x) * 4, f = br < 0.75 ? 0.25 + br * 0.45 : 0.9;
      const col = br > 0.93 ? sc2 : [235, 240, 255];
      d[i] = Math.max(d[i], col[0] * f); d[i + 1] = Math.max(d[i + 1], col[1] * f); d[i + 2] = Math.max(d[i + 2], col[2] * f);
    }
    g.putImageData(img, 0, 0);
    for (let s = 0; s < count / 45; s++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * H);
      g.fillStyle = neb.star;
      g.globalAlpha = 0.5; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      g.globalAlpha = 0.2; g.fillRect(x - 3, y, 7, 1); g.fillRect(x, y - 3, 1, 7);
      g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
    }
    return c;
  };

  X.makeVignette = (W, H) => {
    const c = U.canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#020108';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
      const d = Math.sqrt(dx * dx * 0.7 + dy * dy * 0.9);
      const a = (d - 0.78) * 2.2;
      if (a > U.bayer(x, y) + 0.5) g.fillRect(x, y, 1, 1);
    }
    return c;
  };

  /* ---------- Brilho pixelado (aditivo) ---------- */
  const glowCache = {};
  X.glow = (col, r) => {
    const key = col + r;
    if (glowCache[key]) return glowCache[key];
    const S = r * 2 + 1, c = U.canvas(S, S), g = c.getContext('2d'), rgb = U.hex(col);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - r, y - r) / (r + 0.5);
      if (d >= 1) continue;
      const lv = Math.floor((1 - d) * 4) / 4;
      if (lv <= 0) continue;
      g.fillStyle = U.rgb(rgb, Math.pow(lv, 1.6) * 0.85);
      g.fillRect(x, y, 1, 1);
    }
    glowCache[key] = c;
    return c;
  };

  /* ---------- Estação orbital ---------- */
  const HULL = ['#121524', '#262c48', '#434d74', '#6f7ba6', '#a9b3d8', '#e6eaff'];
  const stCache = {};
  X.ST_CX = 36; X.ST_CY = 32;
  X.sphere = (g, cx, cy, r, pal) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d2 = (x * x + y * y) / (r * r);
      if (d2 > 1) continue;
      const z = Math.sqrt(1 - d2);
      const dif = Math.max(0, (x / r) * LIGHT[0] + (y / r) * LIGHT[1] + z * LIGHT[2]);
      const k = U.clamp(Math.floor((0.1 + dif * 0.95) * pal.length + U.bayer(x + cx, y + cy) * 0.9), 0, pal.length - 1);
      g.fillStyle = pal[k];
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  };
  X.stationBase = (lvl, turret) => {
    const key = lvl + '|' + (turret ? 1 : 0);
    if (stCache[key]) return stCache[key];
    const W = 76, H = 64, cx = X.ST_CX, cy = X.ST_CY;
    const c = U.canvas(W, H), g = c.getContext('2d');
    const P = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const panel = (x, y, w, h) => {
      P('#070b22', x - 1, y - 1, w + 2, h + 2);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const grid = i % 4 === 3 || j % 3 === 2;
        let col = grid ? '#16245e' : j % 3 === 0 ? '#3a7ae0' : '#2459b0';
        if (!grid && (i + j * 2) % 11 === 0) col = '#8ac4ff';
        P(col, x + i, y + j);
      }
    };
    const truss = (x, y, w) => { P(HULL[1], x, y, w, 2); for (let i = 0; i < w; i += 3) P(HULL[3], x + i, y); };
    const vtruss = (x, y, h) => { P(HULL[1], x, y, 2, h); for (let i = 0; i < h; i += 3) P(HULL[3], x, y + i); };

    // módulos extras (progressão visual da estação)
    if (lvl >= 1) { vtruss(cx + 10, cy - 20, 10); truss(cx + 4, cy - 20, 10); panel(cx + 14, cy - 27, 16, 8); }
    if (lvl >= 3) { vtruss(cx - 14, cy + 13, 8); panel(cx - 34, cy + 17, 20, 7); truss(cx - 14, cy + 20, 6); }
    if (lvl >= 4) {
      truss(cx - 22, cy - 22, 18);
      for (let x = 0; x < 14; x++) {
        const cols = [HULL[4], HULL[3], HULL[3], HULL[2], HULL[1], HULL[0]];
        for (let y = 0; y < 6; y++) P(cols[y], cx - 30 + x, cy - 25 + y);
        if (x % 3 === 1) P('#ffe9a0', cx - 30 + x, cy - 23);
      }
      P(HULL[0], cx - 31, cy - 25, 1, 6); P(HULL[0], cx - 16, cy - 25, 1, 6);
    }
    // painéis solares principais
    truss(6, cy - 1, 20);
    panel(3, cy - 14, 20, 10);
    panel(3, cy + 4, 20, 10);
    // espinha central
    const scol = [HULL[1], HULL[4], HULL[3], HULL[3], HULL[2], HULL[2], HULL[1], HULL[0]];
    for (let y = 6; y < 55; y++) for (let i = 0; i < 8; i++) P(y % 6 === 0 && i > 0 && i < 7 ? HULL[1] : scol[i], cx - 4 + i, y);
    // antena
    P(HULL[3], cx, 0, 1, 6); P(HULL[2], cx - 3, 3, 7, 1); P(HULL[4], cx - 2, 2, 1, 1); P(HULL[4], cx + 2, 2, 1, 1);
    // braço de doca
    for (let y = 0; y < 7; y++) P([HULL[4], HULL[3], HULL[3], HULL[2], HULL[2], HULL[1], HULL[0]][y], cx + 8, cy - 3 + y, 11, 1);
    for (let x = cx + 9; x < cx + 19; x += 3) P(HULL[1], x, cy - 3, 1, 7);
    // baia de atracação
    P(HULL[0], cx + 18, cy - 9, 13, 19);
    for (let y = 0; y < 17; y++) P(y < 2 ? HULL[4] : y < 5 ? HULL[3] : y < 12 ? HULL[2] : HULL[1], cx + 19, cy - 8 + y, 11, 1);
    P('#04050b', cx + 24, cy - 5, 6, 11);
    P('#0a0d1c', cx + 24, cy - 5, 6, 2);
    for (let i = 0; i < 11; i++) P(i % 2 ? '#ffcc33' : '#1a1a1a', cx + 23, cy - 5 + i);
    // segundo hangar
    if (lvl >= 2) {
      P(HULL[0], cx + 4, cy + 14, 14, 9);
      for (let y = 0; y < 7; y++) P([HULL[4], HULL[3], HULL[2], HULL[2], HULL[1], HULL[1], HULL[0]][y], cx + 5, cy + 15 + y, 12, 1);
      P('#04050b', cx + 12, cy + 17, 5, 4);
      // antena parabólica
      for (let i = 0; i < 9; i++) P(i < 4 ? HULL[4] : HULL[2], cx + 20 + i, cy + 21 - Math.round(Math.abs(i - 4) * 0.6));
      P(HULL[3], cx + 24, cy + 15, 1, 6); P(HULL[5], cx + 24, cy + 14);
    }
    // núcleo esférico
    X.sphere(g, cx, cy, 10, HULL);
    for (let x = -10; x <= 10; x++) {
      const yy = Math.round(Math.sqrt(Math.max(0, 1 - (x * x) / 100)) * 1.2);
      const colA = x < -4 ? '#ffb060' : x < 3 ? '#d0601c' : '#7a2e10';
      if (Math.abs(x) <= 9) { P(colA, cx + x, cy - 1 + yy - 1); P(x < 0 ? '#7a2e10' : '#4a1a08', cx + x, cy + yy); }
    }
    for (let x = -7; x <= 7; x += 3) P('#ffe9a0', cx + x, cy - 4);
    // reator
    P(HULL[2], cx - 6, 54, 12, 2); P(HULL[1], cx - 5, 56, 10, 2); P('#0b3a44', cx - 3, 58, 6, 2);
    if (turret) { P(HULL[1], cx - 3, cy - 12, 7, 2); P(HULL[3], cx - 2, cy - 13, 5, 1); }
    stCache[key] = c;
    return c;
  };
  const ringDraw = (ctx, x, y, t, back) => {
    const a = 23, b = 6;
    for (let i = 0; i < 170; i++) {
      const th = (i / 170) * 6.2832, s = Math.sin(th), co = Math.cos(th);
      if (back ? s >= 0 : s < 0) continue;
      const px = Math.round(x + co * a), py = Math.round(y + s * b);
      ctx.fillStyle = back ? (co < 0 ? '#3a4266' : '#262c48') : co < 0 ? '#a9b3d8' : '#5f6a96';
      ctx.fillRect(px, py, 1, 2);
      if (!back) {
        ctx.fillStyle = co < 0 ? '#e6eaff' : '#8a96c0';
        ctx.fillRect(px, py, 1, 1);
        const seg = ((th / 6.2832) * 14 + t * 0.5) % 1;
        if (seg < 0.1) { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(px, py + 1, 1, 1); }
      }
    }
  };
  X.drawStation = (ctx, x, y, t, o) => {
    const cx = X.ST_CX, cy = X.ST_CY, ox = x - cx, oy = y - cy;
    ringDraw(ctx, x, y + 2, t, true);
    ctx.drawImage(X.stationBase(o.lvl, o.turret), ox, oy);
    ringDraw(ctx, x, y + 2, t, false);
    // janelas piscando no núcleo
    for (let k = 0; k < 5; k++) {
      const on = Math.sin(t * 1.7 + k * 2.1) > -0.3;
      ctx.fillStyle = on ? '#ffe9a0' : '#5a4a2a';
      ctx.fillRect(x - 7 + k * 3, y - 4, 1, 1);
    }
    // luzes da doca em sequência
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(t * 6) % 5 === i;
      ctx.fillStyle = on ? '#ffe066' : '#4a3a12';
      ctx.fillRect(x + 30, y - 4 + i * 2, 1, 1);
    }
    ctx.globalCompositeOperation = 'lighter';
    // farol da antena
    if ((t * 1.2) % 1 < 0.35) { ctx.drawImage(X.glow('#ff3a3a', 4), x - 4, oy - 4); ctx.fillStyle = '#ffd0d0'; ctx.fillRect(x, oy, 1, 1); }
    // reator pulsante
    const pu = 0.55 + 0.45 * Math.sin(t * 4);
    ctx.globalAlpha = pu;
    ctx.drawImage(X.glow('#3ef0ff', 6), x - 6, oy + 54);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d8ffff'; ctx.fillRect(x - 1, oy + 59, 2, 1);
    for (let i = 0; i < 3; i++) {
      const fy = oy + 61 + ((t * 20 + i * 4) % 8);
      ctx.globalAlpha = 1 - ((t * 20 + i * 4) % 8) / 8;
      ctx.fillStyle = '#3ef0ff'; ctx.fillRect(x - 1 + (i % 2), Math.round(fy), 1, 1);
    }
    ctx.globalAlpha = 1;
    // brilho da baia quando drones chegam
    if (o.dockGlow > 0) { ctx.globalAlpha = Math.min(1, o.dockGlow); ctx.drawImage(X.glow('#ffd23f', 5), x + 22, y - 5); ctx.globalAlpha = 1; }
    // fornalha ativa
    if (o.refine) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 9);
      ctx.drawImage(X.glow('#ff7a20', 4), x - 4, y + 10);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    // canhão da torreta
    if (o.turret) {
      const bx = x, by = y - 13;
      ctx.fillStyle = '#a9b3d8';
      for (let i = 1; i <= 5; i++) ctx.fillRect(Math.round(bx + Math.cos(o.tang) * i), Math.round(by + Math.sin(o.tang) * i), 1, 1);
      if (o.muzzle > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(X.glow('#5ef2ff', 3), Math.round(bx + Math.cos(o.tang) * 6) - 3, Math.round(by + Math.sin(o.tang) * 6) - 3);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  };

  /* Drones: os sprites ficam no catálogo de naves (js/ships.js, design 'flecha'). */

  /* ---------- Retratos de comunicação (24×24, meia grade espelhada) ---------- */
  // h/m/d = casco claro/médio/escuro, v = visor, e/E = olhos, g = grade da boca, a = luz da antena
  const FACE = [
    '...........k', '...........a', '...........k', '.......kkkkk', '.....kkhhhhh', '....khhhhhhh',
    '...khhmmmmmm', '...khmmmmmmm', '..khmmmmmmmm', '..kmmkkkkkkk', '..kmkvvvvvvv', '..kmkvEeevvv',
    '..kmkveeevvv', '..kmkvvvvvvv', '..kmmkkkkkkk', '..kdmmmmmmmm', '...kdmmmgggg', '...kdmmmkkkk',
    '....kddmmmmm', '.....kkddddd', '.......kkkkk', '........kddd', '...kkkkkdddd', '.kkddddddddd'
  ];
  const portCache = {};
  // Quadros: 0 neutro, 1-2 falando, 3 piscando. Luz vem da esquerda (como em LIGHT): lado direito um tom mais escuro.
  X.portrait = id => {
    if (portCache[id]) return portCache[id];
    const pal = PORTRAITS[id].pal;
    const base = FACE.map(r => (r + r.split('').reverse().join('')).split('').map((ch, x) => (x >= 16 ? ({ h: 'm', m: 'd' }[ch] || ch) : ch)).join(''));
    const vary = f => base.map((row, y) => {
      if (f === 1 && y === 16) return row.replace(/g/g, 'G');
      if (f === 2 && y === 16) return row.replace(/g/g, 'G');
      if (f === 2 && y === 17) return row.slice(0, 9) + 'GGGGGG' + row.slice(15);
      if (f === 3 && y === 11) return row.replace(/[eE]/g, 'v');
      return row;
    });
    portCache[id] = [0, 1, 2, 3].map(f => {
      const c = U.canvas(24, 24), g = c.getContext('2d');
      g.fillStyle = pal.bg; g.fillRect(0, 0, 24, 24);
      g.drawImage(U.sprite(vary(f), pal), 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 1; y < 24; y += 2) g.fillRect(0, y, 24, 1);
      return c;
    });
    return portCache[id];
  };

  /* ---------- Ícones de interface ---------- */
  const IP = {
    k: '#0b0b16', w: '#ffffff', y: '#ffd23f', Y: '#c8860e', o: '#ff8a2a', r: '#ff4a4a', R: '#a01a2a',
    g: '#7dff8a', G: '#2a9a4a', c: '#5ef2ff', C: '#1a7a98', b: '#9aa3c8', B: '#4a5274', p: '#ff6ae0', P: '#8a2a8a', v: '#b67cff', s: '#d0d8f0'
  };
  const ICONS = {
    coin: ['..YYYYY..', '.YyyyyyY.', 'YyywwyyyY', 'YywyyyyyY', 'YyyyyyyyY', 'YyyyyyyoY', 'YyyyyyooY', '.YyyyooY.', '..YYYYY..'],
    data: ['..c.c.c..', '.kkkkkkk.', 'ckBBBBBkc', '.kBccwBk.', 'ckBcccBkc', '.kBBcBBk.', 'ckBBBBBkc', '.kkkkkkk.', '..c.c.c..'],
    shard: ['....w....', '...wpP...', '..wwpPP..', '.wwppPPP.', 'wwpppPPPP', '.wppPPPP.', '..ppPPP..', '...pPP...', '....P....'],
    flame: ['....r....', '...rr....', '...ryr...', '..ryyr.r.', '.ryywyrr.', '.rywwyyr.', '.ryywwyr.', '..ryyyr..', '...rrr...'],
    chart: ['.........', '......gg.', '......gg.', '...gg.gg.', '...gg.gg.', 'gg.gg.gg.', 'gg.gg.gg.', 'GGGGGGGGG', '.........'],
    flask: ['..kkkkk..', '...ksk...', '...ksk...', '..kssck..', '.ksccccs.', 'kscccwccs', 'kccwccccs', '.sssssss.', '.........'],
    planet: ['...ccc...', '..cwccc..', '.cccccCC.', 'yyyyyyyyy', '.ccccCCC.', '..cCCCC..', '...CCC...', '.........', '.........'],
    star: ['....w....', '....y....', '...yyy...', 'yyyywyyyy', '.yyywyyy.', '..yyyyy..', '..yy.yy..', '.yy...yy.', '.y.....y.'],
    trophy: ['YyyyyyyyY', 'Y.yywyy.Y', 'Y.yywyy.Y', '.Yyyyyyy.', '..YyyyY..', '...YyY...', '....Y....', '...YyY...', '..YYYYY..'],
    gear: ['....b....', '.b.bbb.b.', '..bbbbb..', '.bbb.bbb.', 'bbb...bbb', '.bbb.bbB.', '..bbbBB..', '.b.BBB.B.', '....B....'],
    laser: ['........r', '.......rw', '......rw.', '.....rw..', 'kkk.rw...', 'kbbkw....', 'kbbbk....', 'kkkk.....', '.........'],
    cargo: ['.........', '.kkkkkkk.', '.kbbybbk.', '.kbbybbk.', '.kyyyyyk.', '.kbbybbk.', '.kBBYBBk.', '.kkkkkkk.', '.........'],
    speed: ['.........', 'c...c....', '.c...c...', '..c...c..', '...c...c.', '..c...c..', '.c...c...', 'c...c....', '.........'],
    click: ['w........', '.ww......', '.wbb.....', '..bbb....', '...bbo...', '....boo..', '.....ooo.', '......oo.', '.......o.'],
    crit: ['...rrr...', '.rr...rr.', '.r..w..r.', 'r...w...r', 'r.wwwww.r', 'r...w...r', '.r..w..r.', '.rr...rr.', '...rrr...'],
    field: ['.........', '..ccccc..', '.c.....c.', 'c..bbb..c', 'c.bbbbB.c', 'c..bBB..c', '.c.....c.', '..ccccc..', '.........'],
    scanner: ['..ggggg..', '.g..g..g.', 'g...g...g', 'g...g.w.g', 'ggggwgggg', 'g.....w.g', 'g.......g', '.g.....g.', '..ggggg..'],
    drone: ['.o.......', '.oo......', '.Boo.....', 'oBbbbsc..', 'oBbbbbccr', 'oBbbbsc..', '.BYY.....', '.YY......', '.Y.......'],
    lock: ['..bbbbb..', '.b.....b.', '.b.....b.', 'BBBBBBBBB', 'ByyyyyyyB', 'ByyykyyyB', 'ByyykyyyB', 'ByyyyyyyB', 'BBBBBBBBB']
  };
  const INGOT = ['....44444...', '..444444443.', '.43333333322', '.33333333321', '.22222222211', '..111111111.'];
  const urlCache = {};
  X.icons = () => {
    if (urlCache.done) return urlCache;
    for (const k in ICONS) urlCache[k] = U.sprite(ICONS[k], IP, true).toDataURL();
    ORES.forEach((o, i) => {
      const art = X.makeAsteroid({ r: 4.6, rock: o.col, ore: [o.col[2], o.col[3], o.col[4], '#ffffff', '#ffffff'], density: 0.12, seed: 100 + i * 7, frames: 1 });
      urlCache['ore' + i] = art.frames[0].toDataURL();
      const pal = {};
      for (let k = 0; k < 5; k++) pal[String(k)] = o.col[k];
      urlCache['ingot' + i] = U.sprite(INGOT, pal, true).toDataURL();
    });
    urlCache.done = true;
    return urlCache;
  };

  return X;
})();
