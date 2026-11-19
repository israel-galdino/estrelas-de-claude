# Órbita Mineradora — guia do código

Idle de mineração espacial em pixel art, em português do Brasil. HTML/CSS/JS puros, **sem dependências, sem bundler, sem módulos ES**. Toda arte e som são gerados por código.

## Arquitetura

Scripts globais concatenados pelo `build.js`, nesta ordem (cada arquivo só pode usar, no topo, o que vem antes; dentro de funções pode usar qualquer global):

| Ordem | Arquivo | Papel |
|---|---|---|
| 1 | `js/util.js` | `U`: RNG com seed (`U.mulberry`), ruído, cores, sprites a partir de strings, fonte bitmap 3×5 do canvas, `U.fmt`, `U.store` (localStorage com try/catch) |
| 2 | `js/data.js` | Tabelas de conteúdo: `ORES`, `SECTORS`, `UPGRADES`, `RESEARCH`, `PRESTIGE`, `ACH`, `GOALS`, `TABS`, `PORTRAITS` |
| 3 | `js/audio.js` | `SFX`: efeitos sintetizados em WebAudio |
| 4 | `js/gfx.js` | `GFX`: arte procedural (asteroides, planetas, nebulosas, estação, drones, ícones, retratos), sempre cacheada |
| 5 | `js/game.js` | Estado (`S`, `G`, `D`), simulação, economia, render do canvas, save/offline, `Game` (API usada pela UI) |
| 6 | `js/ui.js` | `UI`: HUD, abas, comunicações, radar, alertas, toasts, modais |

`style.css` e `body.html` são a casca da interface. **Novo arquivo em `js/` precisa entrar no array do `build.js` na posição certa.**

### S, G e D

- **`S`** — estado **salvo**. Só dados serializáveis em JSON. Toda chave precisa existir em `defaultState()` (o carregamento ignora chaves que não estão lá). Mudou o formato? Migração (veja abaixo).
- **`G`** — estado de **execução**: entidades (asteroides, drones, partículas), timers, caches de canvas, mouse, histórico de preços em memória. Nunca vai para o save diretamente (o histórico é copiado para `S.ph` em `save()`).
- **`D`** — valores **derivados** de `S` (dano, carga, frota máxima, preços…). Funções puras, sem efeitos colaterais; quando existe `xAt(l)`, ela calcula o valor para um nível arbitrário (usado nos textos "atual ▸ próximo").

### Convenções de `data.js`

- `ORES` e `SECTORS` são referenciados **por índice** (`S.ores[i]`, `SECTORS[s].ores = [0, 1, 2]`). Não reordene; só acrescente no fim.
- `UPGRADES`, `RESEARCH`, `PRESTIGE`, `ACH` são referenciados **por `id`** (`S.upg.laser`, `S.research.turret`). Ids não mudam depois de publicados (saves dependem deles).
- `eff(l)` e `max()` são funções preguiçosas que leem `D`/`S` em tempo de execução (por isso `data.js` pode vir antes de `game.js`).
- `req: ['id', …]` lista pré-requisitos de pesquisa. Condições `c: s => …` (conquistas, missões) recebem o estado e são puras.
- Todo texto visível em pt-BR.

## Build

```
node build.js
```

Gera `index.html` (abrir direto no navegador) e `dist/orbita.html`. Nunca edite esses dois à mão. Não há testes automatizados nem lint; depois de mudar algo, rode o build e abra `index.html` conferindo o console.

## Desempenho

- Sprites e texturas são gerados **uma vez** e guardados em canvas offscreen (padrão de `GFX.glow`, `GFX.stationBase`, `makeAsteroid` com quadros pré-renderizados). Nada de criar canvas, gradientes ou strings grandes por quadro.
- Partículas passam por `part()`, que respeita `D.pcap()` (depende de `S.settings.fx`). Efeitos novos devem usar o mesmo caminho e escalar com `S.settings.fx`.
- O canvas roda em baixa resolução (≈400×240) escalado com `image-rendering: pixelated`; desenhe em coordenadas inteiras.
- Meta: 60 fps em notebook comum e funcionar no celular.

### UI: build × patch

Cada aba em `UI.tabs` tem `key()`, `build()` e `patch()`:

- `key()` devolve uma string que descreve a **estrutura** da aba (quais cartões existem, o que está no máximo, quais minérios foram vistos…).
- `build()` gera o HTML do esqueleto e marca os nós dinâmicos com `data-r="nome"`. Só roda ao trocar de aba ou quando `key()` muda.
- `patch()` escreve os valores com os helpers `UI.txt`, `UI.html`, `UI.cls`, `UI.dis`, `UI.w`, `UI.attr`, `UI.src` — eles guardam o último valor no próprio nó e não tocam no DOM se nada mudou. `patch()` roda logo depois de cada `build()`, então todo valor dinâmico tem um único caminho de escrita.

Regra: se algo muda a cada tick, vai no `patch()`; se muda quais elementos existem, entra na `key()`. `UI.dbg` (`builds`, `patches`) ajuda a conferir no console que não há rebuild por tick.

Mensagens do jogo vão para o painel de comunicações via `log(text, col)` em `game.js` (que chama `UI.comms.say`).

HUD de ponte de comando (`ui.js`): `UI.comms` (fila de mensagens com texto digitado; retratos de `PORTRAITS` desenhados por `GFX.portrait`), `UI.radar` (canvas próprio a 10 fps), status da estação e alertas (`UI.calcAlerts`). Tudo respeita `UI.reduced` (`prefers-reduced-motion`): sem digitação, sem piscar, radar sem varredura.

O CSS tem `[hidden] { display: none !important; }`: use o atributo `hidden` (ou `UI.hide`) para esconder elementos, mesmo os que têm `display` próprio.

## Save

- Chave do localStorage: `orbita-mineradora-v1` (**não muda**; a versão do formato fica em `S.v`).
- Versão atual: `SAVE_VERSION` em `game.js`.
- Fluxo de carregamento (`loadState`): `migrate(obj)` → `mergeState(defaultState(), obj)` (só chaves conhecidas) → `sanitize(s, obj)` (tipos, limites, ids válidos em `research`/`pupg`/`ach`, fornalhas).
- Saves antigos **nunca** podem quebrar. Importação de um save com `v` maior que `SAVE_VERSION` é recusada.

### Como adicionar uma migração

1. Suba `SAVE_VERSION` (ex.: 2 → 3).
2. Em `migrate()`, troque o `case 2: // versão atual` por um `case 2:` que converte o objeto cru da v2 para a v3 (renomear campos, converter arrays…), terminando com `// falls through`, e adicione `case 3: // versão atual` + `break`.
3. Nunca apague cases antigos: um save v1 passa por todos em sequência.
4. Campos novos com valor padrão simples não precisam de migração — basta colocá-los em `defaultState()`. Mapas de chave dinâmica precisam de regra em `sanitize()`.
5. Teste carregando um save exportado da versão anterior.

## Notas de design

- Minério de **cliques manuais** não entra em `S.rates` de propósito: os ganhos offline, o CR/s do HUD e o prêmio de cometas simulam só a produção automática (frota, torreta, coletores).
- A venda automática (tempo real e offline) passa por `autoSellPass()`: limiar de preço, reserva das fornalhas e opção de lingotes.
- O teto de crítico é `D.critMax()`, a soma das fontes existentes. Ao criar uma nova fonte de crítico, some-a lá.
- Herança Robótica dá +2 drones iniciais **e** +2 de frota máxima por nível.
- Valores de balanceamento não mudam sem aprovação explícita do dono do projeto.
