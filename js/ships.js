'use strict';
/* ===== Naves: catálogo de designs desenhados à mão + motor de pintura =====
   Cada nave é uma planta em pixels, com o nariz para a direita. Só a metade de cima é desenhada e
   espelhada para baixo; uma linha central opcional ('mid') fica no eixo e não se repete. Cada caractere
   diz o que o pixel é (casco, pintura, metal, vidro, linha de painel, motor...), então o design é todo
   autoral. Nada aqui é sorteado.
   Cada nave tem dois níveis de detalhe, desenhados separadamente:
   - 'lo' (mapa): pequena e limpa, para o cenário aparecer mais que as naves;
   - 'hi' (detalhe): umas 4× maior, com painéis, rebites, grelhas e luzes, para ver ampliada.
   O motor só ilumina e colore: luz do gfx.js (GFX.LIGHT, de cima e da esquerda), casco facetado,
   bordas arredondadas, especular, sombra dos módulos, contraluz azulada e contorno seletivo. As cores
   mudam por tier (nível do laser) e por facção. A versão virada para a esquerda é sombreada de novo,
   não apenas espelhada. Tudo é gerado uma vez e cacheado. */
const SHIPS = (() => {
  const X = {};
  const LIGHT = GFX.LIGHT;
  const PAD = 3; // margem em volta da planta (contorno + vizinhança do sombreamento)

  /* Materiais */
  const VOID = 0, HULL = 1, COCK = 2, HGR = 3,
    MET = 4, BAR = 5, TIP = 6, GLW = 7, NOZ = 8, POD = 9, PST = 10, ROD = 11, LIT = 12;
  const isMod = m => m >= MET;
  /* Detalhes de pixel do casco (um código por pixel) */
  const REC = 1, BMP = 2, ACC = 3, EMI = 4, WINL = 5, GUIDE = 6, NAVP = 7, NAVS = 8;

  /* Legenda das plantas: [material, pintura, placa elevada, detalhe]
     pintura: 0 casco · 1 pintura do tier · 2 metal escuro estrutural · 3 cor de carga · 4 casco claro */
  const KEY = {
    '#': [HULL, 0, 0, 0], 'r': [HULL, 0, 1, 0],          // casco · placa de casco elevada
    'p': [HULL, 1, 0, 0], 'P': [HULL, 1, 1, 0],          // pintura · placa pintada elevada
    'm': [HULL, 2, 0, 0], 'M': [HULL, 2, 1, 0],          // metal escuro · placa de metal elevada
    'y': [HULL, 3, 0, 0], 'Y': [HULL, 3, 1, 0],          // cor de carga · placa de carga elevada
    'u': [HULL, 4, 0, 0], 'U': [HULL, 4, 1, 0],          // casco claro · placa clara elevada
    '-': [HULL, 0, 0, REC], '=': [HULL, 1, 0, REC], '_': [HULL, 2, 0, REC], // linha de painel (casco/pintura/metal)
    'z': [HULL, 4, 0, REC],                              // linha de painel no casco claro
    'o': [HULL, 0, 0, BMP], 'O': [HULL, 2, 0, BMP],      // rebite / relevo pequeno (casco/metal)
    'q': [HULL, 1, 0, BMP],                              // rebite na pintura
    'a': [HULL, 0, 0, ACC], 'A': [HULL, 0, 1, ACC],      // faixa na cor de destaque da facção (· elevada)
    'e': [HULL, 0, 0, EMI],                              // luz de destaque (acende do tier 2 em diante)
    'w': [HULL, 0, 0, WINL],                             // janela acesa
    'v': [HULL, 0, 0, NAVP],                             // luz de navegação: vermelha em cima, verde no espelho
    'c': [COCK, 0, 0, 0], 'h': [HGR, 0, 0, 0],           // vidro da cabine · hangar
    'k': [MET, 0, 0, 0], 'b': [BAR, 0, 0, 0], 't': [TIP, 0, 0, 0], // metal de módulo · cano · ponta do laser
    'g': [GLW, 0, 0, 0], 'n': [NOZ, 0, 0, 0],            // boca do motor · sino do bocal
    'x': [POD, 0, 0, 0], 's': [PST, 0, 0, 0],            // casulo de carga · faixa do casulo
    'i': [ROD, 0, 0, 0], 'l': [LIT, 0, 0, 0]             // haste · luz piscante
  };

  /* ---------- Catálogo ----------
     X.define(id, { name, cls, desc, lo: planta, hi: planta })
     planta: half = metade de cima, de fora para dentro (a última linha encosta no eixo); mid = linha do
     eixo, opcional. bevel: largura (px) da borda arredondada · facets: 2 (cima/baixo) ou 4 (faixas de
     fora mais inclinadas) · dith: pontilhado nas transições de relevo · flame: escala da chama */
  const DESIGNS = {};
  X.DESIGNS = DESIGNS;
  X.DESIGN_IDS = [];
  X.LODS = ['lo', 'hi'];
  const LOD_DEF = { lo: { bevel: 1.5, facets: 2, dith: 0, flame: 1 }, hi: { bevel: 2.5, facets: 4, dith: 0.1, flame: 2.5 } };
  X.define = (id, d) => {
    d.id = id;
    for (const lod of X.LODS) {
      const B = d[lod];
      if (!B) continue;
      for (const k in LOD_DEF[lod]) if (B[k] == null) B[k] = LOD_DEF[lod][k];
      const rows = B.half.concat(B.mid ? [B.mid] : []), W = rows[0].length;
      rows.forEach((r, y) => {
        if (r.length !== W) console.warn(`SHIPS: ${id}/${lod} linha ${y} com largura ${r.length} (esperado ${W})`);
        for (const ch of r) if (ch !== '.' && !KEY[ch]) console.warn(`SHIPS: ${id}/${lod} usa '${ch}', que não está na legenda`);
      });
      B.W = W; B.HH = B.half.length;
    }
    DESIGNS[id] = d;
    X.DESIGN_IDS.push(id);
  };

  /* ---------- Paletas: facção (casco, carga, metal) × tier (pintura, cabine, laser, motor) ---------- */
  // rampa de 7 tons com desvio de matiz: sombras puxam para o índigo, luzes para um branco quente
  const SH = U.hex('#0c0a22'), HI = U.hex('#fff8e6'), WHITE = [255, 255, 255];
  const ramp7 = base => {
    const r = [];
    for (let i = 0; i < 7; i++) {
      const t = (i - 3) / 3;
      r.push(t < 0 ? U.mix(base, SH, -t * 0.88) : U.mix(base, HI, t * t * 0.55 + t * 0.25));
    }
    return r;
  };
  // Cores dos tiers vêm dos drones originais (cabine, laser, motor); a pintura muda a cada 12 níveis de laser
  const TIERS = [
    { hull: '#6b7396', paint: '#c8602a', cock: '#5ef2ff', laser: '#ff4a4a', glow: '#ff8a2a' },
    { hull: '#8a7a58', paint: '#d0a02c', cock: '#ffe066', laser: '#ff9a3a', glow: '#ffb040' },
    { hull: '#5a7a68', paint: '#3fa060', cock: '#c6ff6a', laser: '#ffe14a', glow: '#d0ff6a' },
    { hull: '#5a6e98', paint: '#3a78d8', cock: '#e0f4ff', laser: '#5aff7a', glow: '#5ef2ff' },
    { hull: '#6e5a98', paint: '#9048d0', cock: '#ff9cf0', laser: '#4ae0ff', glow: '#ff9cf0' },
    { hull: '#9a8a5a', paint: '#e8c030', cock: '#fffbe0', laser: '#ff6ae0', glow: '#fff0a0' }
  ];
  // tint: quanto o tier recolore a facção (a frota da estação muda bastante; as outras, pouco)
  const FACTIONS = {
    estacao: { name: 'Estação', hull: '#7a84a4', paint: null, acc: '#ffcc33', cargo: '#c08a2a', met: '#585e78', out: '#07070f', tint: 0.3 },
    corporacao: { name: 'Corporação', hull: '#b0b0c2', paint: '#e8662a', acc: '#5ef2ff', cargo: '#e06a1c', met: '#5c5c6e', out: '#0a0a12', tint: 0.12, engine: '#5ef2ff' },
    livre: { name: 'Independentes', hull: '#857a5a', paint: '#5e8a3a', acc: '#e8d070', cargo: '#7a9a2a', met: '#5a5444', out: '#0a0906', tint: 0.12, engine: '#c6ff6a' },
    pirata: { name: 'Piratas', hull: '#5e4642', paint: '#b0282c', acc: '#ffd23f', cargo: '#94401a', met: '#4a3a38', out: '#080306', tint: 0.08, engine: '#ff4a2a' },
    enigma: { name: 'Desconhecida', hull: '#40325e', paint: '#22163a', acc: '#ff6ae0', cargo: '#9a36b0', met: '#2e2444', out: '#030206', tint: 0.06, engine: '#ff6ae0', cock: '#ffb0f0' }
  };
  X.TIERS = TIERS;
  X.FACTIONS = FACTIONS;
  X.FACTION_IDS = Object.keys(FACTIONS);

  const palCache = {};
  const palette = (fac, tier) => {
    const key = fac + tier;
    if (palCache[key]) return palCache[key];
    const F = FACTIONS[fac], T = TIERS[tier];
    const hull = ramp7(U.mix(U.hex(F.hull), U.hex(T.hull), F.tint));
    const paint = ramp7(F.paint ? U.mix(U.hex(F.paint), U.hex(T.paint), F.tint) : U.hex(T.paint));
    const out = U.hex(F.out), cockHex = F.cock || T.cock, cock = U.hex(cockHex);
    const glowHex = F.engine || T.glow, glow = U.hex(glowHex), laser = U.hex(T.laser), acc = U.hex(F.acc);
    const p = {
      hull, paint, glowHex, laserHex: T.laser, cockHex,
      met: ramp7(U.hex(F.met)), struct: ramp7(U.mix(U.hex(F.met), SH, 0.35)), cargo: ramp7(U.hex(F.cargo)), acc: ramp7(acc),
      glass: [U.mix(cock, SH, 0.84), U.mix(cock, SH, 0.62), U.mix(cock, SH, 0.32), cock, U.mix(cock, WHITE, 0.65)],
      out, outLit: U.mix(out, hull[1], 0.55),
      rim: U.hex('#8a8cff'),
      glow, glowCore: U.mix(glow, WHITE, 0.6), laser, laserHi: U.mix(laser, WHITE, 0.5),
      hi: U.mix(cock, WHITE, 0.4), trim: U.hex('#ffe9a0'), accLight: U.mix(acc, WHITE, 0.35),
      light: U.hex('#ff4a4a'), navP: U.hex('#ff3a4a'), navS: U.hex('#4aff8a'),
      win: [U.hex('#c89a50'), U.hex('#ffe9a0')], hgr: U.hex('#05060e'), guide: U.hex('#ffcc33')
    };
    palCache[key] = p;
    return p;
  };

  /* ---------- Distância (chanfro 1/1.41) até o vazio, para as bordas arredondadas ---------- */
  function chamfer(sol, GW, GH) {
    const n = GW * GH, D = new Float32Array(n);
    for (let i = 0; i < n; i++) D[i] = sol[i] ? 1e4 : 0;
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x;
      if (!D[i]) continue;
      let m = D[i];
      const a = D[i - 1] + 1, b = D[i - GW] + 1, c = D[i - GW - 1] + 1.41, d = D[i - GW + 1] + 1.41;
      if (a < m) m = a; if (b < m) m = b; if (c < m) m = c; if (d < m) m = d;
      D[i] = m;
    }
    for (let y = GH - 2; y > 0; y--) for (let x = GW - 2; x > 0; x--) {
      const i = y * GW + x;
      if (!D[i]) continue;
      let m = D[i];
      const a = D[i + 1] + 1, b = D[i + GW] + 1, c = D[i + GW + 1] + 1.41, d = D[i + GW - 1] + 1.41;
      if (a < m) m = a; if (b < m) m = b; if (c < m) m = c; if (d < m) m = d;
      D[i] = m;
    }
    return D;
  }

  /* ---------- Sombreamento de uma orientação, recortado em (x0,y0,w,h) ---------- */
  const HV = (() => { const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1], m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / m, v[1] / m, v[2] / m]; })();
  function shade(F, GW, GH, C, P, tier, flipped, x0, y0, w, h) {
    const { mat, rz, pt, dt, ht } = F, n = GW * GH;
    const sol = new Uint8Array(n), gl = new Uint8Array(n);
    for (let i = 0; i < n; i++) { sol[i] = mat[i] ? 1 : 0; gl[i] = mat[i] === COCK ? 1 : 0; }
    const D = chamfer(sol, GW, GH), DG = chamfer(gl, GW, GH);
    // altura: borda arredondada (quarto de círculo) + placas elevadas + bolha da cabine − hangar rebaixado
    const R = C.bevel, H = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (!sol[i]) continue;
      const q = 1 - Math.min(D[i], R) / R;
      let hh = Math.sqrt(1 - q * q) + rz[i] * 0.25;
      if (gl[i]) hh += 0.3 * Math.min(DG[i], 2) / 2;
      else if (mat[i] === HGR) hh -= 0.3;
      H[i] = hh;
    }
    const out = new Uint8ClampedArray(w * h * 4), cy = GH / 2, half = C.half;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const x = x0 + xx, y = y0 + yy, i = y * GW + x, M = mat[i], o = (yy * w + xx) * 4;
      let col;
      if (!M) {
        // contorno seletivo: do lado da luz (em cima/à esquerda do casco) ele é um tom escuro do casco
        const lit = sol[i + 1] || sol[i + GW], dark = sol[i - 1] || sol[i - GW];
        if (!lit && !dark) continue;
        col = lit ? P.outLit : P.out;
      } else {
        // normal: relevo do mapa de altura + casco facetado em torno do eixo (metade de cima inclinada para a
        // luz, a de baixo contra ela; com 4 facetas as faixas de fora inclinam mais). Facetas dão faixas de
        // tom limpas, com cara de blindagem, em vez de um gradiente de cilindro "inflado".
        const gx = H[i + 1] - H[i - 1], gy = H[i + GW] - H[i - GW], vy = (y + 0.5 - cy) / half, av = vy < 0 ? -vy : vy;
        const fy = av < 0.08 ? 0 : (vy < 0 ? -1 : 1) * (C.facets > 2 && av > 0.6 ? 0.62 : 0.24);
        let nx = -gx * 1.6, ny = -gy * 1.6 + fy, nz = 1;
        const ml = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= ml; ny /= ml; nz /= ml;
        const dif = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        let sp = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]);
        sp *= sp; sp *= sp; sp *= sp; // ^8
        sp *= sp * sp;                // ^24, sem Math.pow
        const v = 0.12 + dif * 0.86 + sp * 0.45;
        // pontilhado só onde o relevo varia (bordas, placas): faces planas ficam num tom só, sem xadrez
        const gm = (gx < 0 ? -gx : gx) + (gy < 0 ? -gy : gy), dth = U.bayer(x, y) * C.dith * (gm > 0.5 ? 1 : gm * 2);
        // detalhes de 1px: rebaixo escuro com a borda de baixo/direita acesa; relevo claro com sombra
        const d = dt[i];
        let off = 0;
        if (d === REC) off -= 2; else if (dt[i - GW] === REC || dt[i - 1] === REC) off += 1;
        if (d === BMP || (d === EMI && tier < 2)) off += 1; else if (dt[i - GW] === BMP || dt[i - 1] === BMP) off -= 1;
        // sombra projetada pelos módulos no casco (para baixo e para a direita)
        if (M === HULL && (isMod(mat[i - GW]) || isMod(mat[i - 1]) || isMod(mat[i - GW - 1]))) off -= 1;
        const k = U.clamp(Math.floor(v * 7 + dth) + off, 0, 6);
        let emit = false;
        switch (M) {
          case HULL:
            if (d === ACC) col = P.acc[U.clamp(k, 2, 6)];
            else if (d === EMI && tier >= 2) { col = P.accLight; emit = true; }
            else if (d === WINL) { col = k >= 3 ? P.win[1] : P.win[0]; emit = true; }
            else if (d === NAVP || d === NAVS) { col = (d === NAVP) !== flipped ? P.navP : P.navS; emit = true; }
            else {
              const pk = pt[i];
              col = pk === 1 ? P.paint[k] : pk === 2 ? P.struct[U.clamp(k - 1, 0, 5)] : pk === 3 ? P.cargo[k] : pk === 4 ? P.hull[Math.min(6, k + 1)] : P.hull[k];
              if (tier >= 4 && k >= 5) col = U.mix(col, P.hi, 0.3);
              if (tier >= 5 && D[i] < 1.5 && dif > 0.7) col = U.mix(col, P.trim, 0.55);
            }
            break;
          case COCK: {
            const g = U.clamp(Math.floor(v * 5 + U.bayer(x, y) * 0.25), 0, 4);
            col = P.glass[g];
            // brilho do vidro: o canto de cima/esquerda da cabine e os pontos de especular
            if (sp > 0.5 || (mat[i - GW] !== COCK && mat[i - 1] !== COCK && y < cy)) col = U.mix(P.glass[4], WHITE, 0.6);
            emit = true;
            break;
          }
          case HGR:
            if (d === GUIDE) { col = P.guide; emit = true; }
            else col = (y < cy ? mat[i - GW] !== HGR : mat[i + GW] !== HGR) ? P.hull[1] : P.hgr;
            break;
          case MET: col = P.met[k]; break;
          case BAR: col = P.met[Math.max(0, k - 1)]; break;
          case ROD: col = P.met[U.clamp(k, 2, 5)]; break;
          case NOZ: col = P.met[U.clamp(k - 2, 0, 4)]; break;
          case GLW: col = mat[i - GW] === GLW && mat[i + GW] === GLW ? P.glowCore : P.glow; emit = true; break;
          case TIP: col = y < cy - 0.5 ? P.laserHi : P.laser; emit = true; break;
          case POD: col = P.cargo[k]; break;
          case PST: col = P.acc[U.clamp(k, 1, 5)]; break;
          case LIT: col = P.light; emit = true; break;
          default: col = P.hull[k];
        }
        if (!emit) {
          // contraluz: borda de baixo/direita, do lado oposto à luz, pega um reflexo azulado do ambiente
          if ((!sol[i + 1] || !sol[i + GW]) && dif < 0.5) col = U.mix(col, P.rim, 0.4);
          // metal aquecido perto dos bocais
          if (ht[i]) col = U.mix(col, P.glow, ht[i] * 0.07);
        }
      }
      out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255;
    }
    return out;
  }

  // componentes 4-conexos de um material (dentro do recorte) → caixas
  function groups(mat, GW, x0, y0, w, h, test) {
    const seen = new Uint8Array(w * h), res = [];
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const k = yy * w + xx;
      if (seen[k] || !test((y0 + yy) * GW + x0 + xx)) continue;
      const b = { x0: xx, x1: xx, y0: yy, y1: yy }, st = [k];
      seen[k] = 1;
      while (st.length) {
        const c = st.pop(), cx = c % w, cy = (c / w) | 0;
        if (cx < b.x0) b.x0 = cx; if (cx > b.x1) b.x1 = cx; if (cy < b.y0) b.y0 = cy; if (cy > b.y1) b.y1 = cy;
        for (const [ax, ay] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
          const j = ay * w + ax;
          if (!seen[j] && test((y0 + ay) * GW + x0 + ax)) { seen[j] = 1; st.push(j); }
        }
      }
      res.push(b);
    }
    return res;
  }

  /* ---------- Render de um design (sem canvas): buffers RGBA das duas orientações + metadados ---------- */
  X.raster = o => {
    const d = DESIGNS[o.design] || DESIGNS[X.DESIGN_IDS[0]];
    const fac = FACTIONS[o.faction] ? o.faction : 'estacao', tier = U.clamp(o.tier | 0, 0, 5);
    const lod = o.lod === 'hi' && d.hi ? 'hi' : 'lo', st = d[lod], pal = palette(fac, tier);
    const W0 = st.W, HH = st.HH, mid = st.mid ? 1 : 0, H0 = HH * 2 + mid;
    const GW = W0 + PAD * 2, GH = H0 + PAD * 2, n = GW * GH;
    const mat = new Uint8Array(n), rz = new Uint8Array(n), pt = new Uint8Array(n), dt = new Uint8Array(n), ht = new Uint8Array(n);
    const put = (row, y, bottom) => {
      for (let x = 0; x < W0; x++) {
        const K = KEY[row[x]];
        if (!K) continue;
        const i = y * GW + PAD + x;
        mat[i] = K[0]; pt[i] = K[1]; rz[i] = K[2]; dt[i] = bottom && K[3] === NAVP ? NAVS : K[3];
      }
    };
    st.half.forEach((row, r) => { put(row, PAD + r, false); put(row, PAD + H0 - 1 - r, true); });
    if (mid) put(st.mid, PAD + HH, false);

    // metal aquecido logo à frente dos bocais
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 5; x++) {
      const i = y * GW + x;
      if (mat[i] !== GLW && mat[i] !== NOZ) continue;
      for (let dx = 1; dx <= 4; dx++) for (let dy = -2; dy <= 2; dy++) {
        const j = i + dy * GW + dx, m = mat[j], v = 5 - dx - (dy < 0 ? -dy : dy);
        if ((m === HULL || m === MET) && v > ht[j]) ht[j] = v;
      }
    }

    // recorte: caixa do que é sólido + 1px de contorno
    let x0 = GW, x1 = -1, y0 = GH, y1 = -1;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (mat[y * GW + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x0 = Math.max(1, x0 - 1); y0 = Math.max(1, y0 - 1); x1 = Math.min(GW - 2, x1 + 1); y1 = Math.min(GH - 2, y1 + 1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;

    // orientação esquerda: espelha a grade e sombreia de novo (a luz continua vindo de cima/esquerda)
    const flip = a => { const f = new Uint8Array(n); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) f[y * GW + x] = a[y * GW + GW - 1 - x]; return f; };
    const C = { bevel: st.bevel, dith: st.dith, facets: st.facets, half: HH + mid * 0.5 };
    const right = shade({ mat, rz, pt, dt, ht }, GW, GH, C, pal, tier, false, x0, y0, w, h);
    const left = shade({ mat: flip(mat), rz: flip(rz), pt: flip(pt), dt: flip(dt), ht: flip(ht) }, GW, GH, C, pal, tier, true, GW - x0 - w, y0, w, h);

    // metadados (coordenadas do sprite virado para a direita; para a esquerda use SHIPS.fx)
    const cx = PAD + W0 / 2 - x0, cy = PAD + H0 / 2 - y0;
    const engines = groups(mat, GW, x0, y0, w, h, i => mat[i] === GLW).map(g => ({ x: g.x0, y0: g.y0, y1: g.y1, s: U.clamp(Math.round((g.y1 - g.y0 + 1) / 2), 1, 3) }));
    const lasers = groups(mat, GW, x0, y0, w, h, i => mat[i] === TIP).map(g => [g.x1, (g.y0 + g.y1) / 2]);
    lasers.sort((p, q) => Math.abs(p[1] - cy) - Math.abs(q[1] - cy) || q[0] - p[0]);
    const lights = groups(mat, GW, x0, y0, w, h, i => mat[i] === LIT).map(g => [g.x0, g.y0]);
    const nav = groups(mat, GW, x0, y0, w, h, i => dt[i] === NAVP || dt[i] === NAVS).map(g => [g.x0, g.y0]);
    const bw = Math.max(4, Math.round(W0 * 0.5));
    return {
      w, h, right, left,
      meta: {
        design: d.id, name: d.name, lod, flame: st.flame, faction: fac, tier, w, h, cx, cy,
        nose: lasers.length ? lasers[0] : [w - 1, cy], lasers, engines, lights, nav,
        cargoBar: [Math.round(cx - bw / 2), h, bw],
        laserCol: pal.laserHex, glowCol: pal.glowHex, cockCol: pal.cockHex
      }
    };
  };

  /* ---------- API com cache (canvas offscreen por orientação) ---------- */
  const cache = new Map();
  X.stats = { made: 0, ms: 0 };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const toCanvas = (buf, w, h) => {
    const c = U.canvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h);
    img.data.set(buf);
    g.putImageData(img, 0, 0);
    return c;
  };
  /* o: { design, tier?, faction?, lod? ('lo' mapa · 'hi' detalhe) } */
  X.make = o => {
    const key = `${o.design}|${o.lod === 'hi' ? 'hi' : 'lo'}|${o.tier | 0}|${o.faction || 'estacao'}`;
    let s = cache.get(key);
    if (s) return s;
    const t0 = now();
    const R = X.raster(o);
    s = R.meta;
    s.r = toCanvas(R.right, R.w, R.h);
    s.l = toCanvas(R.left, R.w, R.h);
    cache.set(key, s);
    X.stats.made++;
    X.stats.ms += now() - t0;
    return s;
  };
  X.cacheSize = () => cache.size;
  X.clearCache = () => cache.clear();
  // x de um ponto do sprite (coordenadas da versão "direita") na orientação pedida
  X.fx = (s, face, x) => (face > 0 ? x : s.w - 1 - x);

  /* Motores (brilho pulsante + chama), luzes de antena e de navegação piscando. x,y = canto superior
     esquerdo do sprite. thrust 0..1: 0 = só o brilho fraco do motor ocioso. Não aloca nada por quadro. */
  X.drawEngines = (ctx, s, x, y, face, t, thrust) => {
    const E = s.engines, dir = face > 0 ? -1 : 1;
    for (let i = 0; i < E.length; i++) {
      const e = E[i], ph = t * 13 + i * 1.7;
      const ex = x + X.fx(s, face, e.x), rows = e.y1 - e.y0 + 1;
      const fl = thrust > 0.05 ? Math.round(thrust * (2 + e.s * 1.5) * s.flame) + (Math.sin(ph * 1.9) > 0 ? 1 : 0) : 0;
      if (fl > 0) {
        const fr = Math.floor(t * 18);
        for (let r = 0; r < rows; r++) {
          // a chama afina nas bordas do bocal e tremula linha a linha; núcleo claro, cauda translúcida
          const edge = rows > 2 && (r === 0 || r === rows - 1) ? 1 + (rows > 4 ? 1 : 0) : rows > 4 && (r === 1 || r === rows - 2) ? 1 : 0;
          const len = fl - edge - ((fr + r * 2 + i) % 3 === 0 ? 1 : 0);
          if (len <= 0) continue;
          const yy = y + e.y0 + r, x1 = dir < 0 ? ex - len : ex + 1;
          ctx.fillStyle = s.glowCol;
          ctx.fillRect(x1, yy, len, 1);
          ctx.globalAlpha = 0.45;
          ctx.fillRect(dir < 0 ? x1 - 1 : x1 + len, yy, 1, 1);
          ctx.globalAlpha = 1;
          if (!edge) { ctx.fillStyle = '#fff3b0'; ctx.fillRect(dir < 0 ? ex - Math.min(2, len) : ex + 1, yy, Math.min(2, len), 1); }
        }
      }
      const gr = U.clamp(Math.round(rows * 0.5) + e.s, 2, s.lod === 'hi' ? 9 : 5), my = y + ((e.y0 + e.y1) >> 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = U.clamp(0.3 + 0.35 * thrust + 0.18 * Math.sin(ph), 0, 1);
      ctx.drawImage(GFX.glow(s.glowCol, gr), ex + dir * ((fl >> 1) + 1) - gr, my - gr);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (s.lights.length && Math.sin(t * 3) > 0.55) {
      ctx.fillStyle = '#ffd0d0';
      for (const l of s.lights) ctx.fillRect(x + X.fx(s, face, l[0]), y + l[1], 1, 1);
    }
    // estrobo branco nas luzes de navegação
    if (s.nav.length && ((t * 1.3) % 1) < 0.08) {
      ctx.fillStyle = '#ffffff';
      for (const l of s.nav) ctx.fillRect(x + X.fx(s, face, l[0]), y + l[1], 1, 1);
    }
  };

  return X;
})();

/* ===== Catálogo de naves ===== */

SHIPS.define('flecha', {
  name: "Flecha", cls: "Drone de mineração",
  desc: "Dardo leve da frota da estação: asas enflechadas, fuselagem longa, laser de mineração no nariz.",
  lo: {
    half: [
      '..vp...........',
      '..pPp..........',
      'gn#ppP#........',
      '.km##=####cc...'
    ],
    mid: 'gnm#######cccbt'
  },
  hi: {
    half: [
      '........mvu.................................................',
      '........mPPPu...............................................',
      '........mmaaaaau............................................',
      '........__PPPPPPPu..........................................',
      '........mmPPPPPPPPPPu.......................................',
      '........mmPPPqPPPPPqPPu.....................................',
      '.......__PP============Puu..................................',
      '.nkkkkkmmPPPPPPPPPPPPPPPPPuu................................',
      'gnkMMM_MMMMOPqPPPPPqPPPPP####uu.............................',
      'gnkMMMMMMMMkPPPPPPPPPPPPPP#####uu...........................',
      '......mmPPPPPPPPPPPPPPPPPP########uu........................',
      '...mm#####uuuuuuuuuuuuuuuuuuuuuuuuuuukuuuuuu................',
      '..mmMMMMO#####-####e####mmmmmmmm#####-#####mmmkm#aa.........',
      '.nmMM_MMM#####-#########M_M_M_MM#####-###mcccccm###aa.......',
      'gnmMMMMMM#####-#o##################o#-##mccccmccm####aau....'
    ],
    mid: 'gnmMM_MMM###########l##################mcccccmcccm####kbbbbt'
  }
});

SHIPS.define('mula', {
  name: "Mula", cls: "Cargueiro",
  desc: "Cargueiro de contêineres: longarina central, pilhas de carga coloridas, bloco de motores e ponte de comando.",
  lo: {
    half: [
      '....yyy.ppp.uuu.yyy.......',
      '....YYY.PPP.UUU.YYY.......',
      'gnmmYYY.PPP.UUU.YYY.uuu...',
      'gnmmyyy_ppp_uuu_yyy_####..',
      '..mm_______________m#####.',
      'gnmmmmmmmmmmmmmmmmmm##ccu.'
    ],
    mid: 'gnmmMMMMMMMMMMMMMMMM#cccue'
  },
  hi: {
    half: [
      '......k.k.k.............................................................................',
      '......k.k.k.............................................................................',
      '......k.k.k.....OyyyyyyyyyyO.OppppppppppO.OuuuuuuuuuuO.OyyyyyyyyyyO.....................',
      '..mmmmmmmmmmmm..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm.....................',
      '..MMM_MM_MM_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm.....................',
      '.nkMM_MM_MM_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm.......l.............',
      'gnkMM_MM_MM_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm.......i.............',
      'gnkMM_MM_MM_MM..mYyaaaaaaYYm.mPpuuuuuuPPm.mUuaaaaaaUUm.mYyuuuuuuYYm.......i.............',
      'gnkMM_MM_MM_MM..mYyaaaaaaYYm.mPpuuuuuuPPm.mUuaaaaaaUUm.mYyuuuuuuYYm...mmuuuuuuvuu.......',
      'gnkMM_MM_MM_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm...m###########......',
      'gnkMM_MM_MM_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm...#-###########.....',
      '.nkMM_MM_MM_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm...#-#w-w-w-w####....',
      '..MMM_MM_MM_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm...#-##########aa#...',
      '..MMO_MM_MO_MM..mYyYYyYYyYYm.mPpPPpPPpPPm.mUuUUuUUuUUm.mYyYYyYYyYYm...#-###o########aa..',
      '..MMM_MM_MM_MM..OmmmkkkkmmmO.OmmmkkkkmmmO.OmmmkkkkmmmO.OmmmkkkkmmmO...#-#############aa.',
      '..MMMMMMMMMMMM________________________________________________________#-########mmmm###.',
      '.nkMMMMMMMMMMMmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmm#-###o###mcccm###.',
      'gnkMMMMMMMMMMMmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm#-#######mcccccm#.',
      'gnkMMMMeMMMMMMmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmmmmmOmm#-#######mccccccm.',
      'gnkMMMMMMMMMMMmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm#-#######mcccccccu'
    ],
    mid: 'gnkMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM#-#######mccccccce'
  }
});

SHIPS.define('vespa', {
  name: "Vespa", cls: "Patrulha",
  desc: "Interceptador de patrulha: abdômen listrado com o motor no ferrão, asas com nervuras e dois canhões de mandíbula.",
  lo: {
    half: [
      '...........uu.....',
      '..aamma...uUUu....',
      '.naamma.mPPPkkbbbt',
      '.naamma_mPPPPcc...'
    ],
    mid: 'gnaamma_mPPPPPccu.'
  },
  hi: {
    half: [
      '....................uvUUUu......................................',
      '..................uUUUzUUUUUu...................................',
      '.................uUUUUUUUzUUUUUu................................',
      '.................uUzzzzzzzzzzzzzzzu.............................',
      '..................uUUUUUUUUUUzUUUUUUUu..........................',
      '..........mmaaammmaaaUUUUUUUUUUUUzUUUUUu........................',
      '.......aammmaaammmaaammmUUUUUUUUUUUUzUUUUu......................',
      '.....maaammmaaammmaaammmaa.uUUUUUUUUppppppppppppp...............',
      '...mmmaaammmaaammmaaammmaaam.......PPP=PPPPPPPPPPP..............',
      '..ammmaaammmaaammmaaammmaaamm.....PPPP=PPqPPPqPkkkkkkk..........',
      '.aammmaaammmaaammmaaammmaaammm___PPPPP=PPPPPPPPPPPuukkbbbbbbbbbt',
      '.nammmaaammmaaammmaaammmaaammmmmPPPPPP=PPPPPPPPPmccccm###.......',
      'gnammmaaammmaaammmaaammmaaammmmPPPPePP=PPPPPPPPmcccccm####......',
      'gnammmaaammmaaammmaaammmaaammmmPPPPPPP=PPPPPPPPmccccccm#U##.....'
    ],
    mid: 'gnammmaaammmaaammmaaammmaaammmmPPPPPPP=PPPPPPPPmcccccccmUUu#....'
  }
});
