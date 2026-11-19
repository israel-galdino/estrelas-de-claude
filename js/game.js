'use strict';
/* ===== Núcleo do jogo: estado, simulação, economia, renderização ===== */
// A chave do localStorage nunca muda; a versão do formato fica em S.v (ver migrate()).
const SAVE_KEY = 'orbita-mineradora-v1';
const SAVE_VERSION = 2;
const HIST_LEN = 48; // pontos do histórico de preços (sparkline do Mercado e S.ph)
const CRIT_LVL = 0.03, CRIT_AIM = 0.05; // crítico por nível de Mira de Precisão / pesquisa Mira Assistida

const G = {
  W: 400, H: 240, scale: 3, t: 0, frame: 0, cv: null, ctx: null, tmp: null, tctx: null,
  ast: [], drones: [], parts: [], picks: [], floats: [], comets: [], bolts: [], rings: [], flashes: [],
  stars: [[], [], []], dust: [],
  mouse: { x: -999, y: -999, in: false, down: false, hold: 0 },
  hover: null, shake: 0, warp: null, banner: null,
  buffs: { frenzy: 0 }, event: null, spawnT: 0, droneSeq: 0, astId: 0,
  tang: -Math.PI / 2, muzzle: 0, refineFx: 0, dockGlow: 0,
  timers: { comet: 70, shower: 240, boom: 130, market: 0, rate: 0, save: 0, auto: 0, check: 0, turret: 0 },
  gain: ORES.map(() => 0), dataGain: 0, cps: 0, hist: ORES.map(() => []),
  st: { x: 60, y: 120 }, dock: { x: 87, y: 120 }, reg: { x0: 150, x1: 380, y0: 30, y1: 210 }, pl: { x: 300, y: 70 },
  bg: null, planet: null, vig: null, debris: [], ready: false, hiddenAt: 0, lastTs: 0
};
let S = null;

function defaultState() {
  return {
    v: SAVE_VERSION, credits: 0, runCredits: 0, lifeCredits: 0, data: 0, shards: 0,
    ores: ORES.map(() => 0), ingots: ORES.map(() => 0), seen: ORES.map((_, i) => i < 2),
    upg: { fleet: 0, laser: 0, cargo: 0, speed: 0, click: 0, crit: 0, field: 0, scanner: 0, refine: 0 },
    research: {}, pupg: {}, sector: 0, maxSector: 0, runMaxSector: 0,
    furnaces: [{ ore: -1, prog: 0, busy: false, take: 0 }],
    prices: ORES.map(() => 1), ph: ORES.map(() => []),
    autosell: { on: true, thr: 1.0, ingots: false },
    ach: {}, goal: 0,
    stats: { clicks: 0, crits: 0, asteroids: 0, rich: 0, comets: 0, ingots: 0, prestiges: 0, play: 0, mined: 0, sold: 0 },
    rates: ORES.map(() => 0), dataRate: 0,
    settings: { sound: true, fx: 2, shake: true, scan: true },
    buyMode: 1, dataLvl: 0, last: Date.now()
  };
}

/* ---------- Valores derivados ---------- */
const D = {
  drones: () => 1 + S.upg.fleet,
  maxDrones: () => 15 + 2 * (S.pupg.legacy || 0) + (S.research.hangar1 ? 10 : 0) + (S.research.hangar2 ? 15 : 0),
  pdrill: () => Math.pow(1.5, S.pupg.drill || 0),
  dpsAt: l => 2 * Math.pow(1.25, l) * (S.research.reson ? 1.5 : 1) * (S.research.singular ? 3 : 1) * D.pdrill(),
  dps: () => D.dpsAt(S.upg.laser) * (G.buffs.frenzy > 0 ? 3 : 1),
  cargoAt: l => 6 * Math.pow(1.3, l),
  cargo: () => D.cargoAt(S.upg.cargo),
  speedAt: l => 42 * (1 + 0.12 * l),
  speed: () => D.speedAt(S.upg.speed) * (G.buffs.frenzy > 0 ? 1.5 : 1),
  clickAt: l => 1.5 * Math.pow(1.35, l) * D.pdrill() + 0.05 * D.dpsAt(S.upg.laser) * D.drones(),
  click: () => D.clickAt(S.upg.click) * (G.buffs.frenzy > 0 ? 3 : 1),
  // teto = soma de todas as fontes existentes; ao criar uma fonte nova de crítico, some-a aqui
  critMax: () => CRIT_LVL * UPGRADES.find(u => u.id === 'crit').max() + CRIT_AIM,
  critAt: l => Math.min(D.critMax(), CRIT_LVL * l + (S.research.aim ? CRIT_AIM : 0)),
  crit: () => D.critAt(S.upg.crit),
  maxAst: () => 5 + S.upg.field,
  richAt: l => (0.02 + 0.015 * l) * (S.research.spectro ? 2 : 1),
  rich: () => D.richAt(S.upg.scanner),
  refineTimeAt: l => 8 / ((1 + 0.2 * l) * (S.research.plasma ? 2 : 1)),
  refineTime: () => D.refineTimeAt(S.upg.refine),
  batchAt: l => 10 * Math.pow(2, Math.floor(l / 3)),
  batch: () => D.batchAt(S.upg.refine),
  furnaces: () => 1 + ['furn2', 'furn3', 'furn4', 'furn5'].filter(k => S.research[k]).length,
  achMult: () => 1 + 0.03 * Object.keys(S.ach).length,
  valueMult: () => (1 + 0.1 * S.shards) * D.achMult() * (S.research.futures ? 1.15 : 1) * Math.pow(1.25, S.pupg.reson || 0) * (1 + 0.1 * S.dataLvl),
  ingotMult: () => 14 * (S.research.metal ? 1.5 : 1),
  dataMult: () => (S.research.navai ? 2 : 1),
  hpu: s => Math.pow(3, s),
  offEff: () => (S.research.telemetry ? 1 : 0.5),
  offCap: () => (8 + 4 * (S.pupg.chrono || 0)) * 3600,
  sectorCost: s => SECTORS[s].cost * (S.research.warp ? 0.7 : 1),
  turretInt: () => 1.2 / (S.research.turret2 ? 2.5 : 1),
  tier: () => Math.min(5, Math.floor(S.upg.laser / 12)),
  stLevel: () => { const d = D.drones(); return (d >= 5) + (d >= 12) + (d >= 20) + (d >= 30); },
  pcap: () => [260, 650, 1300][S.settings.fx]
};
const priceOf = i => ORES[i].val * S.prices[i] * D.valueMult();
const ingotPrice = i => ORES[i].val * D.ingotMult() * S.prices[i] * D.valueMult();
const ingotName = i => ORES[i].ingot;
const usedByFurnace = i => S.furnaces.slice(0, D.furnaces()).some(f => f.ore === i);
// reserva mantida para alimentar as fornalhas (4 lotes por fornalha usando o minério)
const reserveOf = i => S.furnaces.slice(0, D.furnaces()).filter(f => f.ore === i).length * D.batch() * 4;

/* ---------- Economia ---------- */
function earn(v) { S.credits += v; S.runCredits += v; S.lifeCredits += v; }
function addOre(i, u, auto) {
  if (!(u > 0)) return;
  S.ores[i] += u; S.stats.mined += u;
  if (auto) G.gain[i] += u;
  if (!S.seen[i]) { S.seen[i] = true; log(`Novo minério descoberto: ${ORES[i].name}!`, ORES[i].col[3]); }
}
function sellOre(i, quiet, keep) {
  const a = S.ores[i] - (keep || 0);
  if (a < 0.01) return 0;
  const v = a * priceOf(i);
  S.ores[i] -= a; earn(v); S.stats.sold++;
  if (!quiet) SFX.play('coin');
  return v;
}
function sellIngot(i, quiet) {
  const a = S.ingots[i];
  if (a < 1) return 0;
  const v = a * ingotPrice(i);
  S.ingots[i] = 0; earn(v); S.stats.sold++;
  if (!quiet) SFX.play('coin');
  return v;
}
function sellAll() {
  let v = 0;
  for (let i = 0; i < ORES.length; i++) v += sellOre(i, true, reserveOf(i));
  if (v > 0) { SFX.play('coin'); toastMoney(v); }
  return v;
}
function toastMoney(v) { floatText(G.dock.x, G.dock.y - 14, '+' + U.fmt(v) + ' CR', '#ffd23f', true); }

function upCost(u, lvl, n) { const r = u.mult; return u.base * Math.pow(r, lvl) * (Math.pow(r, n) - 1) / (r - 1); }
function upMax(u) { return u.max ? u.max() : Infinity; }
function buyCount(u) {
  const lvl = S.upg[u.id], room = upMax(u) - lvl;
  if (room <= 0) return 0;
  if (S.buyMode === 'max') {
    const r = u.mult, c0 = u.base * Math.pow(r, lvl);
    let n = Math.floor(Math.log((S.credits * (r - 1)) / c0 + 1) / Math.log(r));
    if (!isFinite(n) || n < 1) n = 1;
    return Math.min(n, room);
  }
  return Math.min(S.buyMode, room);
}
function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  const n = buyCount(u);
  if (n <= 0) return;
  const cost = upCost(u, S.upg[id], n);
  if (S.credits < cost) { SFX.play('deny'); return; }
  S.credits -= cost;
  S.upg[id] += n;
  SFX.play('buy');
  if (id === 'fleet') syncDrones();
}
function doResearch(id) {
  const r = RESEARCH.find(x => x.id === id);
  if (!r || S.research[id] || S.data < r.cost || !(r.req || []).every(q => S.research[q])) { SFX.play('deny'); return; }
  S.data -= r.cost;
  S.research[id] = 1;
  SFX.play('unlock');
  log(`Pesquisa concluída: ${r.name}`, '#5ef2ff');
  if (id === 'turret') G.stDirty = true;
}
const calibCost = l => 300 * Math.pow(1.45, l);
function doCalib() {
  const c = calibCost(S.dataLvl);
  if (S.data < c) { SFX.play('deny'); return; }
  S.data -= c; S.dataLvl++;
  SFX.play('buy');
}
function unlockSector(s) {
  if (s !== S.maxSector + 1 || s >= SECTORS.length) return;
  const cost = D.sectorCost(s), ri = s - 1, req = SECTORS[s].req;
  if (S.credits < cost || S.ingots[ri] < req) { SFX.play('deny'); return; }
  S.credits -= cost;
  S.ingots[ri] -= req;
  S.maxSector = s;
  S.runMaxSector = Math.max(S.runMaxSector, s);
  SFX.play('unlock');
  log(`Rota aberta para ${SECTORS[s].name}!`, '#7dff8a');
  travel(s);
}
function travel(s) {
  if (s === S.sector || G.warp || s > S.maxSector) return;
  G.warp = { t: 0, to: s, switched: false };
  SFX.play('warp');
}
function shardGain() { return Math.floor(Math.sqrt(S.runCredits / 1e6)); }
function canPrestige() { return S.runMaxSector >= 3 && shardGain() >= 1; }
function doPrestige() {
  if (!canPrestige()) return;
  const gain = shardGain();
  const old = S, ns = defaultState();
  ns.shards = old.shards + gain;
  ns.pupg = old.pupg; ns.ach = old.ach; ns.stats = old.stats; ns.settings = old.settings; ns.goal = old.goal;
  ns.lifeCredits = old.lifeCredits; ns.seen = old.seen; ns.autosell = old.autosell; ns.buyMode = old.buyMode;
  ns.stats.prestiges++;
  if (old.pupg.memory) ns.research = old.research;
  S = ns;
  S.upg.fleet = Math.min(2 * (old.pupg.legacy || 0), D.maxDrones() - 1);
  S.maxSector = Math.min(old.maxSector, old.pupg.shortcut || 0);
  S.runMaxSector = S.maxSector;
  S.sector = 0;
  G.ast = []; G.drones = []; G.parts = []; G.picks = []; G.bolts = []; G.comets = [];
  G.buffs.frenzy = 0; G.event = null; G.warp = null;
  setupSector();
  syncDrones();
  G.flash = 1.4;
  G.banner = { title: 'SALTO QUANTICO', sub: `+${U.fmt(gain)} FRAGMENTOS ESTELARES`, t: 0, life: 4, col: '#ff6ae0' };
  SFX.play('prestige');
  log(`Salto Quântico! +${U.fmt(gain)} fragmentos.`, '#ff6ae0');
  save();
}
function buyPrestige(id) {
  const p = PRESTIGE.find(x => x.id === id), l = S.pupg[id] || 0;
  if (l >= p.max) return;
  const c = p.cost(l);
  if (S.shards < c) { SFX.play('deny'); return; }
  S.shards -= c;
  S.pupg[id] = l + 1;
  SFX.play('unlock');
}

/* ---------- Comunicações, textos e efeitos ---------- */
// Mensagem para o painel de comunicações (fila com texto digitado em ui.js)
function log(text, col, who) {
  if (typeof UI !== 'undefined' && UI.comms) UI.comms.say(text, col, who);
}
function floatText(x, y, text, col, big) {
  G.floats.push({ x, y, text, col, t: 0, life: big ? 1.5 : 1.0, big: !!big });
  if (G.floats.length > 40) G.floats.shift();
}
function part(x, y, vx, vy, life, col, o) {
  if (G.parts.length >= D.pcap()) return;
  o = o || {};
  G.parts.push({ x, y, vx, vy, life, max: life, col, sz: o.sz || 1, add: !!o.add, drag: o.drag == null ? 1.6 : o.drag, grav: o.grav || 0, spr: o.spr || null, fi: Math.random() * 8, fs: o.fs || 0 });
}
function sparks(x, y, cols, n, spd, add) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, s = U.rand(spd * 0.3, spd);
    part(x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.2, 0.6), U.pick(cols), { add });
  }
}
function pickup(x, y, col) { if (G.picks.length < 120) G.picks.push({ x, y, vx: U.rand(-40, 40), vy: U.rand(-40, 40), col, t: 0 }); }

/* ---------- Layout e setor ---------- */
function layout() {
  const W = G.W, H = G.H;
  G.st = { x: Math.round(Math.max(40, W * 0.13)), y: Math.round(H * 0.55) };
  G.dock = { x: G.st.x + 27, y: G.st.y };
  G.reg = { x0: Math.round(Math.max(W * 0.36, G.st.x + 64)), x1: W - 10, y0: 30, y1: H - 22 };
  G.pl = { x: Math.round(W * 0.68), y: Math.round(H * 0.3) };
}
function planetSize() {
  const base = Math.round(Math.min(G.H * 0.5, G.W * 0.32, 150));
  return SECTORS[S.sector].planet.type === 'star' ? Math.round(base * 0.45) : base;
}
function setupSector() {
  const sec = SECTORS[S.sector];
  G.bg = GFX.makeNebula(G.W, G.H, sec.neb, 1000 + S.sector * 17);
  G.planet = new GFX.Planet(sec.planet, planetSize(), 500 + S.sector * 31);
  G.planet.render(0);
  G.debris = [0, 1, 2, 3].map(k => GFX.makeAsteroid({ r: 1.8 + (k % 2) * 1.2, rock: sec.rock, ore: sec.rock, density: 0, seed: 50 + k + S.sector * 10, frames: 8 }));
  makeStars();
}
function makeStars() {
  const area = G.W * G.H;
  const counts = [area / 650, area / 1500, area / 4000];
  const cols = ['#4a4e7a', '#9aa2e0', '#ffffff'];
  G.stars = counts.map((n, k) => Array.from({ length: Math.floor(n) }, () => ({
    x: Math.random() * G.W, y: Math.random() * G.H, ph: Math.random() * 6.28,
    c: k === 2 && Math.random() < 0.35 ? U.pick(['#ffd9a0', '#a0d8ff', '#ffb0e0']) : cols[k]
  })));
  G.dust = Array.from({ length: Math.floor(area / 3000) }, () => ({ x: Math.random() * G.W, y: Math.random() * G.H, s: U.rand(14, 30) }));
}
function resize() {
  const vp = document.getElementById('viewport');
  const r = vp.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  const scale = U.clamp(Math.round(r.width / 420), 2, 5);
  const W = Math.ceil(r.width / scale), H = Math.ceil(r.height / scale);
  const changed = W !== G.W || H !== G.H || !G.bg;
  G.cv.width = W; G.cv.height = H;
  G.cv.style.width = W * scale + 'px'; G.cv.style.height = H * scale + 'px';
  G.W = W; G.H = H; G.scale = scale;
  G.ctx.imageSmoothingEnabled = false;
  layout();
  if (changed && S) {
    setupSector();
    G.vig = GFX.makeVignette(W, H);
    for (const a of G.ast) { a.x = U.clamp(a.x, G.reg.x0 + a.R, G.reg.x1 - a.R); a.y = U.clamp(a.y, G.reg.y0 + a.R, G.reg.y1 - a.R); }
  }
}

/* ---------- Asteroides ---------- */
function makeAst(o) {
  o = o || {};
  const sec = SECTORS[S.sector], r = G.reg;
  const ore = o.ore != null ? o.ore : U.wpick(sec.ores, sec.w);
  const sz = o.sz || U.wpick(['s', 'm', 'l'], [0.45, 0.37, 0.18]);
  const R = Math.round(sz === 's' ? U.rand(5, 7) : sz === 'm' ? U.rand(9, 11) : U.rand(13, 16));
  const rich = o.rich != null ? o.rich : Math.random() < D.rich() + (o.shower ? 0.2 : 0);
  const oc = ORES[ore];
  const art = GFX.makeAsteroid({ r: R, rock: sec.rock, ore: oc.col, density: rich ? 0.2 : 0.08, glow: !!oc.glow, seed: U.randi(1, 1e9), frames: sz === 's' ? 16 : 24 });
  const base = { s: 8, m: 20, l: 45 }[sz];
  const hp = base * D.hpu(S.sector);
  let x, y, vx, vy;
  const tx = U.rand(r.x0 + R, r.x1 - R), ty = U.rand(r.y0 + R, r.y1 - R);
  if (o.shower) { x = U.rand(r.x0 + 40, G.W + 40); y = -R - 4; vx = -U.rand(15, 35); vy = U.rand(45, 70); }
  else { x = G.W + R + U.rand(2, 20); y = ty; vx = -U.rand(24, 36); vy = U.rand(-2, 2); }
  return {
    id: G.astId++, x, y, vx, vy, R, sz, ore, rich, units: base * (rich ? 5 : 1), hp, maxHp: hp, art,
    fa: U.rand(0, 24), fs: U.rand(2, 6) * (Math.random() < 0.5 ? -1 : 1), flash: 0, hitT: 0,
    alive: true, entering: true, targ: 0, shower: !!o.shower, tx, ty
  };
}
function inRegion(a) { const r = G.reg; return a.x >= r.x0 + a.R && a.x <= r.x1 - a.R && a.y >= r.y0 + a.R && a.y <= r.y1 - a.R; }
function damageAsteroid(a, dmg, byClick) {
  if (!a.alive || dmg <= 0) return 0;
  const d = Math.min(dmg, a.hp);
  const units = (d / a.maxHp) * a.units;
  a.hp -= d;
  a.hitT = 2;
  if (byClick) a.flash = 0.1;
  if (a.hp <= a.maxHp * 1e-9) destroyAsteroid(a);
  return units;
}
function destroyAsteroid(a) {
  a.alive = false;
  S.stats.asteroids++;
  if (a.rich) S.stats.rich++;
  const sf = { s: 1, m: 2, l: 3 }[a.sz];
  const dg = (1 + S.sector) * sf * (a.rich ? 3 : 1) * D.dataMult();
  S.data += dg; G.dataGain += dg;
  if (S.research.collector) addOre(a.ore, a.units * 0.3, true);
  const sec = SECTORS[S.sector], rc = sec.rock, oc = ORES[a.ore].col;
  const n = 8 + sf * 9;
  for (let i = 0; i < n; i++) {
    const an = Math.random() * 6.2832, sp = U.rand(10, 46) * (0.7 + sf * 0.25);
    part(a.x + Math.cos(an) * a.R * 0.5, a.y + Math.sin(an) * a.R * 0.5, Math.cos(an) * sp, Math.sin(an) * sp, U.rand(0.5, 1.3), Math.random() < 0.35 ? oc[3] : rc[U.randi(1, 4)], { sz: Math.random() < 0.3 ? 2 : 1 });
  }
  for (let i = 0; i < 6 + sf * 5; i++) {
    const an = Math.random() * 6.2832, sp = U.rand(8, 30);
    part(a.x, a.y, Math.cos(an) * sp, Math.sin(an) * sp, U.rand(0.25, 0.6), U.pick(['#fff3b0', '#ffb040', '#ff6a20']), { add: true, sz: 2, drag: 3 });
  }
  for (let i = 0; i < sf * 2 + 1; i++) {
    const an = Math.random() * 6.2832, sp = U.rand(8, 22);
    part(a.x, a.y, Math.cos(an) * sp, Math.sin(an) * sp, U.rand(1.4, 2.6), null, { spr: U.pick(G.debris), fs: U.rand(-12, 12), drag: 0.6 });
  }
  G.rings.push({ x: a.x, y: a.y, r: a.R * 0.5, max: a.R * 2.4, t: 0, col: oc[4] });
  G.flashes.push({ x: a.x, y: a.y, r: Math.min(10, Math.round(a.R * 0.8)), t: 0, life: 0.25, col: a.rich ? '#ffe9a0' : '#ffb060' });
  for (let i = 0; i < 1 + sf; i++) pickup(a.x, a.y, oc[3]);
  floatText(a.x, a.y - a.R - 6, `+${U.fmt(dg)} DADOS`, '#5ef2ff');
  if (a.rich) floatText(a.x, a.y - a.R - 13, 'RICO!', '#ffd23f');
  G.shake = Math.max(G.shake, sf * 0.8);
  SFX.play('boom', 0.12);
}
function astAt(x, y) {
  let best = null, bd = 1e9;
  for (const a of G.ast) {
    if (!a.alive) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < a.R + 3 && d < bd) { bd = d; best = a; }
  }
  return best;
}

/* ---------- Drones ---------- */
function newDrone() {
  const id = G.droneSeq++;
  return { id, x: G.dock.x, y: G.dock.y, vx: 0, vy: 0, state: 'dock', t: 0.2 + (id % 7) * 0.25, target: null, cargo: { ore: -1, amt: 0 }, face: 1, spread: (((id * 0.6180339) % 1) - 0.5) * 2.4 };
}
function syncDrones() {
  const n = D.drones();
  while (G.drones.length < n) G.drones.push(newDrone());
  while (G.drones.length > n) { const d = G.drones.pop(); releaseTarget(d); }
}
function releaseTarget(d) { if (d.target) { d.target.targ = Math.max(0, d.target.targ - 1); d.target = null; } }
function setTarget(d, a) { releaseTarget(d); d.target = a; a.targ++; }
function pickTarget(d) {
  let best = null, bs = 1e9;
  for (const a of G.ast) {
    if (!a.alive || a.entering) continue;
    if (d.cargo.amt > 0 && a.ore !== d.cargo.ore) continue;
    const sc = Math.hypot(a.x - d.x, a.y - d.y) + a.targ * 32 - (a.rich ? 70 : 0) + Math.random() * 25;
    if (sc < bs) { bs = sc; best = a; }
  }
  return best;
}
function moveTo(d, tx, ty, spd, dt) {
  const dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy);
  const s = spd * Math.min(1, dist / 16 + 0.12);
  const dvx = dist > 0.01 ? (dx / dist) * s : 0, dvy = dist > 0.01 ? (dy / dist) * s : 0;
  const k = Math.min(1, dt * 5);
  d.vx += (dvx - d.vx) * k; d.vy += (dvy - d.vy) * k;
  d.x += d.vx * dt; d.y += d.vy * dt;
  if (Math.abs(d.vx) > 4) d.face = d.vx > 0 ? 1 : -1;
  return dist;
}
function minePoint(d, a) {
  const ang = Math.atan2(G.st.y - a.y, G.st.x - a.x) + d.spread, r = a.R + 7;
  return [a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r];
}
function updateDrone(d, dt) {
  const spd = D.speed();
  if (d.state === 'dock') {
    d.x = G.dock.x; d.y = G.dock.y; d.vx = 0; d.vy = 0;
    d.t -= dt;
    if (d.t > 0 || G.warp) return;
    const a = pickTarget(d);
    if (a) { setTarget(d, a); d.state = 'out'; d.vx = spd * 0.5; d.face = 1; } else d.t = 0.4;
    return;
  }
  if (d.state === 'out' || d.state === 'mine') {
    const a = d.target;
    if (!a || !a.alive) {
      releaseTarget(d);
      if (d.cargo.amt < D.cargo() * 0.7) {
        const n = pickTarget(d);
        if (n) { setTarget(d, n); d.state = 'out'; return; }
      }
      d.state = 'back';
      return;
    }
    const mp = minePoint(d, a);
    const dist = moveTo(d, mp[0], mp[1], spd, dt);
    if (d.state === 'out') { if (dist < 3) d.state = 'mine'; return; }
    d.face = a.x > d.x ? 1 : -1;
    if (dist > 9) { d.state = 'out'; return; }
    const cap = D.cargo(), room = cap - d.cargo.amt;
    const dmg = Math.min(D.dps() * dt, room * (a.maxHp / a.units));
    const u = damageAsteroid(a, dmg, false);
    d.cargo.ore = a.ore;
    d.cargo.amt += u;
    if (Math.random() < dt * 22) {
      const ang = Math.atan2(d.y - a.y, d.x - a.x);
      const ix = a.x + Math.cos(ang) * a.R * 0.8, iy = a.y + Math.sin(ang) * a.R * 0.8;
      part(ix, iy, Math.cos(ang + U.rand(-1, 1)) * U.rand(10, 35), Math.sin(ang + U.rand(-1, 1)) * U.rand(10, 35), U.rand(0.2, 0.5), U.pick([ORES[a.ore].col[3], ORES[a.ore].col[4], '#ffffff']), { add: true });
    }
    if (d.cargo.amt >= cap * 0.999) { releaseTarget(d); d.state = 'back'; }
    return;
  }
  if (d.state === 'back') {
    const dist = moveTo(d, G.dock.x, G.dock.y, spd, dt);
    if (dist < 3) {
      if (d.cargo.amt > 0) {
        addOre(d.cargo.ore, d.cargo.amt, true);
        G.dockGlow = 0.6;
        sparks(G.dock.x, G.dock.y, [ORES[d.cargo.ore].col[4], '#ffffff'], 3, 18, true);
      }
      d.cargo.amt = 0; d.cargo.ore = -1;
      d.state = 'dock'; d.t = 0.35;
    }
  }
}

/* ---------- Cliques, cometas, torreta ---------- */
function clickAt(x, y, auto) {
  if (G.warp) return;
  for (const c of G.comets) if (Math.hypot(c.x - x, c.y - y) < 12) { catchComet(c); return; }
  const a = astAt(x, y);
  if (!a) return;
  let dmg = D.click();
  const crit = Math.random() < D.crit();
  if (crit) { dmg *= 5; S.stats.crits++; G.shake = Math.max(G.shake, 2.5); }
  S.stats.clicks++;
  const u = damageAsteroid(a, dmg, true);
  addOre(a.ore, u, false);
  const oc = ORES[a.ore].col;
  sparks(x, y, [oc[3], oc[4], '#ffffff'], crit ? 16 : 6, crit ? 70 : 45, true);
  for (let i = 0; i < Math.min(3, 1 + Math.floor(u / 4)); i++) pickup(x, y, oc[3]);
  floatText(x, y - 8, '+' + U.fmt(u), oc[4], crit);
  if (crit) floatText(x, y - 20, 'CRITICO!', '#ff6a6a', false);
  if (!auto || crit) SFX.play(crit ? 'crit' : 'hit');
}
function spawnComet() {
  const fromLeft = Math.random() < 0.5;
  G.comets.push({ x: fromLeft ? -10 : G.W + 10, y: U.rand(G.H * 0.12, G.H * 0.5), vx: (fromLeft ? 1 : -1) * U.rand(34, 50), vy: U.rand(3, 12), t: 0 });
  log('Um cometa dourado cruza o setor! Clique nele.', '#ffd23f');
  SFX.play('comet');
}
function catchComet(c) {
  c.dead = true;
  S.stats.comets++;
  const gm = S.pupg.golden ? 2 : 1;
  const r = Math.random();
  let msg;
  if (r < 0.45) {
    const v = Math.max(60, G.cps * 90, (D.click() / D.hpu(S.sector)) * 60 * priceOf(SECTORS[S.sector].ores[0])) * gm;
    earn(v); msg = `+${U.fmt(v)} CR`;
    log(`Cometa capturado: +${U.fmt(v)} créditos`, '#ffd23f');
  } else if (r < 0.8) {
    G.buffs.frenzy = Math.max(G.buffs.frenzy, 30 * gm);
    msg = 'FRENESI!';
    log(`Frenesi: drones e cliques ×3 por ${30 * gm}s`, '#ffd23f');
  } else {
    const v = Math.max(10, S.dataRate * 150, (1 + S.sector) * 12) * gm;
    S.data += v; msg = `+${U.fmt(v)} DADOS`;
    log(`Cometa capturado: +${U.fmt(v)} dados`, '#5ef2ff');
  }
  floatText(c.x, c.y - 10, msg, '#ffd23f', true);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * 6.2832, s = U.rand(10, 80);
    part(c.x, c.y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.4, 1.2), U.pick(['#fff3b0', '#ffd23f', '#ffffff', '#ff9a3a']), { add: true, sz: Math.random() < 0.3 ? 2 : 1 });
  }
  G.rings.push({ x: c.x, y: c.y, r: 2, max: 26, t: 0, col: '#ffd23f' });
  G.shake = Math.max(G.shake, 2);
  SFX.play('ach');
}
function updateTurret(dt) {
  if (!S.research.turret) return;
  G.timers.turret -= dt;
  G.muzzle = Math.max(0, G.muzzle - dt);
  if (G.timers.turret > 0) return;
  const cands = G.ast.filter(a => a.alive && !a.entering);
  if (!cands.length) { G.timers.turret = 0.3; return; }
  G.timers.turret = D.turretInt();
  const a = U.pick(cands);
  const sx = G.st.x, sy = G.st.y - 13;
  G.tang = Math.atan2(a.y - sy, a.x - sx);
  G.muzzle = 0.08;
  G.bolts.push({ x: sx + Math.cos(G.tang) * 6, y: sy + Math.sin(G.tang) * 6, a, vx: 0, vy: 0 });
  SFX.play('zap', 0.1);
}

/* ---------- Eventos e mercado ---------- */
function updateEvents(dt) {
  const T = G.timers;
  T.comet -= dt;
  if (T.comet <= 0) { spawnComet(); T.comet = U.rand(90, 200) / (S.research.comet ? 2 : 1); }
  T.shower -= dt;
  if (T.shower <= 0 && !G.event) {
    G.event = { type: 'shower', t: 25, name: 'Chuva de Meteoros' };
    G.banner = { title: 'CHUVA DE METEOROS', sub: 'ASTEROIDES EXTRAS E MAIS RICOS', t: 0, life: 3, col: '#ff9a3a' };
    log('Chuva de meteoros! Asteroides extras por 25s.', '#ff9a3a');
    T.shower = U.rand(300, 480);
  }
  T.boom -= dt;
  if (T.boom <= 0) {
    const seen = ORES.map((o, i) => i).filter(i => S.seen[i]);
    const i = U.pick(seen);
    S.prices[i] = U.rand(2.2, 3);
    log(`Alta no mercado: ${ORES[i].name} a ${Math.round(S.prices[i] * 100)}%!`, '#7dff8a');
    T.boom = U.rand(120, 240);
  }
  if (G.event) { G.event.t -= dt; if (G.event.t <= 0) G.event = null; }
  if (G.buffs.frenzy > 0) G.buffs.frenzy -= dt;
}
function marketTick() {
  for (let i = 0; i < ORES.length; i++) {
    let m = S.prices[i];
    m += (1 - m) * 0.035 + (Math.random() - 0.5) * 0.12;
    S.prices[i] = U.clamp(m, 0.35, 3.2);
    G.hist[i].push(S.prices[i]);
    if (G.hist[i].length > HIST_LEN) G.hist[i].shift();
  }
}
// Uma passada da venda automática (limiar de preço, reserva das fornalhas e opção de lingotes).
// Usada tanto em tempo real quanto nos ganhos offline.
function autoSellPass() {
  let v = 0;
  for (let i = 0; i < ORES.length; i++) {
    if (S.prices[i] < S.autosell.thr) continue;
    v += sellOre(i, true, reserveOf(i));
    if (S.autosell.ingots) v += sellIngot(i, true);
  }
  return v;
}
function autoSell() {
  if (!S.research.autosell || !S.autosell.on) return;
  const v = autoSellPass();
  if (v > 0) { floatText(G.dock.x, G.dock.y - 14, '+' + U.fmt(v), '#ffd23f'); SFX.play('coin', 0.5); }
}
function refineTick(dt) {
  const n = D.furnaces(), T = D.refineTime(), B = D.batch();
  while (S.furnaces.length < n) S.furnaces.push({ ore: -1, prog: 0, busy: false, take: 0 });
  let any = false;
  for (let k = 0; k < n; k++) {
    const f = S.furnaces[k];
    if (f.ore < 0) continue;
    if (!f.busy) {
      const take = Math.min(B, Math.floor(S.ores[f.ore] / 10) * 10);
      if (take < 10) continue;
      S.ores[f.ore] -= take; f.take = take; f.busy = true; f.prog = 0;
    }
    any = true;
    f.prog += dt / T;
    if (f.prog >= 1) {
      const out = f.take / 10;
      f.prog = 0; f.busy = false;
      S.ingots[f.ore] += out; S.stats.ingots += out;
    }
  }
  G.refineFx = any;
}
function setFurnace(k, ore) {
  const f = S.furnaces[k];
  if (!f) return;
  if (f.busy && f.ore >= 0 && f.ore !== ore) { S.ores[f.ore] += f.take; f.busy = false; f.prog = 0; f.take = 0; }
  f.ore = ore;
}

/* ---------- Conquistas e missões ---------- */
function checkProgress() {
  for (const a of ACH) {
    if (!S.ach[a.id] && a.c(S)) {
      S.ach[a.id] = 1;
      UI.toast('Conquista desbloqueada', `${a.n} · +3% no valor dos minérios`, 'trophy', 'gold');
      SFX.play('ach');
    }
  }
  const g = GOALS[S.goal];
  if (g && g.c(S)) {
    earn(g.r);
    S.goal++;
    UI.toast('Missão concluída', `${g.t} · +${U.fmt(g.r)} créditos`, 'star', 'cyan');
    SFX.play('unlock');
  }
}

/* ---------- Atualização principal ---------- */
function update(dt) {
  G.t += dt;
  S.stats.play += dt;
  if (G.warp) updateWarp(dt);
  updateEvents(dt);

  // asteroides: surgimento
  const shower = G.event && G.event.type === 'shower';
  const maxA = D.maxAst() + (shower ? 6 : 0);
  G.spawnT -= dt;
  if (!G.warp && G.ast.length < maxA && G.spawnT <= 0) {
    G.ast.push(makeAst(shower && Math.random() < 0.8 ? { shower: true, sz: Math.random() < 0.7 ? 's' : 'm' } : {}));
    G.spawnT = shower ? 0.45 : G.ast.length < 3 ? 0.3 : U.rand(0.8, 2);
  }
  // asteroides: movimento
  const r = G.reg;
  for (const a of G.ast) {
    a.fa += dt * a.fs;
    if (a.flash > 0) a.flash -= dt;
    if (a.hitT > 0) a.hitT -= dt;
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.entering) {
      if (a.shower && Math.random() < dt * 30) part(a.x + U.rand(-2, 2), a.y - a.R * 0.6, U.rand(-4, 4), -U.rand(10, 25), U.rand(0.2, 0.5), U.pick(['#ffb040', '#ff6a20', '#fff3b0']), { add: true, sz: 2 });
      if (inRegion(a) && a.x <= a.tx + 2 && (!a.shower || a.y >= a.ty)) { a.entering = false; a.vx = U.rand(-3, 3); a.vy = U.rand(-3, 3); }
      if (a.x < -40 || a.y > G.H + 40) a.alive = false;
      continue;
    }
    if (a.x < r.x0 + a.R) a.vx = Math.abs(a.vx) + 0.5;
    if (a.x > r.x1 - a.R) a.vx = -Math.abs(a.vx) - 0.5;
    if (a.y < r.y0 + a.R) a.vy = Math.abs(a.vy) + 0.5;
    if (a.y > r.y1 - a.R) a.vy = -Math.abs(a.vy) - 0.5;
    a.vx = U.clamp(a.vx, -6, 6); a.vy = U.clamp(a.vy, -6, 6);
    if ((a.rich || ORES[a.ore].glow) && Math.random() < dt * (a.rich ? 4 : 2)) {
      const an = Math.random() * 6.2832, rr = Math.random() * a.R;
      part(a.x + Math.cos(an) * rr, a.y + Math.sin(an) * rr, 0, -4, 0.5, a.rich ? '#fff3b0' : ORES[a.ore].col[4], { add: true, drag: 0 });
    }
  }
  for (let i = 0; i < G.ast.length; i++) {
    const a = G.ast[i];
    if (a.entering) continue;
    for (let j = i + 1; j < G.ast.length; j++) {
      const b = G.ast[j];
      if (b.entering) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.R + b.R + 4;
      if (d < min) {
        const p = ((min - d) / d) * Math.min(1, dt * 2);
        a.x -= dx * p * 0.5; a.y -= dy * p * 0.5; b.x += dx * p * 0.5; b.y += dy * p * 0.5;
      }
    }
  }
  G.ast = G.ast.filter(a => a.alive);

  // drones
  syncDrones();
  for (const d of G.drones) updateDrone(d, dt);
  G.dockGlow = Math.max(0, G.dockGlow - dt * 2);

  // torreta e projéteis
  updateTurret(dt);
  for (const b of G.bolts) {
    const a = b.a;
    if (!a.alive) { b.dead = true; continue; }
    const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    if (d < a.R) {
      b.dead = true;
      const u = damageAsteroid(a, D.click() * 0.6, false);
      addOre(a.ore, u, true);
      sparks(b.x, b.y, ['#5ef2ff', '#ffffff', ORES[a.ore].col[4]], 5, 40, true);
      continue;
    }
    b.vx = (dx / d) * 260; b.vy = (dy / d) * 260;
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  G.bolts = G.bolts.filter(b => !b.dead);

  // cometas
  for (const c of G.comets) {
    c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt;
    if (Math.random() < dt * 60) part(c.x + U.rand(-1, 1), c.y + U.rand(-1, 1), -c.vx * 0.15 + U.rand(-4, 4), -c.vy * 0.15 + U.rand(-4, 4), U.rand(0.5, 1.1), U.pick(['#ffd23f', '#fff3b0', '#ff9a3a', '#ffffff']), { add: true, drag: 0.8 });
    if (c.x < -30 || c.x > G.W + 30 || c.y > G.H + 30) c.dead = true;
  }
  G.comets = G.comets.filter(c => !c.dead);

  // partículas
  for (const p of G.parts) {
    p.life -= dt;
    const dr = Math.max(0, 1 - p.drag * dt);
    p.vx *= dr; p.vy *= dr; p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.spr) p.fi += p.fs * dt;
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const p of G.picks) {
    p.t += dt;
    const dx = G.dock.x - p.x, dy = G.dock.y - p.y, d = Math.hypot(dx, dy) || 1;
    const acc = 180 + p.t * 500;
    p.vx += (dx / d) * acc * dt; p.vy += (dy / d) * acc * dt;
    const dr = Math.max(0, 1 - dt * 2.5);
    p.vx *= dr; p.vy *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (d < 5 || p.t > 4) { p.dead = true; G.dockGlow = Math.max(G.dockGlow, 0.4); }
  }
  G.picks = G.picks.filter(p => !p.dead);
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter(f => f.t < f.life);
  for (const w of G.rings) w.t += dt;
  G.rings = G.rings.filter(w => w.t < 0.45);
  for (const f of G.flashes) f.t += dt;
  G.flashes = G.flashes.filter(f => f.t < f.life);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = null; }
  G.shake = Math.max(0, G.shake - dt * 9);
  if (G.flash > 0) G.flash -= dt;

  // mouse: segurar para minerar (5 golpes/s)
  if (G.mouse.down) {
    G.mouse.hold += dt;
    if (G.mouse.hold >= 0.2) { G.mouse.hold -= 0.2; clickAt(G.mouse.x, G.mouse.y, true); }
  }
  G.hover = G.mouse.in ? astAt(G.mouse.x, G.mouse.y) : null;

  // economia
  refineTick(dt);
  const T = G.timers;
  T.market += dt; if (T.market >= 2) { T.market = 0; marketTick(); }
  T.auto += dt; if (T.auto >= 1) { T.auto = 0; autoSell(); }
  T.rate += dt;
  if (T.rate >= 1) {
    for (let i = 0; i < ORES.length; i++) { S.rates[i] = S.rates[i] * 0.85 + (G.gain[i] / T.rate) * 0.15; G.gain[i] = 0; }
    S.dataRate = S.dataRate * 0.85 + (G.dataGain / T.rate) * 0.15;
    G.dataGain = 0;
    let c = 0;
    for (let i = 0; i < ORES.length; i++) c += S.rates[i] * priceOf(i);
    G.cps = c;
    T.rate = 0;
  }
  T.check += dt; if (T.check >= 1) { T.check = 0; checkProgress(); }
  T.save += dt; if (T.save >= 15) { T.save = 0; save(); }
}
function updateWarp(dt) {
  const w = G.warp;
  w.t += dt;
  if (!w.switched && w.t >= 0.9) {
    w.switched = true;
    S.sector = w.to;
    for (const d of G.drones) {
      if (d.cargo.amt > 0) addOre(d.cargo.ore, d.cargo.amt, true);
      d.cargo.amt = 0; d.cargo.ore = -1; d.target = null; d.state = 'dock'; d.t = 0.5 + Math.random();
    }
    G.ast = []; G.parts = []; G.picks = []; G.bolts = []; G.spawnT = 0.3;
    for (const o of SECTORS[S.sector].ores) S.seen[o] = S.seen[o] || o === SECTORS[S.sector].ores[0];
    setupSector();
    const sec = SECTORS[S.sector];
    G.banner = { title: sec.name.toUpperCase(), sub: `SETOR ${S.sector + 1} · DUREZA ×${U.fmt(D.hpu(S.sector))}`, t: 0, life: 3.5, col: '#ffffff' };
  }
  if (w.t >= 1.8) G.warp = null;
}

/* ---------- Renderização ---------- */
function pline(c, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  while (n++ < 800) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function pcircle(c, x, y, r) {
  const n = Math.max(10, Math.floor(r * 6.5));
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832; c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); }
}
const STAR_SPD = [1.2, 3.5, 8];
function render() {
  const c = G.ctx, W = G.W, H = G.H, t = G.t;
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.drawImage(G.bg, 0, 0);

  // estrelas em paralaxe
  for (let k = 0; k < 3; k++) {
    const sp = STAR_SPD[k] * (G.warp ? 1 + warpK() * 40 : 1);
    for (const s of G.stars[k]) {
      const x = (((s.x - t * sp) % W) + W) % W;
      const tw = Math.sin(t * (1.5 + k) + s.ph);
      if (k === 0 && tw < -0.4) continue;
      c.fillStyle = s.c;
      c.fillRect(x | 0, s.y | 0, 1, 1);
      if (k === 2 && tw > 0.9) { c.globalAlpha = 0.45; c.fillRect((x | 0) - 1, s.y | 0, 3, 1); c.fillRect(x | 0, (s.y | 0) - 1, 1, 3); c.globalAlpha = 1; }
    }
  }

  let sx = 0, sy = 0;
  if (G.shake > 0.3 && S.settings.shake) { sx = Math.round(U.rand(-G.shake, G.shake)); sy = Math.round(U.rand(-G.shake, G.shake)); }
  c.save();
  c.translate(sx, sy);

  // planeta / estrela
  if (G.frame % 2 === 0) G.planet.render(t);
  if (SECTORS[S.sector].planet.type === 'star') {
    c.globalCompositeOperation = 'lighter';
    const ang = t * 0.6, len = Math.max(W, H);
    for (let k = 0; k < 2; k++) {
      const a = ang + k * Math.PI;
      c.globalAlpha = 0.25;
      c.fillStyle = '#6a9cff';
      for (let i = 6; i < len; i += 1) { const w = 1 + Math.floor(i / 60); c.fillRect(Math.round(G.pl.x + Math.cos(a) * i), Math.round(G.pl.y + Math.sin(a) * i * 0.35), w, w); }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
  G.planet.drawTo(c, G.pl.x, G.pl.y);

  // poeira distante
  c.fillStyle = 'rgba(180,190,255,0.25)';
  for (const d of G.dust) { const x = (((d.x - t * d.s) % W) + W) % W; c.fillRect(x | 0, d.y | 0, 2, 1); }

  // cometas (cabeça)
  c.globalCompositeOperation = 'lighter';
  for (const k of G.comets) {
    c.drawImage(GFX.glow('#ffd23f', 7), Math.round(k.x) - 7, Math.round(k.y) - 7);
    c.drawImage(GFX.glow('#fff3b0', 3), Math.round(k.x) - 3, Math.round(k.y) - 3);
  }
  c.globalCompositeOperation = 'source-over';
  for (const k of G.comets) { c.fillStyle = '#ffffff'; c.fillRect(Math.round(k.x) - 1, Math.round(k.y) - 1, 2, 2); }

  // asteroides
  for (const a of G.ast) {
    const fr = a.art.frames, n = fr.length;
    const f = fr[((Math.floor(a.fa) % n) + n) % n];
    const dx = Math.round(a.x - a.art.S / 2), dy = Math.round(a.y - a.art.S / 2);
    c.drawImage(f, dx, dy);
    if (a.flash > 0) {
      const S2 = a.art.S;
      G.tctx.clearRect(0, 0, S2, S2);
      G.tctx.globalCompositeOperation = 'source-over';
      G.tctx.drawImage(f, 0, 0);
      G.tctx.globalCompositeOperation = 'source-atop';
      G.tctx.fillStyle = 'rgba(255,255,255,0.8)';
      G.tctx.fillRect(0, 0, S2, S2);
      c.drawImage(G.tmp, 0, 0, S2, S2, dx, dy, S2, S2);
    }
  }

  // estação
  GFX.drawStation(c, G.st.x, G.st.y, t, { lvl: D.stLevel(), turret: !!S.research.turret, tang: G.tang, muzzle: G.muzzle, refine: G.refineFx, dockGlow: G.dockGlow });

  // lasers
  const tier = D.tier(), dt = GFX.DRONE_T[tier];
  const lcol = G.buffs.frenzy > 0 ? '#ffd23f' : dt.e;
  c.globalCompositeOperation = 'lighter';
  for (const d of G.drones) {
    if (d.state !== 'mine' || !d.target || !d.target.alive) continue;
    const a = d.target;
    const nx = d.x + d.face * 6, ny = d.y;
    const ang = Math.atan2(ny - a.y, nx - a.x);
    const ex = a.x + Math.cos(ang) * a.R * 0.7, ey = a.y + Math.sin(ang) * a.R * 0.7;
    c.fillStyle = lcol;
    c.globalAlpha = 0.3;
    pline(c, nx, ny - 1, ex, ey - 1);
    pline(c, nx, ny + 1, ex, ey + 1);
    c.globalAlpha = 1;
    pline(c, nx, ny, ex, ey);
    if ((G.frame + d.id) % 3 === 0) { c.fillStyle = '#ffffff'; pline(c, nx, ny, ex, ey); }
    c.drawImage(GFX.glow(lcol, 4), Math.round(ex) - 4, Math.round(ey) - 4);
  }
  // projéteis da torreta
  c.fillStyle = '#5ef2ff';
  for (const b of G.bolts) {
    const l = Math.hypot(b.vx, b.vy) || 1;
    pline(c, b.x, b.y, b.x - (b.vx / l) * 4, b.y - (b.vy / l) * 4);
    c.drawImage(GFX.glow('#5ef2ff', 2), Math.round(b.x) - 2, Math.round(b.y) - 2);
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';

  // drones
  const spr = GFX.drones[tier];
  for (const d of G.drones) {
    if (d.state === 'dock') continue;
    const bob = d.state === 'mine' ? Math.round(Math.sin(t * 6 + d.id) * 0.6) : 0;
    const x = Math.round(d.x) - 5, y = Math.round(d.y) - 3 + bob;
    const sp = Math.hypot(d.vx, d.vy);
    if (sp > 6) {
      const fl = 1 + ((G.frame + d.id) % 3);
      const ex = d.face > 0 ? x - fl : x + 11;
      c.fillStyle = '#ff6a20'; c.fillRect(ex, y + 3, fl, 1);
      c.fillStyle = '#fff3b0'; c.fillRect(d.face > 0 ? x - 1 : x + 11, y + 3, 1, 1);
      if (Math.random() < 0.3) part(d.face > 0 ? x - 1 : x + 12, y + 3, -d.vx * 0.2, U.rand(-3, 3), 0.3, '#ff9a3a', { add: true, drag: 3 });
    }
    c.drawImage(d.face > 0 ? spr.r : spr.l, x, y);
    if (d.cargo.amt > 0) {
      const oc = ORES[d.cargo.ore].col;
      const full = d.cargo.amt / D.cargo();
      c.fillStyle = oc[3]; c.fillRect(x + 3, y + 7, Math.max(1, Math.round(full * 5)), 1);
    }
  }

  // partículas
  for (const p of G.parts) {
    if (p.spr) {
      const fr = p.spr.frames, n = fr.length, f = fr[((Math.floor(p.fi) % n) + n) % n];
      c.globalAlpha = Math.min(1, p.life / (p.max * 0.4));
      c.drawImage(f, Math.round(p.x - p.spr.S / 2), Math.round(p.y - p.spr.S / 2));
    }
  }
  c.globalAlpha = 1;
  for (const add of [false, true]) {
    c.globalCompositeOperation = add ? 'lighter' : 'source-over';
    for (const p of G.parts) {
      if (p.spr || p.add !== add) continue;
      c.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
      c.fillStyle = p.col;
      c.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
    }
  }
  c.globalAlpha = 1;
  // lampejos de explosão
  for (const f of G.flashes) {
    c.globalAlpha = 1 - f.t / f.life;
    c.drawImage(GFX.glow(f.col, f.r), Math.round(f.x) - f.r, Math.round(f.y) - f.r);
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  // ondas de choque
  for (const w of G.rings) {
    const k = w.t / 0.45;
    c.globalAlpha = 1 - k;
    c.fillStyle = w.col;
    pcircle(c, w.x, w.y, U.lerp(w.r, w.max, Math.sqrt(k)));
  }
  c.globalAlpha = 1;
  // coleta de minério voando até a doca
  for (const p of G.picks) {
    c.fillStyle = '#05050c'; c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 4, 4);
    c.fillStyle = p.col; c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    c.fillStyle = '#ffffff'; c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }

  // mira sobre asteroide
  const h = G.hover;
  if (h && h.alive) {
    const pul = Math.round(Math.sin(t * 8) * 1.2);
    const e = h.R + 4 + pul, x0 = Math.round(h.x - e), x1 = Math.round(h.x + e), y0 = Math.round(h.y - e), y1 = Math.round(h.y + e);
    c.fillStyle = h.rich ? '#ffd23f' : '#ffffff';
    c.fillRect(x0, y0, 3, 1); c.fillRect(x0, y0, 1, 3);
    c.fillRect(x1 - 2, y0, 3, 1); c.fillRect(x1, y0, 1, 3);
    c.fillRect(x0, y1, 3, 1); c.fillRect(x0, y1 - 2, 1, 3);
    c.fillRect(x1 - 2, y1, 3, 1); c.fillRect(x1, y1 - 2, 1, 3);
    const label = ORES[h.ore].name + (h.rich ? ' (RICO)' : '');
    U.text(c, label, h.x, y0 - 8, h.rich ? '#ffd23f' : ORES[h.ore].col[4], 1, 'center');
  }
  // barras de vida
  for (const a of G.ast) {
    if (!(a === h || (a.hitT > 0 && a.hp < a.maxHp))) continue;
    const w = Math.max(8, a.R * 2), x = Math.round(a.x - w / 2), y = Math.round(a.y + a.R + 4);
    c.fillStyle = '#05050c'; c.fillRect(x - 1, y - 1, w + 2, 4);
    c.fillStyle = '#2a2440'; c.fillRect(x, y, w, 2);
    c.fillStyle = ORES[a.ore].col[3]; c.fillRect(x, y, Math.max(1, Math.round((w * a.hp) / a.maxHp)), 2);
  }

  // textos flutuantes
  for (const f of G.floats) {
    const k = f.t / f.life;
    c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    U.text(c, f.text, f.x, f.y - k * 14, f.col, f.big ? 2 : 1, 'center');
  }
  c.globalAlpha = 1;
  c.restore();

  // dobra espacial
  if (G.warp) {
    const k = warpK();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#c8d8ff';
    const cx = W / 2, cy = H / 2;
    for (const s of G.stars[2].concat(G.stars[1])) {
      const dx = s.x - cx, dy = s.y - cy;
      c.globalAlpha = 0.5 * k;
      pline(c, s.x, s.y, s.x + dx * k * 0.6, s.y + dy * k * 0.6);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    const w = G.warp.t;
    const fl = w < 0.9 ? U.smooth(0.55, 0.9, w) : 1 - U.smooth(0.9, 1.6, w);
    c.fillStyle = `rgba(232,240,255,${fl})`;
    c.fillRect(0, 0, W, H);
  }
  if (G.flash > 0) { c.fillStyle = `rgba(255,200,250,${Math.min(1, G.flash)})`; c.fillRect(0, 0, W, H); }

  if (G.vig) c.drawImage(G.vig, 0, 0);

  // faixa de anúncio
  if (G.banner) {
    const b = G.banner, k = b.t / b.life;
    const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
    c.globalAlpha = a;
    const y = Math.round(H * 0.2);
    c.fillStyle = 'rgba(4,3,14,0.55)';
    c.fillRect(0, y - 6, W, 30);
    c.fillStyle = b.col; c.fillRect(0, y - 6, W, 1); c.fillRect(0, y + 23, W, 1);
    const sc = U.textW(b.title, 2) < W - 20 ? 2 : 1;
    U.text(c, b.title, W / 2, y, b.col, sc, 'center');
    U.text(c, b.sub, W / 2, y + 14, '#b8b4e8', 1, 'center');
    c.globalAlpha = 1;
  }
  // dica inicial
  if (S.stats.clicks === 0 && !G.warp && G.ast.length) {
    if (Math.floor(t * 2) % 2 === 0) U.text(c, 'CLIQUE NOS ASTEROIDES PARA MINERAR', W / 2, H - 14, '#ffd23f', 1, 'center');
    const a = G.ast.find(x => !x.entering);
    if (a) {
      const bob = Math.round(Math.sin(t * 6) * 2);
      c.fillStyle = '#ffd23f';
      const ax = Math.round(a.x), ay = Math.round(a.y - a.R - 10 + bob);
      c.fillRect(ax - 2, ay, 5, 1); c.fillRect(ax - 1, ay + 1, 3, 1); c.fillRect(ax, ay + 2, 1, 1);
    }
  }
}
function warpK() {
  if (!G.warp) return 0;
  const w = G.warp.t;
  return w < 0.9 ? Math.pow(w / 0.9, 2) : Math.max(0, 1 - (w - 0.9) / 0.6);
}

/* ---------- Salvar / carregar / offline ---------- */
function save() {
  if (!S) return;
  S.last = Date.now();
  S.ph = G.hist.map(h => h.slice(-HIST_LEN).map(v => Math.round(v * 100) / 100));
  U.store.set(SAVE_KEY, JSON.stringify(S));
}

/* Migração de save: cada case converte da versão N para N+1 e cai no próximo (sem break).
   Para mudar o formato: suba SAVE_VERSION, adicione o case da versão anterior e nunca apague cases antigos. */
function migrate(s) {
  const v = (s.v | 0) || 1;
  switch (v) {
    case 1:
      // v1 → v2: histórico de preços salvo (S.ph). Nenhum campo renomeado; o merge preenche o resto.
      if (!Array.isArray(s.ph)) s.ph = [];
    // falls through
    case 2: // versão atual
      break;
  }
  s.v = SAVE_VERSION;
  return s;
}
// Copia de src só as chaves que existem no estado padrão (chaves desconhecidas são ignoradas).
function mergeState(def, src) {
  for (const k in def) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    const dv = def[k], sv = src[k];
    if (Array.isArray(dv)) {
      if (!Array.isArray(sv)) continue;
      if (k === 'furnaces') def[k] = sv.length ? sv : dv;
      else for (let i = 0; i < Math.min(dv.length, sv.length); i++) dv[i] = sv[i];
    } else if (dv && typeof dv === 'object') { if (sv && typeof sv === 'object' && !Array.isArray(sv)) mergeState(dv, sv); }
    else if (typeof sv === typeof dv) def[k] = sv;
  }
  return def;
}
const num0 = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
const int0 = v => Math.floor(num0(v));
// Mapas de chave dinâmica: só ids conhecidos em data.js sobrevivem
function idMap(src, list, val) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (const x of list) { const v = val(src[x.id], x); if (v) out[x.id] = v; }
  return out;
}
// Garante tipos e limites depois do merge (protege contra saves corrompidos ou editados)
function sanitize(s, raw) {
  for (const k of ['credits', 'runCredits', 'lifeCredits', 'data', 'shards', 'dataRate']) s[k] = num0(s[k]);
  s.dataLvl = int0(s.dataLvl);
  for (let i = 0; i < ORES.length; i++) {
    s.ores[i] = num0(s.ores[i]); s.ingots[i] = num0(s.ingots[i]); s.rates[i] = num0(s.rates[i]);
    s.prices[i] = typeof s.prices[i] === 'number' && isFinite(s.prices[i]) ? U.clamp(s.prices[i], 0.35, 3.2) : 1;
    s.seen[i] = !!s.seen[i];
    const h = Array.isArray(s.ph[i]) ? s.ph[i] : [];
    s.ph[i] = h.filter(v => typeof v === 'number' && isFinite(v)).slice(-HIST_LEN).map(v => U.clamp(v, 0.35, 3.2));
  }
  for (const u of UPGRADES) s.upg[u.id] = int0(s.upg[u.id]);
  for (const k in s.stats) s.stats[k] = num0(s.stats[k]);
  s.research = idMap(raw.research, RESEARCH, v => (v ? 1 : 0));
  s.ach = idMap(raw.ach, ACH, v => (v ? 1 : 0));
  s.pupg = idMap(raw.pupg, PRESTIGE, (v, p) => Math.min(p.max, int0(v)));
  const last = SECTORS.length - 1;
  s.maxSector = U.clamp(s.maxSector | 0, 0, last);
  s.runMaxSector = U.clamp(s.runMaxSector | 0, 0, last);
  s.sector = U.clamp(s.sector | 0, 0, s.maxSector);
  s.goal = U.clamp(s.goal | 0, 0, GOALS.length);
  s.furnaces = (Array.isArray(s.furnaces) ? s.furnaces : []).slice(0, 5).filter(f => f && typeof f === 'object').map(f => {
    const ore = Number.isInteger(f.ore) && f.ore >= 0 && f.ore < ORES.length ? f.ore : -1;
    const busy = ore >= 0 && f.busy === true && num0(f.take) >= 10;
    return { ore, prog: busy ? U.clamp(num0(f.prog), 0, 1) : 0, busy, take: busy ? num0(f.take) : 0 };
  });
  if (!s.furnaces.length) s.furnaces.push({ ore: -1, prog: 0, busy: false, take: 0 });
  s.autosell.thr = U.clamp(s.autosell.thr, 0.4, 2);
  s.settings.fx = U.clamp(s.settings.fx | 0, 0, 2);
  s.buyMode = raw.buyMode === 'max' || raw.buyMode === 10 ? raw.buyMode : 1;
  if (!(typeof s.last === 'number' && isFinite(s.last))) s.last = Date.now();
  return s;
}
function loadState(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('save inválido');
  migrate(obj);
  return sanitize(mergeState(defaultState(), obj), obj);
}
// Recria G.hist a partir do histórico salvo (ou de cópias do preço atual, se não houver)
function restoreHist() {
  for (let i = 0; i < ORES.length; i++) {
    const h = S.ph[i];
    G.hist[i] = h && h.length >= 2 ? h.slice() : Array(30).fill(S.prices[i]);
  }
}
function applyOffline(sec, modal) {
  sec = Math.min(sec, D.offCap());
  if (sec < 15) return;
  const eff = D.offEff(), got = [];
  for (let i = 0; i < ORES.length; i++) {
    const u = (S.rates[i] || 0) * sec * eff;
    if (u > 0.01) { S.ores[i] += u; S.stats.mined += u; got.push([i, u]); }
  }
  const dg = (S.dataRate || 0) * sec * eff;
  S.data += dg;
  const T = D.refineTime(), B = D.batch(), ing = [];
  for (let k = 0; k < D.furnaces(); k++) {
    const f = S.furnaces[k];
    if (!f || f.ore < 0) continue;
    const nb = Math.min(Math.floor(sec / T), Math.floor(S.ores[f.ore] / B));
    if (nb > 0) { S.ores[f.ore] -= nb * B; S.ingots[f.ore] += (nb * B) / 10; S.stats.ingots += (nb * B) / 10; ing.push([f.ore, (nb * B) / 10]); }
  }
  let cr = 0;
  if (S.research.autosell && S.autosell.on) cr = autoSellPass();
  if (!got.length && !dg && !ing.length) return;
  if (modal) UI.offlineModal(sec, got, dg, ing, cr, eff);
  else UI.toast('Mineração remota', `${U.fmtTime(sec)} longe · ${got.length ? got.map(([i, u]) => `+${U.fmt(u)} ${ORES[i].name}`).join(', ') : 'sem minério'}`, 'drone', 'cyan');
}
function hardReset() {
  U.store.del(SAVE_KEY);
  S = defaultState();
  G.ast = []; G.drones = []; G.parts = []; G.picks = []; G.comets = []; G.bolts = []; G.floats = [];
  G.buffs.frenzy = 0; G.event = null;
  if (typeof UI !== 'undefined' && UI.comms) UI.comms.clear();
  restoreHist(); setupSector(); syncDrones();
}

/* ---------- Entrada e laço ---------- */
function toLocal(e) {
  const r = G.cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * G.W, y: ((e.clientY - r.top) / r.height) * G.H };
}
function initInput() {
  const cv = G.cv;
  cv.addEventListener('pointerdown', e => {
    SFX.init();
    const p = toLocal(e);
    G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.in = true; G.mouse.down = true; G.mouse.hold = 0;
    clickAt(p.x, p.y, false);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => { const p = toLocal(e); G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.in = true; });
  const up = () => { G.mouse.down = false; };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { G.mouse.in = false; G.mouse.down = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { G.hiddenAt = Date.now(); save(); }
    else if (G.hiddenAt) {
      const sec = (Date.now() - G.hiddenAt) / 1000;
      G.hiddenAt = 0;
      G.lastTs = performance.now();
      applyOffline(sec, sec > 300);
    }
  });
  window.addEventListener('beforeunload', save);
  window.addEventListener('pagehide', save);
}
function loop(ts) {
  const dt = Math.min(0.1, Math.max(0, (ts - (G.lastTs || ts)) / 1000));
  G.lastTs = ts;
  if (!document.hidden) {
    update(dt);
    render();
    G.frame++;
  }
  requestAnimationFrame(loop);
}
const Game = {
  init() {
    const raw = U.store.get(SAVE_KEY);
    let offline = 0;
    if (raw) {
      try { S = loadState(JSON.parse(raw)); offline = (Date.now() - (S.last || Date.now())) / 1000; } catch (e) { S = defaultState(); }
    } else S = defaultState();
    G.cv = document.getElementById('game');
    G.ctx = G.cv.getContext('2d');
    G.tmp = U.canvas(64, 64);
    G.tctx = G.tmp.getContext('2d');
    restoreHist();
    resize();
    if (!G.bg) { setupSector(); G.vig = GFX.makeVignette(G.W, G.H); }
    syncDrones();
    initInput();
    let rt = 0;
    const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(resize, 120); });
    ro.observe(document.getElementById('viewport'));
    G.banner = { title: SECTORS[S.sector].name.toUpperCase(), sub: `SETOR ${S.sector + 1} · ORBITA MINERADORA`, t: 0, life: 3.5, col: '#ffffff' };
    G.pendingOffline = offline;
  },
  start() {
    if (G.pendingOffline > 15) applyOffline(G.pendingOffline, true);
    requestAnimationFrame(loop);
  },
  buy: buyUpgrade, sellOre, sellIngot, sellAll, research: doResearch, travel, unlock: unlockSector,
  calib: doCalib, prestige: doPrestige, pbuy: buyPrestige, save, hardReset, shardGain, canPrestige, setFurnace,
  load(obj) { S = loadState(obj); G.ast = []; G.drones = []; restoreHist(); setupSector(); syncDrones(); save(); }
};
