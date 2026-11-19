'use strict';
/* ===== Interface: HUD, abas, inventário, toasts, modais ===== */
const UI = { tab: 'frota', busy: false, last: '', ic: {}, thumbs: {}, invLast: '', logLast: '' };
const $ = id => document.getElementById(id);
const img = (k, cls = '') => `<img class="px ${cls}" src="${UI.ic[k]}" alt="">`;

UI.init = () => {
  UI.ic = GFX.icons();
  document.querySelectorAll('[data-ico]').forEach(e => { e.innerHTML = img(e.dataset.ico); });
  $('tabs').innerHTML = TABS.map(t => `<button class="tab" id="tab-${t.id}" data-tab="${t.id}" title="${t.name}">${img(t.icon)}<span>${t.name}</span><i class="dot"></i></button>`).join('');
  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    UI.tab = b.dataset.tab;
    UI.render(true);
    $('tabContent').scrollTop = 0;
    SFX.play('ui');
  });
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
  UI.render(true);
  UI.update();
  setInterval(UI.update, 250);
};

UI.focusLocked = () => {
  const a = document.activeElement;
  return a && $('tabContent').contains(a) && (a.tagName === 'SELECT' || (a.tagName === 'INPUT' && a.type === 'range'));
};
UI.render = force => {
  if (!force && (UI.busy || UI.focusLocked())) return;
  const tc = $('tabContent');
  const html = UI.tabs[UI.tab]();
  if (html !== UI.last || force) {
    const st = tc.scrollTop;
    tc.innerHTML = html;
    tc.scrollTop = st;
    UI.last = html;
  }
  document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
};

UI.update = () => {
  if (!S) return;
  $('credits').textContent = U.fmt(S.credits);
  $('cps').textContent = `+${U.fmt(G.cps)}/s`;
  $('data').textContent = U.fmt(S.data);
  $('shards').textContent = U.fmt(S.shards);
  $('hudShards').hidden = !(S.shards > 0 || S.stats.prestiges > 0);
  $('sectorName').textContent = `${S.sector + 1} · ${SECTORS[S.sector].name}`;

  // inventário sobre o canvas
  let inv = '';
  ORES.forEach((o, i) => { if (S.seen[i]) inv += `<span class="chip" title="${o.name}">${img('ore' + i)}<b>${U.fmt(S.ores[i])}</b></span>`; });
  let ing = '';
  ORES.forEach((o, i) => { if (S.ingots[i] >= 1) ing += `<span class="chip ing" title="${o.ingot}">${img('ingot' + i)}<b>${U.fmt(S.ingots[i])}</b></span>`; });
  const invHtml = `<div class="inv-row">${inv}</div>${ing ? `<div class="inv-row">${ing}</div>` : ''}`;
  if (invHtml !== UI.invLast) { $('inventory').innerHTML = invHtml; UI.invLast = invHtml; }

  // missão
  const g = GOALS[S.goal];
  $('goal').innerHTML = g
    ? `<small>Missão ${S.goal + 1}/${GOALS.length}</small><span>${g.t}</span><em>${img('coin')} ${U.fmt(g.r)}</em>`
    : `<small>Missões</small><span>Todas concluídas. O cosmos é seu.</span>`;

  // eventos ativos
  const ev = [];
  if (G.buffs.frenzy > 0) ev.push(`<span class="ev gold">Frenesi ×3 · ${Math.ceil(G.buffs.frenzy)}s</span>`);
  if (G.event) ev.push(`<span class="ev orange">${G.event.name} · ${Math.ceil(G.event.t)}s</span>`);
  $('eventBanner').innerHTML = ev.join('');

  // registro
  const now = performance.now();
  const logHtml = G.log.filter(l => now - l.t < 9000).map(l => `<div style="color:${l.col};opacity:${Math.max(0.15, 1 - (now - l.t) / 9000).toFixed(2)}">${l.text}</div>`).join('');
  if (logHtml !== UI.logLast) { $('log').innerHTML = logHtml; UI.logLast = logHtml; }

  // indicadores nas abas
  const dots = {
    frota: UPGRADES.some(u => { const n = buyCount(u); return n > 0 && S.credits >= upCost(u, S.upg[u.id], 1); }),
    pesquisa: S.data >= calibCost(S.dataLvl) || RESEARCH.some(r => !S.research[r.id] && S.data >= r.cost && (r.req || []).every(q => S.research[q])),
    setores: S.maxSector + 1 < SECTORS.length && S.credits >= D.sectorCost(S.maxSector + 1) && S.ingots[S.maxSector] >= SECTORS[S.maxSector + 1].req,
    salto: canPrestige() || PRESTIGE.some(p => (S.pupg[p.id] || 0) < p.max && S.shards >= p.cost(S.pupg[p.id] || 0)),
    refino: S.furnaces.slice(0, D.furnaces()).some(f => f.ore < 0)
  };
  for (const t of TABS) { const el = $('tab-' + t.id); if (el) el.classList.toggle('alert', !!dots[t.id]); }

  UI.render(false);
};

/* ---------- Abas ---------- */
const spark = i => {
  const h = G.hist[i];
  if (h.length < 2) return '';
  const w = 64, ht = 22, lo = Math.min(0.9, ...h), hi = Math.max(1.1, ...h);
  const y = v => (ht - 2 - ((v - lo) / (hi - lo)) * (ht - 4)).toFixed(1);
  const pts = h.map((v, k) => `${((k / (h.length - 1)) * w).toFixed(1)},${y(v)}`).join(' ');
  const up = h[h.length - 1] >= 1;
  return `<svg class="spark" viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}" aria-hidden="true"><line x1="0" x2="${w}" y1="${y(1)}" y2="${y(1)}" class="base"/><polyline points="${pts}" class="${up ? 'up' : 'down'}"/><circle cx="${w}" cy="${y(h[h.length - 1])}" r="2" class="${up ? 'up' : 'down'}"/></svg>`;
};

UI.tabs = {
  frota() {
    const md = S.buyMode;
    let h = `<div class="stats4">
      <div><small>Drones</small><b>${D.drones()}/${D.maxDrones()}</b></div>
      <div><small>Dano/s por drone</small><b>${U.fmt(D.dps())}</b></div>
      <div><small>Por clique</small><b>${U.fmt(D.click())}</b></div>
      <div><small>Produção</small><b class="gold">${U.fmt(G.cps)}/s</b></div>
    </div>
    <div class="buymode"><span>Comprar</span>${[1, 10, 'max'].map(m => `<button class="btn sm ${md === m ? 'on' : ''}" data-act="mode" data-m="${m}">${m === 'max' ? 'MÁX' : '×' + m}</button>`).join('')}</div>`;
    for (const u of UPGRADES) {
      const lvl = S.upg[u.id], max = upMax(u), maxed = lvl >= max;
      const n = maxed ? 0 : buyCount(u), cost = maxed ? 0 : upCost(u, lvl, n), ok = !maxed && S.credits >= cost;
      h += `<div class="card upg ${ok ? 'ok' : ''} ${maxed ? 'maxed' : ''}">
        <div class="icbox">${img(u.icon)}</div>
        <div class="info"><div class="t">${u.name} <span class="lvl">Nv ${lvl}${isFinite(max) ? ' / ' + max : ''}</span></div>
        <div class="d">${u.desc}</div>
        <div class="e">${u.eff(lvl)}${maxed ? '' : ` <span class="arrow">▸</span> <b>${u.eff(lvl + n)}</b>`}</div></div>
        <button class="btn buy" data-act="buy" data-id="${u.id}" ${ok ? '' : 'disabled'}>${maxed ? 'MÁX' : `<small>${n > 1 ? '×' + n : 'Comprar'}</small><span>${img('coin', 'mini')}${U.fmt(cost)}</span>`}</button>
      </div>`;
    }
    return h;
  },

  refino() {
    const n = D.furnaces(), T = D.refineTime(), B = D.batch();
    let h = `<p class="hint">Cada fornalha funde <b>${U.fmt(B)}</b> minérios em <b>${U.fmt(B / 10)}</b> lingote(s) a cada <b>${T.toFixed(1)}s</b>. Lingotes valem <b>${D.ingotMult()}×</b> o minério bruto e abrem rotas para novos setores.</p>`;
    for (let k = 0; k < n; k++) {
      const f = S.furnaces[k] || { ore: -1, prog: 0, busy: false };
      const ore = f.ore;
      const opts = `<option value="-1">Desligada</option>` + ORES.map((o, i) => (S.seen[i] ? `<option value="${i}" ${i === ore ? 'selected' : ''}>${o.name} → ${o.ingot}</option>` : '')).join('');
      const status = ore < 0 ? 'Escolha um minério para fundir.' : f.busy ? `Fundindo ${U.fmt(f.take)} ${ORES[ore].name}…` : `Aguardando 10+ ${ORES[ore].name} (tem ${U.fmt(S.ores[ore])})`;
      h += `<div class="card furn ${f.busy ? 'on' : ''}">
        <div class="icbox ${f.busy ? 'hot' : ''}">${img('flame')}</div>
        <div class="info"><div class="t">Fornalha ${['I', 'II', 'III', 'IV', 'V'][k]}</div>
          <select id="furn-${k}" data-chg="furn" data-k="${k}" aria-label="Minério da fornalha ${k + 1}">${opts}</select>
          <div class="bar"><i style="width:${(f.prog * 100).toFixed(1)}%;background:${ore >= 0 ? ORES[ore].col[3] : '#444'}"></i></div>
          <div class="d">${status}</div></div>
        <div class="icbox">${ore >= 0 ? img('ingot' + ore) : img('lock')}</div>
      </div>`;
    }
    if (n < 5) h += `<p class="hint dim">Mais fornalhas podem ser pesquisadas na aba Pesquisa.</p>`;
    h += `<h3>Estoque de lingotes</h3><div class="grid2">`;
    ORES.forEach((o, i) => { if (S.seen[i]) h += `<div class="chip big">${img('ingot' + i)}<span>${o.ingot}</span><b>${U.fmt(S.ingots[i])}</b></div>`; });
    return h + '</div>';
  },

  mercado() {
    let h = `<div class="row"><button class="btn wide" data-act="sellall">${img('coin', 'mini')} Vender todo o minério (exceto reservas)</button></div>`;
    if (S.research.autosell) {
      h += `<div class="card auto">
        <label class="tog"><input id="auto-on" type="checkbox" data-chg="auto" ${S.autosell.on ? 'checked' : ''}> Venda automática</label>
        <label class="rng" for="auto-thr">Vender quando o preço estiver em <b>${Math.round(S.autosell.thr * 100)}%</b> ou mais
          <input id="auto-thr" type="range" min="0.4" max="2" step="0.05" value="${S.autosell.thr}" data-inp="thr"></label>
        <label class="tog"><input id="auto-ing" type="checkbox" data-chg="autoing" ${S.autosell.ingots ? 'checked' : ''}> Incluir lingotes</label>
        <div class="d dim">Uma reserva de 4 lotes fica guardada para cada fornalha ligada.</div></div>`;
    } else h += `<p class="hint dim">Pesquise <b>Corretora Automática</b> para vender sem clicar.</p>`;
    h += `<h3>Minérios <small>preço por unidade</small></h3>`;
    ORES.forEach((o, i) => {
      if (!S.seen[i]) return;
      const p = priceOf(i), m = S.prices[i];
      h += `<div class="mrow">${img('ore' + i, 'oi')}<div class="nm">${o.name}<small>${U.fmt(S.ores[i])} un.${usedByFurnace(i) ? ` · reserva ${U.fmt(reserveOf(i))}` : ''}</small></div>
        ${spark(i)}<div class="pr"><b>${U.fmt(p)}</b><small class="${m >= 1 ? 'up' : 'down'}">${Math.round(m * 100)}%</small></div>
        <button class="btn sm" data-act="sell" data-i="${i}" ${S.ores[i] >= 0.01 ? '' : 'disabled'}>Vender<small>${U.fmt(S.ores[i] * p)}</small></button></div>`;
    });
    if (S.stats.ingots > 0) {
      h += `<h3>Lingotes</h3>`;
      ORES.forEach((o, i) => {
        if (!S.seen[i]) return;
        const p = ingotPrice(i);
        h += `<div class="mrow">${img('ingot' + i, 'oi')}<div class="nm">${o.ingot}<small>${U.fmt(S.ingots[i])} un.</small></div><div class="spacer"></div>
          <div class="pr"><b>${U.fmt(p)}</b><small class="${S.prices[i] >= 1 ? 'up' : 'down'}">${Math.round(S.prices[i] * 100)}%</small></div>
          <button class="btn sm" data-act="selling" data-i="${i}" ${S.ingots[i] >= 1 ? '' : 'disabled'}>Vender<small>${U.fmt(S.ingots[i] * p)}</small></button></div>`;
      });
    }
    return h;
  },

  pesquisa() {
    let h = `<p class="hint">Dados de varredura vêm da destruição de asteroides (rochas grandes, ricas e setores distantes rendem mais). Você tem <b class="cyan">${U.fmt(S.data)}</b> dados.</p>`;
    const cc = calibCost(S.dataLvl), cok = S.data >= cc;
    h += `<div class="card upg ${cok ? 'ok' : ''}"><div class="icbox">${img('scanner')}</div>
      <div class="info"><div class="t">Calibração Espectral <span class="lvl">Nv ${S.dataLvl}</span></div>
      <div class="d">Pesquisa contínua: cada nível soma +10% ao valor de todos os minérios.</div>
      <div class="e">+${S.dataLvl * 10}% <span class="arrow">▸</span> <b>+${(S.dataLvl + 1) * 10}%</b></div></div>
      <button class="btn buy" data-act="calib" ${cok ? '' : 'disabled'}><small>Calibrar</small><span>${img('data', 'mini')}${U.fmt(cc)}</span></button></div><div class="rgrid">`;
    for (const r of RESEARCH) {
      const done = !!S.research[r.id], reqOk = (r.req || []).every(q => S.research[q]), ok = !done && reqOk && S.data >= r.cost;
      h += `<div class="card res ${done ? 'done' : ''} ${ok ? 'ok' : ''} ${!reqOk && !done ? 'locked' : ''}">
        <div class="t">${r.name}</div><div class="d">${r.desc}</div>
        ${done ? '<div class="tag">Concluída</div>' : !reqOk ? `<div class="tag dim">Requer ${r.req.map(q => RESEARCH.find(x => x.id === q).name).join(', ')}</div>` : `<button class="btn" data-act="res" data-id="${r.id}" ${ok ? '' : 'disabled'}>${img('data', 'mini')}${U.fmt(r.cost)}</button>`}
      </div>`;
    }
    return h + '</div>';
  },

  setores() {
    let h = '';
    SECTORS.forEach((s, i) => {
      const cur = S.sector === i, un = i <= S.maxSector, next = i === S.maxSector + 1, known = un || next;
      const cost = D.sectorCost(i), ri = i - 1, req = s.req;
      const canUnlock = next && S.credits >= cost && (ri < 0 || S.ingots[ri] >= req);
      h += `<div class="card sec ${cur ? 'cur' : ''} ${!known ? 'locked' : ''}">
        <img class="px planet ${known ? '' : 'unk'}" src="${UI.thumb(i)}" alt="">
        <div class="info"><div class="t">${i + 1}. ${known ? s.name : 'Setor desconhecido'}</div>
        <div class="d">${known ? s.desc : 'Os sensores ainda não alcançam esta região.'}</div>
        ${known ? `<div class="ores">${s.ores.map(o => img('ore' + o)).join('')}<small>Dureza ×${U.fmt(D.hpu(i))}</small></div>` : ''}
        ${next ? `<div class="req">Custo <b class="${S.credits >= cost ? 'g' : 'r'}">${U.fmt(cost)} cr</b>${ri >= 0 ? ` + <b class="${S.ingots[ri] >= req ? 'g' : 'r'}">${req} ${ORES[ri].ingot}</b> <small>(tem ${U.fmt(S.ingots[ri])})</small>` : ''}</div>` : ''}
        </div>
        ${cur ? '<span class="tag here">Aqui</span>' : un ? `<button class="btn" data-act="travel" data-i="${i}">Viajar</button>` : next ? `<button class="btn" data-act="unlock" data-i="${i}" ${canUnlock ? '' : 'disabled'}>Abrir rota</button>` : ''}
      </div>`;
    });
    return h;
  },

  salto() {
    const g = shardGain(), can = canPrestige();
    let h = `<div class="card prest">
      <div class="t big">Salto Quântico</div>
      <div class="d">Dobre o espaço-tempo e recomece no Cinturão de Vesta. Créditos, minérios, lingotes, melhorias${S.pupg.memory ? '' : ', pesquisas'} e setores são perdidos. Em troca você recebe <b class="mag">Fragmentos Estelares</b>: cada fragmento guardado aumenta em 10% o valor de tudo, e eles compram tecnologias ancestrais permanentes.</div>
      <div class="stats4">
        <div><small>Fragmentos</small><b class="mag">${U.fmt(S.shards)}</b></div>
        <div><small>Bônus de valor</small><b>+${U.fmt(S.shards * 10)}%</b></div>
        <div><small>Ganho ao saltar</small><b class="mag">+${U.fmt(g)}</b></div>
        <div><small>Créditos na jornada</small><b>${U.fmt(S.runCredits)}</b></div>
      </div>
      ${S.runMaxSector < 3 ? `<p class="hint r">Alcance o Campo de Hélios (setor 4) nesta jornada para liberar o salto.</p>` : g < 1 ? `<p class="hint r">Acumule ao menos 1M créditos na jornada.</p>` : ''}
      <button class="btn wide magb" data-act="prestige" ${can ? '' : 'disabled'}>${img('shard', 'mini')} Saltar e ganhar ${U.fmt(g)} fragmentos</button>
    </div><h3>Tecnologias ancestrais</h3>`;
    for (const p of PRESTIGE) {
      const l = S.pupg[p.id] || 0, maxed = l >= p.max, c = maxed ? 0 : p.cost(l), ok = !maxed && S.shards >= c;
      h += `<div class="card upg ${ok ? 'ok' : ''} ${maxed ? 'maxed' : ''}">
        <div class="icbox">${img('shard')}</div>
        <div class="info"><div class="t">${p.name} <span class="lvl">Nv ${l} / ${p.max}</span></div><div class="d">${p.desc}</div></div>
        <button class="btn buy" data-act="pbuy" data-id="${p.id}" ${ok ? '' : 'disabled'}>${maxed ? 'MÁX' : `<small>Comprar</small><span>${img('shard', 'mini')}${U.fmt(c)}</span>`}</button>
      </div>`;
    }
    return h;
  },

  trofeus() {
    const got = Object.keys(S.ach).length;
    let h = `<p class="hint">${got} de ${ACH.length} conquistas · bônus atual <b class="gold">+${got * 3}%</b> no valor dos minérios.</p><div class="agrid">`;
    for (const a of ACH) {
      const ok = !!S.ach[a.id];
      h += `<div class="ach ${ok ? 'got' : ''}">${img(ok ? 'trophy' : 'lock')}<div><b>${ok ? a.n : '???'}</b><small>${a.d}</small></div></div>`;
    }
    return h + '</div>';
  },

  config() {
    const st = S.stats;
    const fx = ['Baixos', 'Médios', 'Altos'][S.settings.fx];
    return `<div class="card cfg">
      <button class="btn" data-act="sound">Som: ${S.settings.sound ? 'ligado' : 'desligado'}</button>
      <button class="btn" data-act="shake">Tremor de tela: ${S.settings.shake ? 'ligado' : 'desligado'}</button>
      <button class="btn" data-act="fx">Efeitos: ${fx}</button>
      <button class="btn" data-act="scan">Linhas CRT: ${S.settings.scan ? 'ligadas' : 'desligadas'}</button>
    </div>
    <div class="card cfg">
      <button class="btn" data-act="save">Salvar agora</button>
      <button class="btn" data-act="export">Exportar save</button>
      <button class="btn" data-act="import">Importar save</button>
      <button class="btn danger" data-act="reset">Apagar progresso</button>
    </div>
    <h3>Estatísticas</h3>
    <div class="statlist">
      <div><span>Tempo de jogo</span><b>${U.fmtTime(st.play)}</b></div>
      <div><span>Créditos (total)</span><b>${U.fmt(S.lifeCredits)}</b></div>
      <div><span>Minério extraído</span><b>${U.fmt(st.mined)}</b></div>
      <div><span>Asteroides destruídos</span><b>${U.fmt(st.asteroids)}</b></div>
      <div><span>Asteroides ricos</span><b>${U.fmt(st.rich)}</b></div>
      <div><span>Cliques / críticos</span><b>${U.fmt(st.clicks)} / ${U.fmt(st.crits)}</b></div>
      <div><span>Lingotes produzidos</span><b>${U.fmt(st.ingots)}</b></div>
      <div><span>Cometas capturados</span><b>${U.fmt(st.comets)}</b></div>
      <div><span>Saltos quânticos</span><b>${U.fmt(st.prestiges)}</b></div>
      <div><span>Multiplicador de valor</span><b>×${D.valueMult().toFixed(2)}</b></div>
    </div>
    <p class="hint dim">O progresso é salvo neste navegador a cada 15 segundos. Ganhos offline: ${Math.round(D.offEff() * 100)}% por até ${Math.round(D.offCap() / 3600)}h.</p>`;
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
  UI.render(true);
};
UI.change = (kind, t) => {
  if (kind === 'furn') { Game.setFurnace(+t.dataset.k, +t.value); t.blur(); SFX.play('ui'); }
  else if (kind === 'auto') S.autosell.on = t.checked;
  else if (kind === 'autoing') S.autosell.ingots = t.checked;
  else if (kind === 'thr') { S.autosell.thr = +t.value; const b = t.parentElement.querySelector('b'); if (b) b.textContent = Math.round(S.autosell.thr * 100) + '%'; return; }
  UI.render(true);
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
