# Órbita Mineradora

Idle de mineração espacial em pixel art, feito com HTML, CSS e JavaScript puros (sem dependências). Toda a arte é feita em código: asteroides, planetas, nebulosas e estação são procedurais; as naves são plantas desenhadas pixel a pixel, iluminadas e coloridas por código.

## Jogar

Abra `index.html` no navegador. Ou ative o GitHub Pages (Settings → Pages → branch `main`, pasta `/`) e jogue pelo link do repositório.

## Recursos

- Mineração por clique e por frota de drones autônomos, com torreta na estação
- 10 minérios, mercado com preços variáveis e venda automática
- Refinaria com até 5 fornalhas produzindo lingotes
- 21 pesquisas + calibração infinita, 8 setores com planetas próprios
- Salto Quântico (prestígio) com tecnologias permanentes
- Missões, 28 conquistas, cometas dourados, chuvas de meteoros
- HUD de ponte de comando: comunicações da IA da estação, radar do setor, status da estação e alertas
- Ganhos offline, save automático, exportar/importar (com migração de versões)

## Estrutura

- `js/` — código-fonte (`util`, `data`, `audio`, `gfx`, `ships`, `game`, `ui`)
- `tools/ships-preview.html` — prévia do catálogo de naves (ferramenta de desenvolvimento, fora do build)
- `style.css`, `body.html` — interface
- `build.js` — gera `index.html` (arquivo único) e `dist/orbita.html`: `node build.js`
