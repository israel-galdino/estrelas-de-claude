# Órbita Mineradora — Inconsistências encontradas

Análise por leitura do código (não testado em jogo), em 19/11/2026.

**Status (Fase 1, save v2):** itens 1, 2, 3, 4, 6 e 7 corrigidos; 5 e 8 documentados sem mudança de código.

## Médio impacto

### 1. Venda automática offline ignora as configurações
- **Onde:** `js/game.js`, função `applyOffline`
- **O que acontece:** ao voltar de uma ausência, todo o minério coletado é vendido ao preço do momento, mesmo que o preço esteja abaixo do limiar configurado (`S.autosell.thr`). A opção "Incluir lingotes" também é ignorada.
- **Sugestão:** aplicar o mesmo filtro de `autoSell()` (`S.prices[i] >= S.autosell.thr`) e respeitar `S.autosell.ingots`.
- **Status:** ✅ corrigido — `autoSellPass()` é usada em tempo real e offline.

### 2. Herança Robótica tem níveis inúteis sem os hangares
- **Onde:** `doPrestige` e `D.maxDrones` (`js/game.js`); `PRESTIGE.legacy` (`js/data.js`)
- **O que acontece:** a tecnologia vai até +20 drones (10 níveis × 2), mas a frota máxima sem as pesquisas Hangar Expandido/Doca Orbital é 15. Como as pesquisas são zeradas no salto (exceto com Memória Quântica), os níveis 8 a 10 não têm efeito.
- **Sugestão:** limitar a 7 níveis, ou aplicar o bônus depois de liberar os hangares, ou fazer a Herança também aumentar a frota máxima.
- **Status:** ✅ corrigido — cada nível também dá +2 na frota máxima (`D.maxDrones`).

## Baixo impacto

### 3. Teto de crítico (90%) nunca é alcançado
- **Onde:** `D.critAt` em `js/game.js`
- **O que acontece:** Mira de Precisão vai até o nível 20 (3% × 20 = 60%) + 5% da Mira Assistida = 65% no máximo.
- **Sugestão:** remover o teto ou adicionar fontes de crítico (prestígio, conquistas) que justifiquem o limite.
- **Status:** ✅ corrigido — teto agora é `D.critMax()` (65%, soma das fontes existentes).

### 4. Histórico de preços não é salvo
- **Onde:** `G.hist` e `Game.init` em `js/game.js`
- **O que acontece:** ao recarregar a página, o histórico é preenchido com 30 cópias do preço atual, e os sparklines do Mercado começam retos.
- **Sugestão:** salvar um histórico curto no save ou aceitar o comportamento como intencional.
- **Status:** ✅ corrigido — últimos 48 pontos salvos em `S.ph`.

### 5. Cliques manuais não contam na taxa de produção
- **Onde:** `clickAt` → `addOre(..., false)` em `js/game.js`
- **O que acontece:** minério extraído por clique não entra em `S.rates`, então não conta para os ganhos offline, para o CR/s do HUD nem para o prêmio em créditos dos cometas (`G.cps * 90`).
- **Observação:** provavelmente intencional (offline simula só a frota), mas vale documentar.
- **Status:** 📝 intencional, documentado no CLAUDE.md.

### 6. Importação de save com validação mínima
- **Onde:** ação `import-yes` (`js/ui.js`) e `mergeState` (`js/game.js`)
- **O que acontece:** só é verificado se existe a chave `upg`; qualquer chave extra do JSON é copiada para o estado.
- **Sugestão:** ignorar chaves que não existem em `defaultState()`.
- **Status:** ✅ corrigido — `mergeState` ignora chaves desconhecidas e `sanitize` valida tipos, limites e ids.

### 7. Versão do save sem migração
- **Onde:** `defaultState().v = 1` e `mergeState`
- **O que acontece:** não existe rotina de migração por versão, apenas o merge com o estado padrão. Funciona hoje, mas mudanças de formato (renomear campos, mudar arrays) vão exigir migração explícita.
- **Sugestão:** adicionar `migrate(s)` com um `switch` por `s.v`.
- **Status:** ✅ corrigido — `migrate()` com `SAVE_VERSION = 2`.

## Cosmético

### 8. Nome do repositório diferente do nome do jogo
- O repositório se chama `estrelas-de-claude`; o jogo, o título e o README usam "Órbita Mineradora".
- **Status:** 📝 sem mudança (renomear o repositório é decisão do dono).
