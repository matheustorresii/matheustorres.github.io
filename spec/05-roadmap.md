# 05 — Roadmap e tarefas

Fases incrementais. **Cada fase termina num app que roda e é verificável.** O executor faz
**uma tarefa por vez**, na ordem, e só avança quando o **DoD** passa. Onde uma tarefa cita
um RF, o comportamento exato está em `01-requirements.md`.

Convenções das tarefas: **Objetivo** · **Arquivos** · **Passos** · **DoD** (Definition of
Done). Nomes de arquivo referenciam a estrutura de `02-architecture.md`.

> Ordem macro (rationale): primeiro o **canvas** (a "sensação boa", como o dono pediu),
> depois **organização** (feature prioritária), depois **persistência local**, depois
> **sync GitHub**, por fim **compartilhamento** e **polish**. Cada camada é usável sozinha.

---

## Fase 0 — Scaffold do projeto

### T0.1 — Criar o workspace `apps/whiteboard`
- **Objetivo:** projeto Vite+React+TS vazio que roda, isolado do `apps/web` antigo.
- **Arquivos:** `apps/whiteboard/{package.json,tsconfig.json,vite.config.ts,index.html}`,
  `src/{main.tsx,App.tsx}`, `src/styles/{tokens.css,global.css}`.
- **Passos:**
  1. Criar `package.json` do workspace (nome `@11a3/whiteboard`), deps: `react`,
     `react-dom`, `zustand`, `idb`, `nanoid`, `perfect-freehand`; devDeps: `vite`,
     `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`.
  2. `vite.config.ts` com plugin React e `base` compatível com deploy em raiz (`'./'` ou
     `'/'`; ver 02 §8 — não mexer no deploy ainda).
  3. `index.html` com `<div id="root">`, fontes (04 §3), `<title>11A3</title>`.
  4. `main.tsx` monta `<App/>`; `App.tsx` renderiza um placeholder "11A3".
  5. `tokens.css` com todos os tokens de `04-visual-identity.md`; `global.css` com reset.
- **DoD:** `npm run dev --workspace apps/whiteboard` abre e mostra a marca 11A3 com o verde
  neon e as fontes corretas. `npm run build` gera `dist/` estático. Nenhum deploy/push.

### T0.2 — Hash router + shell de layout
- **Objetivo:** rotas `#/`, `#/b/<id>`, `#/s/<id>` e o layout base (sidebar+toolbar+canvas
  host vazios).
- **Arquivos:** `src/router.ts`, `src/App.tsx`, `src/ui/Workspace.tsx`,
  `src/ui/{Sidebar,Toolbar,CanvasHost}.tsx` (esqueletos), `src/ui/SharedViewer.tsx` (stub).
- **Passos:** implementar `getRoute()`/`onRouteChange()` sobre `hashchange`; `App` decide
  Workspace vs SharedViewer; layout em grid (sidebar à esquerda, toolbar no topo, canvas
  host ocupando o resto) usando os tokens.
- **DoD:** navegar entre `#/` e `#/s/x` troca a tela; layout responde ao resize; sem canvas
  funcional ainda (host é um `<div>`).

---

## Fase 1 — Canvas mínimo (a base de tudo)

> Meta: retângulo + pan + zoom, render performático. Este é o "hello world" do canvas do
> prompt do dono.

### T1.1 — SceneStore + viewport + geometria
- **Objetivo:** estado imperativo da cena e conversões de coordenada.
- **Arquivos:** `canvas/SceneStore.ts`, `canvas/viewport.ts`, `canvas/geometry.ts`,
  `lib/events.ts`, `types/model.ts` (colar os tipos de `03-data-model.md`).
- **Passos:** `SceneStore` guarda `elements: Element[]`, `selection: string|null`,
  `viewport`. API: `add/update/remove/get/all`, `setViewport`, `subscribe(cb)`/`notify()`.
  `viewport.ts` implementa `worldToScreen/screenToWorld` (02 §3). `geometry.ts`: `aabb()`,
  `pointInRect`, `distPointToSegment`, `rectsIntersect`, `clamp`.
- **DoD:** testes unitários simples (Vitest) de conversão de coordenada e de interseção de
  AABB passam. (Reusar o `vitest` já no repo raiz.)

### T1.2 — CanvasRoot: loop, DPR, dirty-flag, resize
- **Objetivo:** `<canvas>` que limpa e redesenha só quando dirty, nítido em HiDPI.
- **Arquivos:** `canvas/CanvasRoot.ts`, `canvas/Renderer.ts`, `ui/CanvasHost.tsx`.
- **Passos:** `CanvasRoot` cria canvas dentro do host, ajusta `width/height` por
  `devicePixelRatio`, roda RAF, chama `Renderer.draw` quando `dirty`. `ResizeObserver` no
  host re-dimensiona e marca dirty. `Renderer.draw` aplica `setTransform` da viewport e
  limpa. `CanvasHost.tsx` instancia o `CanvasRoot` num `useEffect` (monta/desmonta).
- **DoD:** RF-CANVAS-01/02. Canvas preenche a área, nítido em tela retina, e o profiler
  mostra **zero redesenho** quando o mouse está parado.

### T1.3 — Pan e zoom
- **Objetivo:** navegar pelo board infinito.
- **Arquivos:** `canvas/InputController.ts`, `canvas/viewport.ts`.
- **Passos:** `wheel` → zoom-to-cursor (clamp escala 0.05–64; ajustar offset para o ponto
  sob o cursor ficar fixo — fórmula:
  `offset += (cursorScreen - offset) * (1 - newScale/oldScale)` por eixo). Space+arrastar
  ou botão do meio → pan (soma delta ao offset). Marcar dirty em cada mudança.
- **DoD:** RF-CANVAS-04. Zoom centra no cursor; pan é fluido; escala respeita limites.

### T1.4 — Desenhar retângulo + render com culling
- **Objetivo:** primeira ferramenta de desenho e o pipeline de render por tipo.
- **Arquivos:** `canvas/shapes/rectangle.ts`, `canvas/Renderer.ts`,
  `canvas/InputController.ts`, `store/uiStore.ts`, `ui/Toolbar.tsx`.
- **Passos:** `uiStore` guarda `tool` (`'select'|'rectangle'|…`) e `StyleDefaults`. Toolbar
  seleciona ferramenta. Com `rectangle`: pointerdown cria elemento em construção,
  pointermove atualiza `w/h`, pointerup → `AddElement` (mas History só chega na Fase 3;
  por ora, `SceneStore.add` direto — **marcar TODO** para trocar por command na T3.1).
  `Renderer` itera elementos, aplica **culling** (pular se AABB não intersecta viewport),
  e desenha via `shapes/rectangle.ts`.
- **DoD:** RF-CANVAS-03/05 (parcial). Desenhar vários retângulos; ao dar pan para longe,
  os fora de tela não são desenhados (verificável com contador de draws em dev).

---

## Fase 2 — Seleção, mover, resize, deletar

### T2.1 — Hit-testing + seleção de um elemento
- **Arquivos:** `canvas/hitTest.ts`, `canvas/selection.ts`, `canvas/InputController.ts`,
  `canvas/Renderer.ts`.
- **Passos:** ferramenta `select`: pointerdown faz hit-test (iterar do maior `zIndex` para
  o menor; AABB + teste preciso por tipo). Seta `SceneStore.selection`. Desenhar bounding
  box + 4 alças de canto (selection.ts calcula posições). Clique no vazio limpa seleção.
- **DoD:** RF-CANVAS-06. Clicar seleciona o elemento certo (o de cima quando sobrepostos);
  bounding box e alças aparecem.

### T2.2 — Mover e redimensionar
- **Arquivos:** `canvas/InputController.ts`, `canvas/geometry.ts`.
- **Passos:** pointerdown sobre o corpo do selecionado → `dragging` (soma delta ao `x,y`).
  pointerdown sobre uma alça → `resizing` (reescala mantendo o canto oposto fixo;
  normalizar w/h se cruzar). Atualização é efêmera durante o gesto; o command definitivo
  entra na Fase 3.
- **DoD:** RF-CANVAS-07. Mover e redimensionar funcionam suave; cantos se comportam certo.

### T2.3 — Deletar
- **Arquivos:** `canvas/InputController.ts`.
- **Passos:** Delete/Backspace remove o selecionado (via `SceneStore.remove`; virará
  command na Fase 3).
- **DoD:** RF-CANVAS-08.

---

## Fase 3 — Undo/Redo (command layer)

### T3.1 — Introduzir History + commands e converter mutações
- **Objetivo:** **toda** mutação de cena passa a ser um Command; undo/redo funciona.
- **Arquivos:** `commands/{Command.ts,commands.ts,History.ts}`, e refactor de
  `InputController.ts` e da criação/edição de elementos.
- **Passos:** implementar `Command`, `History` (02 §4) e os commands `AddElement`,
  `DeleteElement`, `UpdateElement`. Converter T1.4/T2.2/T2.3 para emitir commands:
  desenhar → `AddElement` no pointerup; mover/resize → um `UpdateElement` (before capturado
  no pointerdown, after no pointerup); deletar → `DeleteElement`. Atalhos Ctrl/Cmd+Z e
  Ctrl/Cmd+Shift+Z. Remover todos os TODOs de "SceneStore direto".
- **DoD:** RF-CANVAS-09. Qualquer ação (add/move/resize/delete) desfaz e refaz corretamente,
  inclusive múltiplos passos. Um gesto de drag = **um** passo de undo (não N frames).

---

## Fase 4 — Demais elementos

### T4.1 — Elipse e linha
- **Arquivos:** `canvas/shapes/{ellipse,line}.ts`, toolbar, hitTest.
- **DoD:** desenhar, selecionar, mover, resize, deletar, undo/redo para elipse e linha.

### T4.2 — Freehand (perfect-freehand)
- **Arquivos:** `canvas/shapes/freehand.ts`.
- **Passos:** capturar pontos no drag; gerar o outline com `perfect-freehand`; guardar
  `points` (e `pressures` se disponível). AABB derivado dos pontos.
- **DoD:** traço livre suave; selecionável/movível; undo/redo.

### T4.3 — Texto simples
- **Arquivos:** `canvas/shapes/text.ts`, `ui/CanvasHost.tsx` (overlay `<textarea>`),
  `canvas/InputController.ts`.
- **Passos:** ferramenta texto: pointerdown abre um `<textarea>` flutuante posicionado por
  `worldToScreen` e escalado pelo zoom; ao confirmar (blur/Esc/Enter conforme decisão),
  medir o texto e criar `TextElement`. Editar texto existente = duplo-clique reabre o
  textarea. Renderizar com `fillText` respeitando `fontSize` em world space.
- **DoD:** RF-CANVAS-11. Escrever, editar, mover texto; alinhamento correto em qualquer
  zoom; undo/redo.

### T4.4 — StylePanel (cor/espessura/opacidade/fonte)
- **Arquivos:** `ui/StylePanel.tsx`, `store/uiStore.ts`.
- **Passos:** editar estilo do elemento selecionado (via `UpdateElement`) e os
  `StyleDefaults` da ferramenta ativa.
- **DoD:** RF-CANVAS-12. Trocar cor/espessura/opacidade/fonte reflete no canvas e entra no
  undo.

---

## Fase 5 — Binding de setas

### T5.1 — Seta reta + ponta (arrowhead)
- **Arquivos:** `canvas/shapes/arrow.ts`.
- **DoD:** desenhar seta com cabeça na ponta final; selecionar/mover/resize/undo.

### T5.2 — Binding simplificado
- **Arquivos:** `canvas/binding.ts`, integração no InputController e nos commands de move/
  resize.
- **Passos:** ao soltar/mover uma ponta a ≤ `THRESHOLD` (world) de um shape, calcular o
  ponto de borda mais próximo, gravar `boundStart/boundEnd` (`elementId`, `focusX/Y`,
  `gap`). Ao mover/resize o shape alvo, recalcular as pontas ligadas **dentro do mesmo
  command** (fazem parte do `after`). Definir `THRESHOLD` (ex.: 16 world units) como
  constante nomeada.
- **DoD:** RF-CANVAS-10. Seta gruda ao aproximar; ao mover a caixa, a seta acompanha; undo
  reverte binding e posição juntos.

---

## Fase 6 — Persistência local (IndexedDB)

### T6.1 — DB + repositórios
- **Arquivos:** `persistence/{db.ts,boardsRepo.ts,foldersRepo.ts,settingsRepo.ts}`.
- **Passos:** abrir DB `whiteboard` (idb) com stores `boards/folders/settings` e índices
  (03 §5.1); implementar CRUD. Pedir `navigator.storage.persist()` na 1ª execução.
- **DoD:** RF-SYNC-01 (parcial). CRUD de board/folder no IndexedDB verificável no DevTools.

### T6.2 — Autosave + carregar board
- **Arquivos:** `store/libraryStore.ts`, `ui/Workspace.tsx`, `lib/debounce.ts`.
- **Passos:** ao editar a cena, `SceneStore.notify` → debounce(1s) → `boardsRepo.put`.
  Ao abrir `#/b/<id>`, carregar o board do IndexedDB para o SceneStore. Guardar `viewport`
  e `defaults` no `appState`.
- **DoD:** RF-SYNC-01. Editar, dar reload, e o board volta idêntico (inclui viewport).

---

## Fase 7 — Organização (feature prioritária)

### T7.1 — Listagem e CRUD de boards
- **Arquivos:** `ui/Sidebar.tsx`, `store/libraryStore.ts`, `ui/dialogs/*`.
- **Passos:** derivar `LibraryIndex` de folders+boards; listar; criar/renomear/duplicar/
  deletar board (duplicar = novo id, copia elements). Board aberto destacado.
- **DoD:** RF-ORG-01/02.

### T7.2 — Pastas e subpastas + mover
- **Arquivos:** `ui/Sidebar.tsx`, `foldersRepo.ts`, `ui/dialogs/MoveTo.tsx`.
- **Passos:** criar/renomear/mover/deletar pasta (aninhamento arbitrário; bloquear ciclos).
  Mover board entre pastas (drag-and-drop na árvore ou diálogo "Mover para"). Deletar pasta
  reparenteia conteúdo para a raiz com confirmação explícita.
- **DoD:** RF-ORG-03/04.

### T7.3 — Thumbnails
- **Arquivos:** `persistence/thumbnails.ts`, integração no autosave e na Sidebar.
- **Passos:** ao salvar, renderizar a cena num canvas offscreen reduzido → `toDataURL`
  (PNG pequeno) → gravar em `board.thumbnailDataUrl`. Exibir na listagem.
- **DoD:** RF-ORG-05. Cada board mostra preview atualizado.

---

## Fase 8 — Sync com GitHub

### T8.1 — Config de PAT/repo + cliente GitHub
- **Arquivos:** `sync/github.ts`, `ui/SyncPanel.tsx`, `settingsRepo.ts`.
- **Passos:** UI para colar PAT e definir `owner/repo` (e branch); guardar em `settings`.
  `github.ts`: `getFile/putFile` (Contents API, base64), `createSecretGist/getGist`.
  Instruções na UI: token **fine-grained**, escopo mínimo (Contents R/W no repo; Gists).
- **DoD:** RF-SYNC-02. Com um PAT válido, um `getFile` de teste responde 200/404 correto.

### T8.2 — Push/pull de board + index.json
- **Arquivos:** `sync/{syncEngine.ts,indexFile.ts}`.
- **Passos:** push: `getFile` para pegar sha/updatedAt remoto; `putFile` (com sha) grava
  `boards/<id>.json` (board portável, sem campos locais — 03 §5.2) = 1 commit; atualizar
  `index.json`. pull: ler `index.json`; puxar boards com `updatedAt` remoto > local.
- **DoD:** RF-SYNC-03/05. Editar no device A, sync; abrir device B, os boards aparecem/
  atualizam. Cada save = 1 commit no repo.

### T8.3 — Detecção de conflito (last-writer-wins com aviso)
- **Arquivos:** `sync/syncEngine.ts`, `ui/dialogs/Conflict.tsx`, `ui/SyncPanel.tsx`.
- **Passos:** antes de sobrescrever, comparar `remote.updatedAt` com
  `board.baseRemoteUpdatedAt`. Se remoto avançou → diálogo {Sobrescrever, Manter remoto,
  Cancelar}. Refletir `syncState` por board (03 §2 / RF-SYNC-06).
- **DoD:** RF-SYNC-04/06. Forçar edição concorrente em dois devices dispara o aviso; nenhuma
  sobrescrita silenciosa.

---

## Fase 9 — Compartilhamento

### T9.1 — Compartilhar via gist secreto
- **Arquivos:** `sync/share.ts`, `ui/ShareDialog.tsx`.
- **Passos:** criar gist secreto com `board-<id>.json` (board portável); montar link
  `#/s/<gistId>`; copiar para a área de transferência. Guardar `sharedGistId` no board.
- **DoD:** RF-SHARE-01.

### T9.2 — Visualizador read-only
- **Arquivos:** `ui/SharedViewer.tsx`, `sync/share.ts`.
- **Passos:** rota `#/s/<id>` faz `getGist` **sem PAT**, monta o CanvasRoot em modo leitura
  (sem toolbar/sidebar/edição; pan/zoom permitidos). Botão "Importar para mim" → novo id →
  `boardsRepo.put` na raiz.
- **DoD:** RF-SHARE-02/03. Abrir o link noutro navegador sem PAT mostra o board; importar
  cria cópia editável independente.

---

## Fase 10 — Polish (pós-v1, não bloqueia o "pronto")

- Atalhos de teclado completos (ferramentas por tecla, zoom-to-fit, duplicar Ctrl+D).
- Export PNG/SVG de um board.
- Grade de fundo opcional + snap-to-grid.
- Favicon + og.png em verde neon; título/OG tags.
- Tema claro plugado ao toggle.
- (Futuro, fora da v1) touch/mobile, rotação, roughjs, curvas de seta, multi-seleção.

---

## Checklist de "v1 pronta" (bate com 01 §7)

- [ ] 6 tipos de elemento desenháveis + select/move/resize/delete + pan/zoom fluido.
- [ ] Undo/redo cobre tudo.
- [ ] Setas grudam e acompanham shapes.
- [ ] Pastas/subpastas com CRUD + thumbnails.
- [ ] Persistência offline no IndexedDB sobrevive a reload.
- [ ] Sync entre 2 devices com aviso de conflito.
- [ ] Compartilhar por link + leitura sem PAT + importar.
- [ ] `npm run build` estático OK; **nenhum deploy/push sem OK do dono**.
