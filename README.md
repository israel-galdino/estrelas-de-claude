# Órbita Mineradora

Idle de mineração espacial em pixel art, feito com HTML, CSS e JavaScript puros (sem dependências). Toda a arte — asteroides, planetas, nebulosas, estação e drones — é gerada por código.

## Jogar

Abra `index.html` no navegador. Ou ative o GitHub Pages (Settings → Pages → branch `main`, pasta `/`) e jogue pelo link do repositório.

## Recursos

- Mineração por clique e por frota de drones autônomos, com torreta na estação
- 10 minérios, mercado com preços variáveis e venda automática
- Refinaria com até 5 fornalhas produzindo lingotes
- 21 pesquisas + calibração infinita, 8 setores com planetas próprios
- Salto Quântico (prestígio) com tecnologias permanentes
- Missões, 28 conquistas, cometas dourados, chuvas de meteoros
- Ganhos offline, save automático, exportar/importar

## Estrutura

- `js/` — código-fonte (`util`, `data`, `audio`, `gfx`, `game`, `ui`)
- `style.css`, `body.html` — interface
- `build.js` — gera `index.html` (arquivo único) e `dist/orbita.html`: `node build.js`
