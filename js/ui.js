'use strict';
/* ===== Interface: HUD, abas (build/patch), comunicações, radar, alertas, toasts, modais ===== */
const UI = { tab: 'frota', busy: false, ic: {}, thumbs: {}, el: {}, reduced: false, fIdle: [], _al: [], dbg: { builds: 0, patches: 0 } };
const $ = id => document.getElementById(id);
const img = (k, cls = '') => `<img class="px ${cls}" src="${UI.ic[k]}" alt="">`;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const seenMask = () => S.seen.map(v => (v ? 1 : 0)).join('');

/* ---------- Escrita no DOM só quando o valor muda (o último valor fica guardado no nó) ---------- */
UI.txt = (el, v) => { if (el && el._t !== v) { el._t = v; el.textContent = v; } };
UI.html = (el, v) => { if (el && el._h !== v) { el._h = v; el.innerHTML = v; } };
UI.cls = (el, c, on) => { if (!el) return; on = !!on; const k = '_c_' + c; if (el[k] !== on) { el[k] = on; el.classList.toggle(c, on); } };
UI.dis = (el, d) => { if (el && el.disabled !== !!d) el.disabled = !!d; };
UI.hide = (el, h) => { if (el && el.hidden !== !!h) el.hidden = !!h; };
UI.attr = (el, a, v) => { if (!el) return; const k = '_a_' + a; if (el[k] !== v) { el[k] = v; el.setAttribute(a, v); } };
UI.src = (el, v) => UI.attr(el, 'src', v);
UI.sty = (el, p, v) => { if (!el) return; const k = '_s_' + p; if (el[k] !== v) { el[k] = v; el.style[p] = v; } };
UI.w = (el, frac) => UI.sty(el, 'width', (U.clamp(frac || 0, 0, 1) * 100).toFixed(1) + '%');

/* ---------- Blocos: build() só quando key() muda; patch(refs) a cada atualização ---------- */
UI.block = (el, key, build, patch) => ({ el, key, build, patch: patch || (() => {}), k: null, r: {} });
UI.refsOf = el => { const r = {}; el.querySelectorAll('[data-r]').forEach(n => { r[n.getAttribute('data-r')] = n; }); return r; };
UI.run = (b, force, canBuild = true) => {
  if (!b.el) return false;
  const k = b.key();
  let built = false;
  if ((force || k !== b.k) && canBuild) {
    b.el.innerHTML = b.build();
    b.k = k; b.r = UI.refsOf(b.el); built = true;
    UI.dbg.builds++;
  }
  b.patch(b.r);
  UI.dbg.patches++;
  return built;
};

UI.init = () => {
  UI.ic = GFX.icons();
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  UI.reduced = !!(mq && mq.matches);
  if (mq && mq.addEventListener) mq.addEventListener('change', e => { UI.reduced = e.matches; });
  document.querySelectorAll('[data-ico]').forEach(e => { e.innerHTML = img(e.dataset.ico); });
  for (const id of ['credits', 'cps', 'data', 'shards', 'hudShards', 'sectorName', 'hgFleet', 'hgDetail']) UI.el[id] = $(id);
  $('tabs').innerHTML = TABS.map(t => `<button class="tab" id="tab-${t.id}" data-tab="${t.id}" title="${t.name}">${img(t.icon)}<span>${t.name}</span><i class="dot"></i></button>`).join('');
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) UI.go(b.dataset.tab); });
  $('alerts').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) UI.go(b.dataset.tab); });
  const tc = $('tabContent');
  tc.addEventListener('pointerdown', () => { UI.busy = true; });
  window.addEventListener('pointerup', () => setTimeout(() => { UI.busy = false; }, 30));
  tc.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    UI.act(b.dataset.act, b.dataset);
  });
  tc.addEventListener('change', e => { const t = e.target; if (t.dataset.chg) UI.change(t.dataset.chg, t); });
  tc.addEventListener('input', e => { const t = e.target; if (t.dataset.inp) UI.change(t.dataset.inp, t); });
  $('modal').addEventListener('click', e => {
    if (e.target.id === 'modal') { UI.closeModal(); return; }
    const b = e.target.closest('[data-act]');
    if (b) UI.act(b.dataset.act, b.dataset);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeModal(); });

  UI.tabBlock = UI.block(tc, () => UI.tab + '#' + UI.tabs[UI.tab].key(), () => UI.tabs[UI.tab].build(), r => UI.tabs[UI.tab].patch(r));
  UI.invBlock = UI.block($('inventory'), invKey, invBuild, invPatch);
  UI.goalBlock = UI.block($('goal'), () => String(S.goal), goalBuild);
  UI.evBlock = UI.block($('eventBanner'), evKey, evBuild, evPatch);
  UI.furnBlock = UI.block($('furnMini'), () => String(D.furnaces()), furnMiniBuild, furnMiniPatch);
  UI.alertBlock = UI.block($('alerts'), UI.calcAlerts, alertBuild, alertPatch);
  UI.comms.init();
  UI.radar.init();

  UI.render(true);
  UI.update();
  setInterval(UI.update, 250);
  UI.comms.say(S.stats.play > 0 ? 'Sistemas online. Bem-vindo de volta, comandante.' : 'Estação online. Clique nos asteroides para começar a minerar.', '#5ef2ff');
};

UI.go = tab => {
  if (!UI.tabs[tab]) return;
  UI.tab = tab;
  UI.render(true);
  $('tabContent').scrollTop = 0;
  SFX.play('ui');
};
UI.focusLocked = () => {
  const a = document.activeElement;
  return a && $('tabContent').contains(a) && (a.tagName === 'SELECT' || (a.tagName === 'INPUT' && a.type === 'range'));
};
// force: reconstrói sempre (troca de aba). afterAction: pode reconstruir mesmo com o ponteiro pressionado.
UI.render = (force, afterAction) => {
  const b = UI.tabBlock, tc = b.el, st = tc.scrollTop;
  const canBuild = force || afterAction || !(UI.busy || UI.focusLocked());
  if (UI.run(b, force, canBuild) && !force) tc.scrollTop = st;
  for (const t of TABS) UI.cls($('tab-' + t.id), 'on', t.id === UI.tab);
};

UI.update = () => {
  if (!S) return;
  const e = UI.el;
  UI.txt(e.credits, U.fmt(S.credits));
  UI.txt(e.cps, `+${U.fmt(G.cps)}/s`);
  UI.txt(e.data, U.fmt(S.data));
  UI.txt(e.shards, U.fmt(S.shards));
  UI.hide(e.hudShards, !(S.shards > 0 || S.stats.prestiges > 0));
  UI.txt(e.sectorName, `${S.sector + 1} · ${SECTORS[S.sector].name}`);

  UI.run(UI.invBlock);
  UI.run(UI.goalBlock);
  UI.run(UI.evBlock);

  // status da estação
  let dock = 0;
  for (const d of G.drones) if (d.state === 'dock') dock++;
  UI.txt(e.hgFleet, `${D.drones()}/${D.maxDrones()}`);
  UI.txt(e.hgDetail, `doca ${dock} · voo ${G.drones.length - dock}`);
  UI.run(UI.furnBlock);
  UI.run(UI.alertBlock);

  // indicadores nas abas
  const dots = {
    frota: UPGRADES.some(u => { const n = buyCount(u); return n > 0 && S.credits >= upCost(u, S.upg[u.id], 1); }),
    pesquisa: S.data >= calibCost(S.dataLvl) || RESEARCH.some(r => !S.research[r.id] && S.data >= r.cost && (r.req || []).every(q => S.research[q])),
    setores: S.maxSector + 1 < SECTORS.length && S.credits >= D.sectorCost(S.maxSector + 1) && S.ingots[S.maxSector] >= SECTORS[S.maxSector + 1].req,
    salto: canPrestige() || PRESTIGE.some(p => (S.pupg[p.id] || 0) < p.max && S.shards >= p.cost(S.pupg[p.id] || 0)),
    refino: S.furnaces.slice(0, D.furnaces()).some(f => f.ore < 0)
  };
  for (const t of TABS) UI.cls($('tab-' + t.id), 'alert', dots[t.id]);

  UI.comms.blink();
  UI.render(false);
};

/* ---------- Inventário, missão e eventos (sobre o canvas / topo do painel) ---------- */
function invKey() { return seenMask() + '|' + S.ingots.map(v => (v >= 1 ? 1 : 0)).join(''); }
function invBuild() {
  let inv = '', ing = '';
  ORES.forEach((o, i) => { if (S.seen[i]) inv += `<span class="chip" title="${o.name}">${img('ore' + i)}<b data-r="o${i}"></b></span>`; });
  ORES.forEach((o, i) => { if (S.ingots[i] >= 1) ing += `<span class="chip ing" title="${o.ingot}">${img('ingot' + i)}<b data-r="g${i}"></b></span>`; });
  return `<div class="inv-row">${inv}</div>${ing ? `<div class="inv-row">${ing}</div>` : ''}`;
}
function invPatch(r) {
  for (let i = 0; i < ORES.length; i++) { UI.txt(r['o' + i], U.fmt(S.ores[i])); UI.txt(r['g' + i], U.fmt(S.ingots[i])); }
}
function goalBuild() {
  const g = GOALS[S.goal];
  return g
    ? `<small>Missão ${S.goal + 1}/${GOALS.length}</small><span>${g.t}</span><em>${img('coin')} ${U.fmt(g.r)}</em>`
    : `<small>Missões</small><span>Todas concluídas. O cosmos é seu.</span>`;
}
function evKey() { return (G.buffs.frenzy > 0 ? 'f' : '') + '|' + (G.event ? G.event.type : ''); }
function evBuild() {
  let h = '';
  if (G.buffs.frenzy > 0) h += `<span class="ev gold">Frenesi ×3 · <i class="v" data-r="ft"></i></span>`;
  if (G.event) h += `<span class="ev orange">${G.event.name} · <i class="v" data-r="et"></i></span>`;
  return h;
}
function evPatch(r) {
  if (G.buffs.frenzy > 0) UI.txt(r.ft, Math.ceil(G.buffs.frenzy) + 's');
  if (G.event) UI.txt(r.et, Math.ceil(G.event.t) + 's');
}

/* ---------- Status da estação: mini-fornalhas ---------- */
function furnMiniBuild() {
  let h = '';
  for (let k = 0; k < D.furnaces(); k++) h += `<span class="mf" data-r="m${k}"><i data-r="b${k}"></i></span>`;
  return h;
}
function furnMiniPatch(r) {
  for (let k = 0; k < D.furnaces(); k++) {
    const f = S.furnaces[k] || { ore: -1, prog: 0, busy: false }, box = r['m' + k], bar = r['b' + k];
    const off = f.ore < 0, stop = !off && !f.busy;
    UI.cls(box, 'off', off); UI.cls(box, 'stop', stop);
    UI.w(bar, f.busy ? f.prog : 0);
    UI.sty(bar, 'background', off ? '#444' : ORES[f.ore].col[3]);
    UI.attr(box, 'title', `Fornalha ${ROMAN[k]}: ${off ? 'desligada' : stop ? `parada (falta ${ORES[f.ore].name})` : `fundindo ${ORES[f.ore].name}`}`);
  }
}

/* ---------- Alertas contextuais (no máximo 3, por prioridade) ---------- */
UI.calcAlerts = () => {
  const out = [], now = performance.now();
  for (let k = 0; k < D.furnaces(); k++) {
    const f = S.furnaces[k];
    if (!(f && f.ore >= 0 && !f.busy)) { UI.fIdle[k] = 0; continue; }
    if (!UI.fIdle[k]) UI.fIdle[k] = now;
    if (now - UI.fIdle[k] > 3000) out.push({ id: 'f' + k, tab: 'refino', c: 'red', t: `Fornalha ${ROMAN[k]} parada: falta ${ORES[f.ore].name}` });
  }
  let best = -1;
  for (let i = 0; i < ORES.length; i++) {
    if (S.seen[i] && S.ores[i] >= 1 && S.prices[i] >= 1.8 && (best < 0 || S.prices[i] > S.prices[best])) best = i;
  }
  if (best >= 0) out.push({ id: 'p' + best, tab: 'mercado', c: 'gold', t: `Alta: ${ORES[best].name} a ${Math.round(S.prices[best] * 100)}%` });
  const rs = RESEARCH.find(r => !S.research[r.id] && S.data >= r.cost && (r.req || []).every(q => S.research[q]));
  if (rs) out.push({ id: 'r', tab: 'pesquisa', c: 'cyan', t: `Pesquisa disponível: ${rs.name}` });
  else if (S.data >= calibCost(S.dataLvl)) out.push({ id: 'c', tab: 'pesquisa', c: 'cyan', t: 'Calibração disponível' });
  UI._al = out.slice(0, 3);
  return UI._al.map(a => a.id).join(',');
};
function alertBuild() { return UI._al.map(a => `<button class="al ${a.c}" data-tab="${a.tab}" data-r="${a.id}"></button>`).join(''); }
function alertPatch(r) { for (const a of UI._al) UI.txt(r[a.id], a.t); }

/* ---------- Comunicações: retrato + texto digitado + fila ---------- */
const C = UI.comms = {
  q: [], cur: null, pos: 0, hold: 0, timer: 0, last: 0, frame: -1, who: '', ready: false,
  init() {
    C.box = $('comms'); C.cv = $('commsFace'); C.ctx = C.cv.getContext('2d');
    C.name = $('commsWho'); C.text = $('commsText'); C.live = $('commsLive');
    C.ctx.imageSmoothingEnabled = false;
    C.cv.addEventListener('click', C.skip);
    C.ready = true;
    C.kick();
  },
  say(text, col, who) {
    C.q.push({ text: String(text), col: col || '#d9d6ff', who: PORTRAITS[who] ? who : 'ia' });
    if (C.q.length > 6) C.q.shift();
    C.kick();
  },
  clear() {
    C.q = []; C.cur = null; C.stop();
    if (C.ready) { UI.txt(C.text, ''); UI.hide(C.box, true); }
  },
  kick() {
    if (!C.ready || C.timer) return;
    C.last = performance.now();
    C.timer = setInterval(C.step, 30);
  },
  stop() { if (C.timer) clearInterval(C.timer); C.timer = 0; },
  face(f) {
    if (f === C.frame && C.cur && C.cur.who === C.who) return;
    const who = C.cur ? C.cur.who : C.who || 'ia';
    C.frame = f; C.who = who;
    C.ctx.clearRect(0, 0, 24, 24);
    C.ctx.drawImage(GFX.portrait(who)[f], 0, 0);
  },
  step() {
    const now = performance.now(), dt = Math.min(0.2, (now - C.last) / 1000);
    C.last = now;
    if (!C.cur) {
      if (!C.q.length) { C.stop(); UI.cls(C.box, 'idle', true); UI.cls(C.box, 'typing', false); C.face(0); return; }
      C.cur = C.q.shift();
      const p = PORTRAITS[C.cur.who];
      UI.hide(C.box, false); UI.cls(C.box, 'idle', false);
      UI.txt(C.name, p.name);
      UI.sty(C.text, 'color', C.cur.col);
      C.live.textContent = `${p.name}: ${C.cur.text}`;
      C.pos = UI.reduced ? C.cur.text.length : 0;
      if (UI.reduced) { UI.txt(C.text, C.cur.text); C.hold = C.q.length ? 1.4 : 4; C.face(0); return; }
    }
    const L = C.cur.text.length;
    if (C.pos < L) {
      C.pos = Math.min(L, C.pos + 45 * (C.q.length >= 3 ? 3 : 1) * dt);
      UI.txt(C.text, C.cur.text.slice(0, Math.floor(C.pos)));
      const typing = C.pos < L;
      UI.cls(C.box, 'typing', typing);
      C.face(typing ? 1 + (Math.floor(C.pos / 3) % 2) : 0);
      if (!typing) C.hold = C.q.length ? 1.4 : 4;
      return;
    }
    C.hold -= dt;
    if (C.hold <= 0) C.cur = null;
  },
  skip() {
    if (!C.cur) return;
    if (C.pos < C.cur.text.length) C.pos = C.cur.text.length - 0.01; else C.hold = 0;
    C.kick();
  },
  // piscar ocasional quando ocioso (chamado a cada 250 ms)
  blink() {
    if (!C.ready || C.cur || UI.reduced || C.box.hidden) return;
    if (C.frame === 3) C.face(0);
    else if (Math.random() < 0.07) C.face(3);
  }
};

/* ---------- Radar do setor ---------- */
const RD = UI.radar = {
  W: 56, H: 40, n: 0,
  init() {
    RD.cv = $('radarCv'); RD.ctx = RD.cv.getContext('2d'); RD.info = $('radarInfo');
    setInterval(RD.tick, 100);
  },
  tick() {
    if (document.hidden || !S || !G.W || RD.cv.offsetParent === null) return;
    if (UI.reduced && ++RD.n % 5) return;
    const c = RD.ctx, w = RD.W, h = RD.H, sx = w / G.W, sy = h / G.H, t = performance.now() / 1000;
    c.fillStyle = '#03100f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0b2626';
    for (let x = 7; x < w; x += 8) c.fillRect(x, 0, 1, h);
    for (let y = 7; y < h; y += 8) c.fillRect(0, y, w, 1);
    const cx = Math.round(G.st.x * sx), cy = Math.round(G.st.y * sy);
    if (!UI.reduced) {
      const a = t * 2.2, ca = Math.cos(a), sa = Math.sin(a);
      c.fillStyle = 'rgba(94,242,255,0.35)';
      for (let i = 2; i < 70; i++) {
        const px = Math.round(cx + ca * i), py = Math.round(cy + sa * i);
        if (px < 0 || py < 0 || px >= w || py >= h) break;
        c.fillRect(px, py, 1, 1);
      }
    }
    c.fillStyle = '#6b7396';
    for (const d of G.drones) if (d.state !== 'dock') c.fillRect(Math.round(d.x * sx), Math.round(d.y * sy), 1, 1);
    let n = 0, rich = 0;
    const blink = Math.floor(t * 4) % 2 === 0;
    for (const a of G.ast) {
      if (!a.alive) continue;
      n++;
      const px = U.clamp(Math.round(a.x * sx), 0, w - 1), py = U.clamp(Math.round(a.y * sy), 0, h - 1);
      if (a.rich) { rich++; c.fillStyle = blink || UI.reduced ? '#ffd23f' : '#fff3b0'; c.fillRect(px - 1, py - 1, 2, 2); continue; }
      const s = a.sz === 'l' ? 2 : 1;
      c.fillStyle = ORES[a.ore].col[3];
      c.fillRect(px, py, s, s);
    }
    for (const k of G.comets) {
      const off = k.x < 0 || k.x > G.W;
      const px = U.clamp(Math.round(k.x * sx), 0, w - 2), py = U.clamp(Math.round(k.y * sy), 0, h - 2), dir = k.vx > 0 ? -1 : 1;
      c.fillStyle = '#7a5a10';
      for (let i = 1; i <= 3; i++) c.fillRect(px + dir * (i + 1), py, 1, 1);
      if (!off || blink) { c.fillStyle = '#ffd23f'; c.fillRect(px, py, 2, 2); }
    }
    c.fillStyle = '#5ef2ff'; c.fillRect(cx - 1, cy - 1, 3, 3);
    c.fillStyle = '#e0ffff'; c.fillRect(cx, cy, 1, 1);
    UI.txt(RD.info, `AST ${n}${rich ? ` · RICOS ${rich}` : ''}${G.comets.length ? ' · COMETA' : ''}`);
  }
};

/* ---------- Abas ---------- */
const SPW = 64, SPH = 22;
const sparkSkel = i => `<svg class="spark" viewBox="0 0 ${SPW} ${SPH}" width="${SPW}" height="${SPH}" aria-hidden="true"><line x1="0" x2="${SPW}" class="base" data-r="sl${i}"/><polyline data-r="sp${i}"/><circle cx="${SPW}" r="2" data-r="sc${i}"/></svg>`;
function sparkPatch(r, i) {
  const h = G.hist[i], pl = r['sp' + i];
  if (!pl || h.length < 2) return;
  const sig = h.length + ':' + h[0] + ':' + h[h.length - 1];
  if (pl._sig === sig) return;
  pl._sig = sig;
  let lo = 0.9, hi = 1.1;
  for (const v of h) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const y = v => (SPH - 2 - ((v - lo) / (hi - lo)) * (SPH - 4)).toFixed(1);
  let pts = '';
  for (let k = 0; k < h.length; k++) pts += (k ? ' ' : '') + ((k / (h.length - 1)) * SPW).toFixed(1) + ',' + y(h[k]);
  const c = h[h.length - 1] >= 1 ? 'up' : 'down', yb = y(1);
  UI.attr(pl, 'points', pts); UI.attr(pl, 'class', c);
  UI.attr(r['sl' + i], 'y1', yb); UI.attr(r['sl' + i], 'y2', yb);
  UI.attr(r['sc' + i], 'cy', y(h[h.length - 1])); UI.attr(r['sc' + i], 'class', c);
}
const pctCls = (el, m) => UI.attr(el, 'class', m >= 1 ? 'up' : 'down');
// corrige valor de controle só se o jogador não estiver mexendo nele
const setCtl = (el, prop, v) => { if (el && document.activeElement !== el && el[prop] !== v) el[prop] = v; };

UI.tabs = {
  frota: {
    key: () => S.buyMode + ':' + UPGRADES.map(u => (S.upg[u.id] >= upMax(u) ? 1 : 0)).join(''),
    build() {
      const md = S.buyMode;
      let h = `<div class="stats4">
        <div><small>Drones</small><b data-r="dr"></b></div>
        <div><small>Dano/s por drone</small><b data-r="dps"></b></div>
        <div><small>Por clique</small><b data-r="clk"></b></div>
        <div><small>Produção</small><b class="gold" data-r="cps"></b></div>
      </div>
      <div class="buymode"><span>Comprar</span>${[1, 10, 'max'].map(m => `<button class="btn sm ${md === m ? 'on' : ''}" data-act="mode" data-m="${m}">${m === 'max' ? 'MÁX' : '×' + m}</button>`).join('')}</div>`;
      for (const u of UPGRADES) {
        const id = u.id, maxed = S.upg[id] >= upMax(u);
        h += `<div class="card upg" data-r="c-${id}">
          <div class="icbox">${img(u.icon)}</div>
          <div class="info"><div class="t">${u.name} <span class="lvl" data-r="l-${id}"></span></div>
          <div class="d">${u.desc}</div>
          <div class="e"><span data-r="e0-${id}"></span>${maxed ? '' : ` <span class="arrow">▸</span> <b data-r="e1-${id}"></b>`}</div></div>
          <button class="btn buy" data-act="buy" data-id="${id}" data-r="b-${id}">${maxed ? 'MÁX' : `<small data-r="n-${id}"></small><span>${img('coin', 'mini')}<i class="v" data-r="p-${id}"></i></span>`}</button>
        </div>`;
      }
      return h;
    },
    patch(r) {
      UI.txt(r.dr, `${D.drones()}/${D.maxDrones()}`);
      UI.txt(r.dps, U.fmt(D.dps()));
      UI.txt(r.clk, U.fmt(D.click()));
      UI.txt(r.cps, U.fmt(G.cps) + '/s');
      for (const u of UPGRADES) {
        const id = u.id, lvl = S.upg[id], max = upMax(u), maxed = lvl >= max;
        const n = maxed ? 0 : buyCount(u), cost = maxed ? 0 : upCost(u, lvl, n), ok = !maxed && S.credits >= cost;
        UI.cls(r['c-' + id], 'ok', ok); UI.cls(r['c-' + id], 'maxed', maxed);
        UI.txt(r['l-' + id], `Nv ${lvl}${isFinite(max) ? ' / ' + max : ''}`);
        UI.txt(r['e0-' + id], u.eff(lvl));
        if (!maxed) {
          UI.txt(r['e1-' + id], u.eff(lvl + n));
          UI.txt(r['n-' + id], n > 1 ? '×' + n : 'Comprar');
          UI.txt(r['p-' + id], U.fmt(cost));
        }
        UI.dis(r['b-' + id], !ok);
      }
    }
  },

  refino: {
    key: () => D.furnaces() + ':' + seenMask(),
    build() {
      const n = D.furnaces();
      let h = `<p class="hint">Cada fornalha funde <b data-r="hb"></b> minérios em <b data-r="ho"></b> lingote(s) a cada <b data-r="ht"></b>. Lingotes valem <b data-r="hm"></b> o minério bruto e abrem rotas para novos setores.</p>`;
      const opts = `<option value="-1">Desligada</option>` + ORES.map((o, i) => (S.seen[i] ? `<option value="${i}">${o.name} → ${o.ingot}</option>` : '')).join('');
      for (let k = 0; k < n; k++) {
        h += `<div class="card furn" data-r="fc${k}">
          <div class="icbox" data-r="fh${k}">${img('flame')}</div>
          <div class="info"><div class="t">Fornalha ${ROMAN[k]}</div>
            <select id="furn-${k}" data-chg="furn" data-k="${k}" data-r="fs${k}" aria-label="Minério da fornalha ${k + 1}">${opts}</select>
            <div class="bar"><i data-r="fb${k}"></i></div>
            <div class="d" data-r="fd${k}"></div></div>
          <div class="icbox"><img class="px" data-r="fi${k}" alt=""></div>
        </div>`;
      }
      if (n < 5) h += `<p class="hint dim">Mais fornalhas podem ser pesquisadas na aba Pesquisa.</p>`;
      h += `<h3>Estoque de lingotes</h3><div class="grid2">`;
      ORES.forEach((o, i) => { if (S.seen[i]) h += `<div class="chip big">${img('ingot' + i)}<span>${o.ingot}</span><b data-r="st${i}"></b></div>`; });
      return h + '</div>';
    },
    patch(r) {
      const n = D.furnaces(), B = D.batch();
      UI.txt(r.hb, U.fmt(B)); UI.txt(r.ho, U.fmt(B / 10)); UI.txt(r.ht, D.refineTime().toFixed(1) + 's'); UI.txt(r.hm, D.ingotMult() + '×');
      for (let k = 0; k < n; k++) {
        const f = S.furnaces[k] || { ore: -1, prog: 0, busy: false, take: 0 }, ore = f.ore;
        setCtl(r['fs' + k], 'value', String(ore));
        UI.cls(r['fc' + k], 'on', f.busy); UI.cls(r['fh' + k], 'hot', f.busy);
        UI.w(r['fb' + k], f.prog);
        UI.sty(r['fb' + k], 'background', ore >= 0 ? ORES[ore].col[3] : '#444');
        UI.txt(r['fd' + k], ore < 0 ? 'Escolha um minério para fundir.' : f.busy ? `Fundindo ${U.fmt(f.take)} ${ORES[ore].name}…` : `Aguardando 10+ ${ORES[ore].name} (tem ${U.fmt(S.ores[ore])})`);
        UI.src(r['fi' + k], UI.ic[ore >= 0 ? 'ingot' + ore : 'lock']);
      }
      for (let i = 0; i < ORES.length; i++) UI.txt(r['st' + i], U.fmt(S.ingots[i]));
    }
  },

  mercado: {
    key: () => (S.research.autosell ? 1 : 0) + ':' + seenMask() + ':' + (S.stats.ingots > 0 ? 1 : 0),
    build() {
      let h = `<div class="row"><button class="btn wide" data-act="sellall">${img('coin', 'mini')} Vender todo o minério (exceto reservas)</button></div>`;
      if (S.research.autosell) {
        h += `<div class="card auto">
          <label class="tog"><input id="auto-on" type="checkbox" data-chg="auto" data-r="aon"> Venda automática</label>
          <label class="rng" for="auto-thr"><span>Vender quando o preço estiver em <b data-r="athr"></b> ou mais</span>
            <input id="auto-thr" type="range" min="0.4" max="2" step="0.05" value="${S.autosell.thr}" data-inp="thr" data-r="arng"></label>
          <label class="tog"><input id="auto-ing" type="checkbox" data-chg="autoing" data-r="aing"> Incluir lingotes</label>
          <div class="d dim">Uma reserva de 4 lotes fica guardada para cada fornalha ligada.</div></div>`;
      } else h += `<p class="hint dim">Pesquise <b>Corretora Automática</b> para vender sem clicar.</p>`;
      h += `<h3>Minérios <small>preço por unidade</small></h3>`;
      ORES.forEach((o, i) => {
        if (!S.seen[i]) return;
        h += `<div class="mrow">${img('ore' + i, 'oi')}<div class="nm">${o.name}<small data-r="oq${i}"></small></div>
          ${sparkSkel(i)}<div class="pr"><b data-r="op${i}"></b><small data-r="om${i}"></small></div>
          <button class="btn sm" data-act="sell" data-i="${i}" data-r="ob${i}">Vender<small data-r="ov${i}"></small></button></div>`;
      });
      if (S.stats.ingots > 0) {
        h += `<h3>Lingotes</h3>`;
        ORES.forEach((o, i) => {
          if (!S.seen[i]) return;
          h += `<div class="mrow">${img('ingot' + i, 'oi')}<div class="nm">${o.ingot}<small data-r="iq${i}"></small></div><div class="spacer"></div>
            <div class="pr"><b data-r="ip${i}"></b><small data-r="im${i}"></small></div>
            <button class="btn sm" data-act="selling" data-i="${i}" data-r="ib${i}">Vender<small data-r="iv${i}"></small></button></div>`;
        });
      }
      return h;
    },
    patch(r) {
      setCtl(r.aon, 'checked', S.autosell.on);
      setCtl(r.aing, 'checked', S.autosell.ingots);
      setCtl(r.arng, 'value', String(S.autosell.thr));
      UI.txt(r.athr, Math.round(S.autosell.thr * 100) + '%');
      for (let i = 0; i < ORES.length; i++) {
        if (!S.seen[i]) continue;
        const p = priceOf(i), m = S.prices[i], pct = Math.round(m * 100) + '%';
        UI.txt(r['oq' + i], `${U.fmt(S.ores[i])} un.${usedByFurnace(i) ? ` · reserva ${U.fmt(reserveOf(i))}` : ''}`);
        UI.txt(r['op' + i], U.fmt(p));
        UI.txt(r['om' + i], pct); pctCls(r['om' + i], m);
        UI.dis(r['ob' + i], !(S.ores[i] >= 0.01));
        UI.txt(r['ov' + i], U.fmt(S.ores[i] * p));
        sparkPatch(r, i);
        if (r['iq' + i]) {
          const ip = ingotPrice(i);
          UI.txt(r['iq' + i], `${U.fmt(S.ingots[i])} un.`);
          UI.txt(r['ip' + i], U.fmt(ip));
          UI.txt(r['im' + i], pct); pctCls(r['im' + i], m);
          UI.dis(r['ib' + i], !(S.ingots[i] >= 1));
          UI.txt(r['iv' + i], U.fmt(S.ingots[i] * ip));
        }
      }
    }
  },

  pesquisa: {
    key: () => Object.keys(S.research).sort().join(','),
    build() {
      let h = `<p class="hint">Dados de varredura vêm da destruição de asteroides (rochas grandes, ricas e setores distantes rendem mais). Você tem <b class="cyan" data-r="dt"></b> dados.</p>
        <div class="card upg" data-r="cc"><div class="icbox">${img('scanner')}</div>
        <div class="info"><div class="t">Calibração Espectral <span class="lvl" data-r="cl"></span></div>
        <div class="d">Pesquisa contínua: cada nível soma +10% ao valor de todos os minérios.</div>
        <div class="e"><span data-r="ce0"></span> <span class="arrow">▸</span> <b data-r="ce1"></b></div></div>
        <button class="btn buy" data-act="calib" data-r="cb"><small>Calibrar</small><span>${img('data', 'mini')}<i class="v" data-r="cp"></i></span></button></div><div class="rgrid">`;
      for (const x of RESEARCH) {
        const done = !!S.research[x.id], reqOk = (x.req || []).every(q => S.research[q]);
        h += `<div class="card res ${done ? 'done' : ''} ${!reqOk && !done ? 'locked' : ''}" data-r="rc-${x.id}">
          <div class="t">${x.name}</div><div class="d">${x.desc}</div>
          ${done ? '<div class="tag">Concluída</div>' : !reqOk ? `<div class="tag dim">Requer ${x.req.map(q => RESEARCH.find(y => y.id === q).name).join(', ')}</div>` : `<button class="btn" data-act="res" data-id="${x.id}" data-r="rb-${x.id}">${img('data', 'mini')}${U.fmt(x.cost)}</button>`}
        </div>`;
      }
      return h + '</div>';
    },
    patch(r) {
      UI.txt(r.dt, U.fmt(S.data));
      const cc = calibCost(S.dataLvl), cok = S.data >= cc;
      UI.cls(r.cc, 'ok', cok);
      UI.txt(r.cl, `Nv ${S.dataLvl}`);
      UI.txt(r.ce0, `+${S.dataLvl * 10}%`);
      UI.txt(r.ce1, `+${(S.dataLvl + 1) * 10}%`);
      UI.txt(r.cp, U.fmt(cc));
      UI.dis(r.cb, !cok);
      for (const x of RESEARCH) {
        const b = r['rb-' + x.id];
        if (!b) continue;
        const ok = S.data >= x.cost;
        UI.cls(r['rc-' + x.id], 'ok', ok);
        UI.dis(b, !ok);
      }
    }
  },

  setores: {
    key: () => S.sector + ':' + S.maxSector,
    build() {
      let h = '';
      SECTORS.forEach((s, i) => {
        const cur = S.sector === i, un = i <= S.maxSector, next = i === S.maxSector + 1, known = un || next, ri = i - 1;
        h += `<div class="card sec ${cur ? 'cur' : ''} ${!known ? 'locked' : ''}">
          <img class="px planet ${known ? '' : 'unk'}" src="${UI.thumb(i)}" alt="">
          <div class="info"><div class="t">${i + 1}. ${known ? s.name : 'Setor desconhecido'}</div>
          <div class="d">${known ? s.desc : 'Os sensores ainda não alcançam esta região.'}</div>
          ${known ? `<div class="ores">${s.ores.map(o => img('ore' + o)).join('')}<small>Dureza ×${U.fmt(D.hpu(i))}</small></div>` : ''}
          ${next ? `<div class="req">Custo <b data-r="xc"></b>${ri >= 0 ? ` + <b data-r="xi">${s.req} ${ORES[ri].ingot}</b> <small>(tem <span data-r="xh"></span>)</small>` : ''}</div>` : ''}
          </div>
          ${cur ? '<span class="tag here">Aqui</span>' : un ? `<button class="btn" data-act="travel" data-i="${i}">Viajar</button>` : next ? `<button class="btn" data-act="unlock" data-i="${i}" data-r="xb">Abrir rota</button>` : ''}
        </div>`;
      });
      return h;
    },
    patch(r) {
      const i = S.maxSector + 1;
      if (i >= SECTORS.length || !r.xb) return;
      const cost = D.sectorCost(i), ri = i - 1, ok1 = S.credits >= cost, ok2 = ri < 0 || S.ingots[ri] >= SECTORS[i].req;
      UI.txt(r.xc, U.fmt(cost) + ' cr');
      UI.cls(r.xc, 'g', ok1); UI.cls(r.xc, 'r', !ok1);
      UI.cls(r.xi, 'g', ok2); UI.cls(r.xi, 'r', !ok2);
      if (ri >= 0) UI.txt(r.xh, U.fmt(S.ingots[ri]));
      UI.dis(r.xb, !(ok1 && ok2));
    }
  },

  salto: {
    key: () => (S.pupg.memory ? 1 : 0) + ':' + PRESTIGE.map(p => ((S.pupg[p.id] || 0) >= p.max ? 1 : 0)).join(''),
    build() {
      let h = `<div class="card prest">
        <div class="t big">Salto Quântico</div>
        <div class="d">Dobre o espaço-tempo e recomece no Cinturão de Vesta. Créditos, minérios, lingotes, melhorias${S.pupg.memory ? '' : ', pesquisas'} e setores são perdidos. Em troca você recebe <b class="mag">Fragmentos Estelares</b>: cada fragmento guardado aumenta em 10% o valor de tudo, e eles compram tecnologias ancestrais permanentes.</div>
        <div class="stats4">
          <div><small>Fragmentos</small><b class="mag" data-r="sf"></b></div>
          <div><small>Bônus de valor</small><b data-r="sb"></b></div>
          <div><small>Ganho ao saltar</small><b class="mag" data-r="sg"></b></div>
          <div><small>Créditos na jornada</small><b data-r="sc"></b></div>
        </div>
        <p class="hint r" data-r="sh"></p>
        <button class="btn wide magb" data-act="prestige" data-r="sx">${img('shard', 'mini')} Saltar e ganhar <span data-r="sg2"></span> fragmentos</button>
      </div><h3>Tecnologias ancestrais</h3>`;
      for (const p of PRESTIGE) {
        const maxed = (S.pupg[p.id] || 0) >= p.max;
        h += `<div class="card upg" data-r="pc-${p.id}">
          <div class="icbox">${img('shard')}</div>
          <div class="info"><div class="t">${p.name} <span class="lvl" data-r="pl-${p.id}"></span></div><div class="d">${p.desc}</div></div>
          <button class="btn buy" data-act="pbuy" data-id="${p.id}" data-r="pb-${p.id}">${maxed ? 'MÁX' : `<small>Comprar</small><span>${img('shard', 'mini')}<i class="v" data-r="pp-${p.id}"></i></span>`}</button>
        </div>`;
      }
      return h;
    },
    patch(r) {
      const g = shardGain();
      UI.txt(r.sf, U.fmt(S.shards));
      UI.txt(r.sb, `+${U.fmt(S.shards * 10)}%`);
      UI.txt(r.sg, `+${U.fmt(g)}`);
      UI.txt(r.sg2, U.fmt(g));
      UI.txt(r.sc, U.fmt(S.runCredits));
      const hint = S.runMaxSector < 3 ? 'Alcance o Campo de Hélios (setor 4) nesta jornada para liberar o salto.' : g < 1 ? 'Acumule ao menos 1M créditos na jornada.' : '';
      UI.txt(r.sh, hint); UI.hide(r.sh, !hint);
      UI.dis(r.sx, !canPrestige());
      for (const p of PRESTIGE) {
        const l = S.pupg[p.id] || 0, maxed = l >= p.max, c = maxed ? 0 : p.cost(l), ok = !maxed && S.shards >= c;
        UI.cls(r['pc-' + p.id], 'ok', ok); UI.cls(r['pc-' + p.id], 'maxed', maxed);
        UI.txt(r['pl-' + p.id], `Nv ${l} / ${p.max}`);
        if (!maxed) UI.txt(r['pp-' + p.id], U.fmt(c));
        UI.dis(r['pb-' + p.id], !ok);
      }
    }
  },

  trofeus: {
    key: () => String(Object.keys(S.ach).length),
    build() {
      const got = Object.keys(S.ach).length;
      let h = `<p class="hint">${got} de ${ACH.length} conquistas · bônus atual <b class="gold">+${got * 3}%</b> no valor dos minérios.</p><div class="agrid">`;
      for (const a of ACH) {
        const ok = !!S.ach[a.id];
        h += `<div class="ach ${ok ? 'got' : ''}">${img(ok ? 'trophy' : 'lock')}<div><b>${ok ? a.n : '???'}</b><small>${a.d}</small></div></div>`;
      }
      return h + '</div>';
    },
    patch() {}
  },

  config: {
    key: () => 'cfg',
    build() {
      const row = (label, k) => `<div><span>${label}</span><b data-r="${k}"></b></div>`;
      return `<div class="card cfg">
        <button class="btn" data-act="sound" data-r="bs"></button>
        <button class="btn" data-act="shake" data-r="bk"></button>
        <button class="btn" data-act="fx" data-r="bf"></button>
        <button class="btn" data-act="scan" data-r="bn"></button>
      </div>
      <div class="card cfg">
        <button class="btn" data-act="save">Salvar agora</button>
        <button class="btn" data-act="export">Exportar save</button>
        <button class="btn" data-act="import">Importar save</button>
        <button class="btn danger" data-act="reset">Apagar progresso</button>
      </div>
      <h3>Estatísticas</h3>
      <div class="statlist">
        ${row('Tempo de jogo', 'k0')}${row('Créditos (total)', 'k1')}${row('Minério extraído', 'k2')}${row('Asteroides destruídos', 'k3')}
        ${row('Asteroides ricos', 'k4')}${row('Cliques / críticos', 'k5')}${row('Lingotes produzidos', 'k6')}${row('Cometas capturados', 'k7')}
        ${row('Saltos quânticos', 'k8')}${row('Multiplicador de valor', 'k9')}
      </div>
      <p class="hint dim" data-r="kh"></p>`;
    },
    patch(r) {
      const st = S.stats;
      UI.txt(r.bs, `Som: ${S.settings.sound ? 'ligado' : 'desligado'}`);
      UI.txt(r.bk, `Tremor de tela: ${S.settings.shake ? 'ligado' : 'desligado'}`);
      UI.txt(r.bf, `Efeitos: ${['Baixos', 'Médios', 'Altos'][S.settings.fx]}`);
      UI.txt(r.bn, `Linhas CRT: ${S.settings.scan ? 'ligadas' : 'desligadas'}`);
      UI.txt(r.k0, U.fmtTime(st.play));
      UI.txt(r.k1, U.fmt(S.lifeCredits));
      UI.txt(r.k2, U.fmt(st.mined));
      UI.txt(r.k3, U.fmt(st.asteroids));
      UI.txt(r.k4, U.fmt(st.rich));
      UI.txt(r.k5, `${U.fmt(st.clicks)} / ${U.fmt(st.crits)}`);
      UI.txt(r.k6, U.fmt(st.ingots));
      UI.txt(r.k7, U.fmt(st.comets));
      UI.txt(r.k8, U.fmt(st.prestiges));
      UI.txt(r.k9, `×${D.valueMult().toFixed(2)}`);
      UI.txt(r.kh, `O progresso é salvo neste navegador a cada 15 segundos. Ganhos offline: ${Math.round(D.offEff() * 100)}% por até ${Math.round(D.offCap() / 3600)}h.`);
    }
  }
};

UI.thumb = i => {
  if (UI.thumbs[i]) return UI.thumbs[i];
  const def = SECTORS[i].planet;
  const Dm = def.type === 'star' ? 22 : 40;
  const p = new GFX.Planet(def, Dm, 500 + i * 31);
  p.render(3);
  const c = U.canvas(64, 64), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  p.drawTo(g, 32, 32);
  UI.thumbs[i] = c.toDataURL();
  return UI.thumbs[i];
};

/* ---------- Ações ---------- */
UI.act = (act, ds) => {
  switch (act) {
    case 'mode': S.buyMode = ds.m === 'max' ? 'max' : +ds.m; SFX.play('ui'); break;
    case 'buy': Game.buy(ds.id); break;
    case 'sell': { const v = Game.sellOre(+ds.i); if (v) toastMoney(v); break; }
    case 'selling': { const v = Game.sellIngot(+ds.i); if (v) toastMoney(v); break; }
    case 'sellall': Game.sellAll(); break;
    case 'res': Game.research(ds.id); break;
    case 'calib': Game.calib(); break;
    case 'travel': Game.travel(+ds.i); break;
    case 'unlock': Game.unlock(+ds.i); break;
    case 'prestige':
      UI.modal(`<h2>Confirmar Salto Quântico?</h2><p>Você receberá <b class="mag">${U.fmt(shardGain())} Fragmentos Estelares</b>. Créditos, minérios, lingotes, melhorias${S.pupg.memory ? '' : ', pesquisas'} e setores${S.pupg.shortcut ? ` (exceto ${S.pupg.shortcut})` : ''} voltam ao início.</p>
        <div class="row"><button class="btn magb" data-act="prestige-yes">Saltar</button><button class="btn" data-act="close">Cancelar</button></div>`);
      break;
    case 'prestige-yes': UI.closeModal(); Game.prestige(); break;
    case 'pbuy': Game.pbuy(ds.id); break;
    case 'sound': S.settings.sound = !S.settings.sound; break;
    case 'shake': S.settings.shake = !S.settings.shake; break;
    case 'fx': S.settings.fx = (S.settings.fx + 1) % 3; break;
    case 'scan': S.settings.scan = !S.settings.scan; break;
    case 'save': Game.save(); UI.toast('Jogo salvo', 'Progresso gravado neste navegador.', 'gear', 'cyan'); break;
    case 'export': {
      Game.save();
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
      UI.modal(`<h2>Exportar save</h2><p>Copie o código abaixo e guarde em um lugar seguro.</p><textarea id="saveCode" readonly>${code}</textarea>
        <div class="row"><button class="btn" data-act="copy">Copiar</button><button class="btn" data-act="close">Fechar</button></div>`);
      break;
    }
    case 'copy': {
      const ta = $('saveCode');
      const done = () => UI.toast('Código copiado', 'Cole em um arquivo de texto para guardar.', 'gear', 'cyan');
      const fallback = () => { ta.focus(); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* selecionado para cópia manual */ } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback); else fallback();
      break;
    }
    case 'import':
      UI.modal(`<h2>Importar save</h2><p>Cole um código exportado. O progresso atual será substituído.</p><textarea id="importCode" placeholder="Cole o código aqui"></textarea><p id="importErr" class="r"></p>
        <div class="row"><button class="btn" data-act="import-yes">Importar</button><button class="btn" data-act="close">Cancelar</button></div>`);
      break;
    case 'import-yes':
      try {
        let obj;
        try { obj = JSON.parse(decodeURIComponent(escape(atob($('importCode').value.trim())))); } catch (e) { obj = null; }
        if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.upg) throw new Error('Código inválido. Confira se copiou o texto inteiro.');
        if ((obj.v | 0) > SAVE_VERSION) throw new Error('Este save é de uma versão mais nova do jogo.');
        Game.load(obj);
        UI.closeModal();
        UI.toast('Save importado', 'Bem-vindo de volta, comandante.', 'star', 'cyan');
      } catch (e) { $('importErr').textContent = e.message; }
      break;
    case 'reset':
      UI.modal(`<h2>Apagar todo o progresso?</h2><p>Isso inclui fragmentos, conquistas e estatísticas. Não há como desfazer.</p>
        <div class="row"><button class="btn danger" data-act="reset-yes">Apagar tudo</button><button class="btn" data-act="close">Cancelar</button></div>`);
      break;
    case 'reset-yes': Game.hardReset(); UI.closeModal(); break;
    case 'close': UI.closeModal(); break;
  }
  document.body.classList.toggle('noscan', !S.settings.scan);
  UI.render(false, true);
};
UI.change = (kind, t) => {
  if (kind === 'furn') { Game.setFurnace(+t.dataset.k, +t.value); t.blur(); SFX.play('ui'); }
  else if (kind === 'auto') S.autosell.on = t.checked;
  else if (kind === 'autoing') S.autosell.ingots = t.checked;
  else if (kind === 'thr') { S.autosell.thr = +t.value; UI.txt(UI.tabBlock.r.athr, Math.round(S.autosell.thr * 100) + '%'); return; }
  UI.render(false, true);
};

/* ---------- Toasts e modais ---------- */
UI.toast = (title, text, icon, cls) => {
  const el = document.createElement('div');
  el.className = 'toast ' + (cls || '');
  el.innerHTML = `${img(icon || 'star')}<div><b>${title}</b><small>${text}</small></div>`;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4800);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
};
UI.modal = html => { $('modalBody').innerHTML = html; $('modal').hidden = false; };
UI.closeModal = () => { $('modal').hidden = true; $('modalBody').innerHTML = ''; };
UI.offlineModal = (sec, got, dg, ing, cr, eff) => {
  const rows = got.map(([i, u]) => `<div class="chip big">${img('ore' + i)}<span>${ORES[i].name}</span><b>+${U.fmt(u)}</b></div>`).join('')
    + ing.map(([i, u]) => `<div class="chip big">${img('ingot' + i)}<span>${ORES[i].ingot}</span><b>+${U.fmt(u)}</b></div>`).join('');
  UI.modal(`<h2>Relatório da frota</h2><p>Sua frota trabalhou por <b>${U.fmtTime(sec)}</b> enquanto você esteve fora (eficiência ${Math.round(eff * 100)}%).</p>
    <div class="grid2">${rows}${dg >= 1 ? `<div class="chip big">${img('data')}<span>Dados</span><b>+${U.fmt(dg)}</b></div>` : ''}${cr > 0 ? `<div class="chip big">${img('coin')}<span>Vendas automáticas</span><b>+${U.fmt(cr)}</b></div>` : ''}</div>
    <div class="row"><button class="btn wide" data-act="close">Continuar minerando</button></div>`);
};

window.addEventListener('load', () => {
  Game.init();
  UI.init();
  document.body.classList.toggle('noscan', !S.settings.scan);
  Game.start();
});
