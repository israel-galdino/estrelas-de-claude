'use strict';
/* ===== Dados do jogo: minérios, setores, melhorias, pesquisa, prestígio, conquistas, missões ===== */

const ORES = [
  { id: 'ferro', name: 'Ferro', ingot: 'Aço', val: 1, col: ['#3a2f2c', '#6b5a52', '#9a8478', '#c9b3a3', '#efe0d2'] },
  { id: 'cobre', name: 'Cobre', ingot: 'Lingote de Cobre', val: 5, col: ['#4a1f12', '#8a3a1c', '#c8622a', '#ee9550', '#ffd0a0'] },
  { id: 'silicio', name: 'Silício', ingot: 'Wafer de Silício', val: 22, col: ['#1c2433', '#34465e', '#5a7591', '#8eaec8', '#d6ecff'] },
  { id: 'titanio', name: 'Titânio', ingot: 'Liga de Titânio', val: 100, col: ['#163038', '#2f6470', '#58a6b3', '#9ae6ec', '#effeff'] },
  { id: 'ouro', name: 'Ouro', ingot: 'Barra de Ouro', val: 450, col: ['#4a3205', '#8a5e0a', '#d39b16', '#ffd23f', '#fff3b0'] },
  { id: 'platina', name: 'Platina', ingot: 'Barra de Platina', val: 2000, col: ['#2b2b38', '#585a72', '#9a9db8', '#d4d7ee', '#ffffff'] },
  { id: 'iridio', name: 'Irídio', ingot: 'Liga de Irídio', val: 9000, col: ['#25103a', '#4d2378', '#8040c0', '#b67cff', '#e8d0ff'] },
  { id: 'cristal', name: 'Cristal Quântico', ingot: 'Matriz Quântica', val: 42000, col: ['#06323a', '#0b6e78', '#19c2c9', '#6effe9', '#e0fffb'], glow: true },
  { id: 'materia', name: 'Matéria Escura', ingot: 'Núcleo Sombrio', val: 2e5, col: ['#1a0026', '#4a0060', '#8a0a9c', '#e02ac8', '#ffb0f4'], glow: true },
  { id: 'neutronio', name: 'Neutrônio', ingot: 'Esfera de Neutrônio', val: 1e6, col: ['#1a1a40', '#3a4aa0', '#6a9cff', '#c0e0ff', '#ffffff'], glow: true }
];

const SECTORS = [
  {
    name: 'Cinturão de Vesta', desc: 'Rochas ferrosas à deriva perto de um planeta árido. O ponto de partida de toda mineradora.',
    ores: [0, 1, 2], w: [0.78, 0.2, 0.02], cost: 0, req: 0,
    rock: ['#2a2320', '#4a3d36', '#6e5d52', '#97836f', '#c4ae96'],
    neb: { c: ['#07060f', '#120d2a', '#22164a', '#3a2266'], alt: ['#101a3a', '#1c2e62', '#2e4a8e'], star: '#cfd8ff' },
    planet: { type: 'rock', pal: ['#140d0a', '#3a2a20', '#6a4a32', '#9a6e48', '#c79a6a', '#ecd2a4'], emi: ['#000000', '#000000', '#000000'], atm: '#e8b88a', tilt: 0.25, spin: 0.035 }
  },
  {
    name: 'Anéis de Kronos', desc: 'Um gigante gasoso envolto em anéis. Os detritos orbitais são ricos em cobre e silício.',
    ores: [1, 2, 3], w: [0.62, 0.3, 0.08], cost: 3000, req: 15,
    rock: ['#1e1a24', '#3b3344', '#5e5268', '#8a7a90', '#b8a8b8'],
    neb: { c: ['#040a0e', '#08202a', '#0f3a44', '#1a5a60'], alt: ['#0c1e26', '#163a48', '#26607a'], star: '#c8fff8' },
    planet: { type: 'gas', bands: 9, pal: ['#1a0e06', '#4a2a10', '#8a5a24', '#c88a3e', '#e8b868', '#fff0c8'], emi: ['#000000', '#000000', '#000000'], atm: '#ffd89a', tilt: -0.3, spin: 0.06, ring: { inner: 1.35, outer: 2.2, flat: 0.24, tilt: -0.3, col: ['#5a4430', '#a88a60', '#e8d4a4'] } }
  },
  {
    name: 'Nebulosa Carmesim', desc: 'Gases ionizados escondem asteroides de titânio. Um mundo de lava ilumina o vazio.',
    ores: [2, 3, 4], w: [0.6, 0.3, 0.1], cost: 1.2e5, req: 20,
    rock: ['#241014', '#45202a', '#6e3640', '#9a5458', '#c8847a'],
    neb: { c: ['#0c0306', '#2a0810', '#4e1020', '#7a1c2a'], alt: ['#2a0c08', '#5a1e10', '#8a3a18'], star: '#ffd8d0' },
    planet: { type: 'lava', pal: ['#080404', '#1e0e0c', '#3a1a14', '#5a2a1e', '#7a3a2a', '#9a5038'], emi: ['#8a1e04', '#ff6a10', '#ffe070'], atm: '#ff6a3a', tilt: 0.15, spin: 0.045 }
  },
  {
    name: 'Campo de Hélios', desc: 'Sob a luz de um gigante de gelo, ouro e platina reluzem entre as rochas.',
    ores: [3, 4, 5], w: [0.58, 0.32, 0.1], cost: 5e6, req: 25,
    rock: ['#1a1e24', '#323a44', '#505c6a', '#7a8a98', '#aebccb'],
    neb: { c: ['#0a0602', '#24140a', '#4a2a10', '#7a4a18'], alt: ['#2a1a04', '#5a3a0a', '#9a6a1a'], star: '#fff0c0' },
    planet: { type: 'ice', pal: ['#06101a', '#123050', '#2a5a8a', '#5a9ac8', '#a0d4f0', '#f0fbff'], emi: ['#000000', '#000000', '#000000'], atm: '#a8e8ff', tilt: -0.2, spin: 0.03, ring: { inner: 1.4, outer: 1.95, flat: 0.2, tilt: 0.22, col: ['#4a6a80', '#9ac0d8', '#e0f4ff'] } }
  },
  {
    name: 'Abismo Violeta', desc: 'Um vazio púrpura onde o irídio cristaliza no frio absoluto.',
    ores: [4, 5, 6], w: [0.58, 0.32, 0.1], cost: 2.5e8, req: 30,
    rock: ['#16101e', '#2c2040', '#463462', '#6a5090', '#9a80c0'],
    neb: { c: ['#06030c', '#160a2a', '#2a124e', '#46207a'], alt: ['#200a30', '#40145a', '#6a2a8a'], star: '#e8d8ff' },
    planet: { type: 'gas', bands: 14, pal: ['#0a0614', '#24143e', '#40246a', '#6a3a9a', '#9a6ac8', '#e0c8ff'], emi: ['#000000', '#000000', '#000000'], atm: '#c08aff', tilt: 0.35, spin: 0.075 }
  },
  {
    name: 'Fenda Cristalina', desc: 'Um planeta de cristal fraturado emite pulsos quânticos. Irídio em abundância.',
    ores: [5, 6, 7], w: [0.56, 0.32, 0.12], cost: 1.5e10, req: 35,
    rock: ['#0e1a1e', '#1a3238', '#2a5058', '#4a7a80', '#7ab0b0'],
    neb: { c: ['#020a0c', '#04202a', '#083a48', '#0e5a6a'], alt: ['#04281e', '#0a4a38', '#147a5a'], star: '#d0ffff' },
    planet: { type: 'crystal', pal: ['#020c10', '#06303a', '#0e5a66', '#1a8a94', '#4ac8c8', '#b0fff4'], emi: ['#0e8a8a', '#4affff', '#e0ffff'], atm: '#6affff', tilt: -0.15, spin: 0.03 }
  },
  {
    name: 'Horizonte Sombrio', desc: 'Matéria escura pulsa nas sombras de um mundo morto. Poucos voltam daqui.',
    ores: [6, 7, 8], w: [0.55, 0.33, 0.12], cost: 1e12, req: 40,
    rock: ['#100a12', '#201422', '#36223a', '#523456', '#7a5080'],
    neb: { c: ['#040205', '#12061a', '#22082e', '#3a0c48'], alt: ['#1a0410', '#3a0820', '#5a1032'], star: '#ffd0f0' },
    planet: { type: 'dark', pal: ['#030204', '#0c0810', '#18101e', '#24182c', '#34223e', '#4a3054'], emi: ['#5a0a6a', '#d02ab8', '#ffb0f0'], atm: '#d02ab8', tilt: 0.4, spin: 0.04 }
  },
  {
    name: 'Núcleo do Magnetar', desc: 'Uma estrela de nêutrons distorce o espaço. O minério mais denso do universo aguarda.',
    ores: [7, 8, 9], w: [0.52, 0.34, 0.14], cost: 8e13, req: 50,
    rock: ['#0c1020', '#182040', '#283664', '#405490', '#6a84c0'],
    neb: { c: ['#02030a', '#060a24', '#0c1640', '#142460'], alt: ['#0a0a30', '#1a1a5a', '#2a3a9a'], star: '#e0e8ff' },
    planet: { type: 'star', pal: ['#1a3aa0', '#3a6aff', '#7aa8ff', '#c0dcff', '#ffffff'], emi: ['#000000', '#000000', '#000000'], atm: '#6a9cff', tilt: 0, spin: 0.1 }
  }
];

// eff(l) mostra o efeito no nível l (usa D, definido em game.js)
const UPGRADES = [
  { id: 'fleet', name: 'Drone Minerador', icon: 'drone', base: 15, mult: 1.42, desc: 'Adiciona um drone autônomo à frota.', max: () => D.maxDrones() - 1, eff: l => `${1 + l} drones` },
  { id: 'laser', name: 'Laser de Mineração', icon: 'laser', base: 20, mult: 1.6, desc: 'Aumenta o dano dos lasers da frota. Novas cores a cada 12 níveis.', eff: l => `${U.fmt(D.dpsAt(l))} dano/s` },
  { id: 'cargo', name: 'Compartimento de Carga', icon: 'cargo', base: 30, mult: 1.55, desc: 'Cada viagem de drone traz mais minério.', eff: l => `${U.fmt(D.cargoAt(l))} un./viagem` },
  { id: 'speed', name: 'Propulsores Iônicos', icon: 'speed', base: 40, mult: 1.85, desc: 'Drones voam mais rápido entre a estação e as rochas.', max: () => 25, eff: l => `${Math.round(D.speedAt(l))} km/s` },
  { id: 'click', name: 'Broca de Plasma', icon: 'click', base: 10, mult: 1.5, desc: 'Mais dano por clique. Também soma 5% do dano total da frota.', eff: l => `${U.fmt(D.clickAt(l))} /clique` },
  { id: 'crit', name: 'Mira de Precisão', icon: 'crit', base: 120, mult: 2.1, desc: 'Chance de golpe crítico (dano ×5) nos cliques.', max: () => 20, eff: l => `${Math.round(D.critAt(l) * 100)}% crítico` },
  { id: 'field', name: 'Campo Gravitacional', icon: 'field', base: 150, mult: 2.5, desc: 'Atrai mais asteroides simultâneos para o setor.', max: () => 10, eff: l => `${5 + l} asteroides` },
  { id: 'scanner', name: 'Scanner Profundo', icon: 'scanner', base: 250, mult: 2.3, desc: 'Encontra asteroides ricos (×5 minério, cintilantes).', max: () => 20, eff: l => `${(D.richAt(l) * 100).toFixed(1)}% ricos` },
  { id: 'refine', name: 'Fornalha de Fusão', icon: 'flame', base: 200, mult: 1.75, desc: 'Refino mais rápido. Lotes dobram a cada 3 níveis.', max: () => 40, eff: l => `${D.refineTimeAt(l).toFixed(1)}s · lote ${U.fmt(D.batchAt(l))}` }
];

const RESEARCH = [
  { id: 'autosell', name: 'Corretora Automática', desc: 'Libera a venda automática no Mercado.', cost: 8 },
  { id: 'furn2', name: 'Fornalha II', desc: '+1 fornalha na Refinaria.', cost: 12 },
  { id: 'spectro', name: 'Espectrômetro', desc: 'Asteroides ricos aparecem 2× mais.', cost: 25 },
  { id: 'turret', name: 'Torreta da Estação', desc: 'A estação dispara contra asteroides com 60% do dano do clique.', cost: 40 },
  { id: 'aim', name: 'Mira Assistida', desc: '+5% de chance de crítico.', cost: 50, req: ['turret'] },
  { id: 'furn3', name: 'Fornalha III', desc: '+1 fornalha na Refinaria.', cost: 70, req: ['furn2'] },
  { id: 'hangar1', name: 'Hangar Expandido', desc: 'Frota máxima +10 drones.', cost: 90 },
  { id: 'comet', name: 'Radar de Cometas', desc: 'Cometas dourados aparecem 2× mais.', cost: 110 },
  { id: 'telemetry', name: 'Telemetria Remota', desc: 'Ganhos offline sobem de 50% para 100%.', cost: 150 },
  { id: 'reson', name: 'Laser Ressonante', desc: 'Dano dos drones ×1,5.', cost: 220 },
  { id: 'futures', name: 'Contratos Futuros', desc: '+15% no preço de venda de tudo.', cost: 300, req: ['autosell'] },
  { id: 'navai', name: 'IA de Navegação', desc: 'Dados obtidos ×2.', cost: 400 },
  { id: 'plasma', name: 'Plasma Térmico', desc: 'Refino 2× mais rápido.', cost: 550, req: ['furn3'] },
  { id: 'turret2', name: 'Torreta Gêmea', desc: 'Cadência da torreta ×2,5.', cost: 700, req: ['turret'] },
  { id: 'collector', name: 'Drones Coletores', desc: '+30% de minério bônus ao destruir asteroides.', cost: 900 },
  { id: 'furn4', name: 'Fornalha IV', desc: '+1 fornalha na Refinaria.', cost: 1200, req: ['plasma'] },
  { id: 'metal', name: 'Metalurgia Avançada', desc: 'Lingotes valem ×1,5.', cost: 1600 },
  { id: 'warp', name: 'Motor de Dobra', desc: 'Custo em créditos dos setores -30%.', cost: 2500 },
  { id: 'hangar2', name: 'Doca Orbital', desc: 'Frota máxima +15 drones.', cost: 4000, req: ['hangar1'] },
  { id: 'furn5', name: 'Fornalha V', desc: '+1 fornalha na Refinaria.', cost: 6000, req: ['furn4'] },
  { id: 'singular', name: 'Laser de Singularidade', desc: 'Dano dos drones ×3.', cost: 15000, req: ['reson'] }
];

const PRESTIGE = [
  { id: 'reson', name: 'Ressonância Estelar', desc: 'Valor de todos os minérios ×1,25 (acumula).', cost: l => Math.ceil(3 * Math.pow(1.7, l)), max: 60 },
  { id: 'drill', name: 'Brocas Ancestrais', desc: 'Dano de drones e cliques ×1,5 (acumula).', cost: l => Math.ceil(4 * Math.pow(1.8, l)), max: 40 },
  { id: 'legacy', name: 'Herança Robótica', desc: 'Começa cada jornada com +2 drones e aumenta a frota máxima em 2 (acumula).', cost: l => 2 + l * 2, max: 10 },
  { id: 'shortcut', name: 'Atalho Estelar', desc: 'Mantém +1 setor desbloqueado após o salto.', cost: l => 5 * (l + 1), max: 7 },
  { id: 'memory', name: 'Memória Quântica', desc: 'Mantém todas as pesquisas após o salto.', cost: () => 25, max: 1 },
  { id: 'golden', name: 'Cauda Dourada', desc: 'Recompensas de cometas ×2.', cost: () => 8, max: 1 },
  { id: 'chrono', name: 'Cronoestase', desc: '+4h no limite de ganhos offline.', cost: l => 4 + l * 4, max: 4 }
];

const ACH = [
  { id: 'click1', n: 'Primeiro Golpe', d: 'Minere com um clique.', c: s => s.stats.clicks >= 1 },
  { id: 'click1k', n: 'Dedo de Aço', d: 'Clique 1.000 vezes.', c: s => s.stats.clicks >= 1000 },
  { id: 'crit100', n: 'Golpe Certeiro', d: 'Acerte 100 críticos.', c: s => s.stats.crits >= 100 },
  { id: 'ast100', n: 'Demolidor', d: 'Destrua 100 asteroides.', c: s => s.stats.asteroids >= 100 },
  { id: 'ast1k', n: 'Cinturão Limpo', d: 'Destrua 1.000 asteroides.', c: s => s.stats.asteroids >= 1000 },
  { id: 'ast10k', n: 'Devorador de Mundos', d: 'Destrua 10.000 asteroides.', c: s => s.stats.asteroids >= 10000 },
  { id: 'rich1', n: 'Veio Precioso', d: 'Destrua um asteroide rico.', c: s => s.stats.rich >= 1 },
  { id: 'rich50', n: 'Garimpeiro Estelar', d: 'Destrua 50 asteroides ricos.', c: s => s.stats.rich >= 50 },
  { id: 'cr1k', n: 'Primeiro Milhar', d: 'Ganhe 1K créditos no total.', c: s => s.lifeCredits >= 1e3 },
  { id: 'cr1m', n: 'Milionário Orbital', d: 'Ganhe 1M créditos no total.', c: s => s.lifeCredits >= 1e6 },
  { id: 'cr1b', n: 'Magnata do Vácuo', d: 'Ganhe 1B créditos no total.', c: s => s.lifeCredits >= 1e9 },
  { id: 'cr1t', n: 'Trilionário Cósmico', d: 'Ganhe 1T créditos no total.', c: s => s.lifeCredits >= 1e12 },
  { id: 'cr1qa', n: 'Império Galáctico', d: 'Ganhe 1Qa créditos no total.', c: s => s.lifeCredits >= 1e15 },
  { id: 'dr5', n: 'Esquadrilha', d: 'Tenha 5 drones.', c: s => s.upg.fleet + 1 >= 5 },
  { id: 'dr15', n: 'Enxame', d: 'Tenha 15 drones.', c: s => s.upg.fleet + 1 >= 15 },
  { id: 'dr30', n: 'Armada', d: 'Tenha 30 drones.', c: s => s.upg.fleet + 1 >= 30 },
  { id: 'ing1', n: 'Forjador', d: 'Produza seu primeiro lingote.', c: s => s.stats.ingots >= 1 },
  { id: 'ing500', n: 'Siderúrgica', d: 'Produza 500 lingotes.', c: s => s.stats.ingots >= 500 },
  { id: 'sec3', n: 'Explorador', d: 'Alcance o 3º setor.', c: s => s.maxSector >= 2 },
  { id: 'sec6', n: 'Desbravador', d: 'Alcance o 6º setor.', c: s => s.maxSector >= 5 },
  { id: 'sec8', n: 'Fim do Mapa', d: 'Alcance o Núcleo do Magnetar.', c: s => s.maxSector >= 7 },
  { id: 'comet1', n: 'Caçador de Cometas', d: 'Capture um cometa dourado.', c: s => s.stats.comets >= 1 },
  { id: 'comet25', n: 'Colecionador Celeste', d: 'Capture 25 cometas.', c: s => s.stats.comets >= 25 },
  { id: 'res10', n: 'Cientista', d: 'Conclua 10 pesquisas.', c: s => Object.keys(s.research).length >= 10 },
  { id: 'resall', n: 'Mente Brilhante', d: 'Conclua todas as pesquisas.', c: s => Object.keys(s.research).length >= RESEARCH.length },
  { id: 'pre1', n: 'Salto no Escuro', d: 'Realize um Salto Quântico.', c: s => s.stats.prestiges >= 1 },
  { id: 'pre5', n: 'Viajante Quântico', d: 'Realize 5 Saltos Quânticos.', c: s => s.stats.prestiges >= 5 },
  { id: 'hour', n: 'Dedicação', d: 'Jogue por 1 hora.', c: s => s.stats.play >= 3600 }
];

const GOALS = [
  { t: 'Clique em um asteroide para minerar', c: s => s.stats.clicks >= 1, r: 5 },
  { t: 'Minere 25 unidades de minério', c: s => s.stats.mined >= 25, r: 10 },
  { t: 'Venda minério na aba Mercado', c: s => s.stats.sold >= 1, r: 10 },
  { t: 'Compre um Drone Minerador (aba Frota)', c: s => s.upg.fleet >= 1, r: 20 },
  { t: 'Melhore o Laser de Mineração ao nível 3', c: s => s.upg.laser >= 3, r: 50 },
  { t: 'Destrua 20 asteroides', c: s => s.stats.asteroids >= 20, r: 80 },
  { t: 'Ligue uma fornalha com Ferro e produza 3 Aço', c: s => s.stats.ingots >= 3, r: 100 },
  { t: 'Conclua uma pesquisa (aba Pesquisa)', c: s => Object.keys(s.research).length >= 1, r: 150 },
  { t: 'Tenha 5 drones na frota', c: s => s.upg.fleet >= 4, r: 300 },
  { t: 'Desbloqueie os Anéis de Kronos (aba Setores)', c: s => s.maxSector >= 1, r: 1000 },
  { t: 'Capture um cometa dourado', c: s => s.stats.comets >= 1, r: 2000 },
  { t: 'Tenha 10 drones na frota', c: s => s.upg.fleet >= 9, r: 5000 },
  { t: 'Chegue à Nebulosa Carmesim', c: s => s.maxSector >= 2, r: 2e4 },
  { t: 'Destrua 25 asteroides ricos', c: s => s.stats.rich >= 25, r: 1e5 },
  { t: 'Chegue ao Campo de Hélios', c: s => s.maxSector >= 3, r: 5e5 },
  { t: 'Realize um Salto Quântico (aba Salto)', c: s => s.stats.prestiges >= 1, r: 1e6 },
  { t: 'Chegue ao Abismo Violeta', c: s => s.maxSector >= 4, r: 1e8 },
  { t: 'Chegue à Fenda Cristalina', c: s => s.maxSector >= 5, r: 5e9 },
  { t: 'Chegue ao Horizonte Sombrio', c: s => s.maxSector >= 6, r: 3e11 },
  { t: 'Alcance o Núcleo do Magnetar', c: s => s.maxSector >= 7, r: 2e13 },
  { t: 'Acumule 1Qi créditos no total', c: s => s.lifeCredits >= 1e18, r: 1e16 }
];

// Personagens do painel de comunicações. pal: cores do retrato gerado em GFX.portrait
const PORTRAITS = {
  ia: {
    name: 'IA da Estação',
    pal: { bg: '#04121a', k: '#06060e', h: '#d0d8f0', m: '#8a94bc', d: '#3a3f5a', v: '#06202a', e: '#5ef2ff', E: '#e0ffff', a: '#ff4a4a', g: '#123040', G: '#5ef2ff' }
  }
};

const TABS = [
  { id: 'frota', name: 'Frota', icon: 'drone' },
  { id: 'refino', name: 'Refino', icon: 'flame' },
  { id: 'mercado', name: 'Mercado', icon: 'chart' },
  { id: 'pesquisa', name: 'Pesquisa', icon: 'flask' },
  { id: 'setores', name: 'Setores', icon: 'planet' },
  { id: 'salto', name: 'Salto', icon: 'star' },
  { id: 'trofeus', name: 'Troféus', icon: 'trophy' },
  { id: 'config', name: 'Ajustes', icon: 'gear' }
];
