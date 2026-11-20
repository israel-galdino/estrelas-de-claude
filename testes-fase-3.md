# Fase 3: naves (concluída em 20/11/2026)

O jogo agora usa o catálogo de naves desenhadas à mão (`js/ships.js`). Cada nave tem duas versões:

- **Mapa:** pequena e limpa. É a que aparece no jogo, para o cenário ter mais destaque que as naves.
- **Detalhe:** umas 4× maior, com painéis, rebites, grelhas, luzes e chevrons, para ver ampliada.

| Nave | Papel | Detalhe | Mapa | Onde aparece |
|---|---|---|---|---|
| Flecha | drone de mineração (o conceito C) | 62×33 px | 17×11 px | no jogo, em todos os drones |
| Mula | cargueiro de contêineres | 90×43 px | 28×15 px | só na prévia, por enquanto |
| Vespa | patrulha / interceptador | 66×31 px | 20×11 px | só na prévia, por enquanto |

O drone antigo (11×7) e os conceitos A e B foram removidos. O formato do save não mudou.

## Como abrir

- **Jogo:** `index.html`
- **Prévia das naves:** cole no Chrome ou no Edge:

  ```
  file://wsl.localhost/Ubuntu/home/n0wt/projetos/estrelas-de-claude/tools/ships-preview.html
  ```

  A página não precisa de build. Se algo der errado, aparece uma faixa vermelha no topo com o erro.

## 1. No jogo

- [ ] O jogo abre sem erros no console (F12).
- [ ] Os drones são Flechas pequenas. Em voo a chama sai dos três motores; parados, minerando, mostram só um brilho fraco.
- [ ] O laser sai do nariz do drone, nos dois sentidos.
- [ ] A barra de carga aparece logo abaixo do drone.
- [ ] Comprar Laser até os níveis 12, 24, 36, 48 e 60 muda as cores (pintura, cabine, laser e chama).
- [ ] O ícone de "Drone Minerador" na loja é a Flecha.
- [ ] Em Ajustes, com "Efeitos: Baixos", os drones parados ficam sem o brilho do motor.
- [ ] Com muitos drones (20+), o jogo continua fluido.
- [ ] Um save antigo carrega normalmente. Testei salvando e recarregando: o laser, a frota e os drones voltam iguais.

## 2. Na prévia

- [ ] **No tamanho do jogo:** drones Flecha minerando e um indo e voltando; Mula e Vespa cruzam ao fundo, uma por vez. O "Zoom da cena" vai de automático a 6×.
- [ ] **Catálogo:** cada nave tem a versão de detalhe ampliada ("Zoom da versão de detalhe", 2× a 8×) e as faixas da versão do mapa por tier e por facção.
- [ ] O seletor **Motor** alterna entre "voando" (chama acesa) e "parado" (só o brilho).
- [ ] Com **Virada para: Esquerda**, a luz continua vindo de cima e da esquerda.
- [ ] Os detalhes da versão ampliada estão bons: asas em placas e cabine com moldura na Flecha; contêineres com nervuras e ponte com janelas na Mula; listras, asas com nervuras e canhões na Vespa.

## Medições (Chrome headless, 20/11)

- Jogo com 12 drones: 60 fps, sem erros. O cache de sprites ficou estável (2 → 2 em 2 s) e só cresce quando o tier muda.
- Prévia: tempo médio de ~1,1 ms por nave, contando as duas orientações.

## Próximos passos (fora da fase 3)

- **Cenário A:** pós-processamento (bloom, cor ambiente por setor, nebulosa em 2 camadas, granulação).
- **Cenário B:** elementos novos (luas, estruturas distantes, tráfego de naves ao fundo usando a Mula e a Vespa, cinturão distante, rochas em primeiro plano, galáxia).
- **Naves:** estágios desenhados por tier (Mk II, Mk III) e um lugar no jogo para ver a versão de detalhe (o estaleiro da fase 4).

## Anotações

-
