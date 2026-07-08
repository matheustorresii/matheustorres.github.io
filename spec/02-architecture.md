# 02 — Arquitetura

## 1. Stack escolhida (com justificativa curta)

| Camada | Escolha | Justificativa |
|---|---|---|
| Linguagem | **TypeScript** (strict) | Contratos explícitos reduzem erro do executor; refactor seguro. |
| UI framework | **React 18** | Ecossistema enorme, executor confiável; usado **só no chrome** (toolbar, sidebar, diálogos), **nunca no loop de canvas**. |
| Build tool | **Vite** | Dev server rápido, build estático trivial, o `deploy.yml` do repo já sabe buildar Vite. |
| Gerenciador | **npm** (workspaces já existem no repo) | Sem introduzir pnpm/yarn; consistência com o repo atual. |
| Estado de UI | **Zustand** | Store minúsculo (~1KB), previsível, menos boilerplate que Context+reducer; qualifica como "lib pequena e independente". |
| Estado de cena | **classe própria `SceneStore`** (imperativa) | O array de elementos + viewport são lidos pelo RAF loop **todo frame**, fora do React, para não causar re-render. Do zero, controle total. |
| Freehand | **perfect-freehand** | Explicitamente permitido; traço bonito é difícil de fazer bem à mão. |
| IndexedDB | **idb** (wrapper de Jake Archibald) | Wrapper minúsculo e sem dependências sobre a API crua do IndexedDB; evita a verbosidade/bugs da API nativa. Qualifica como lib pequena. |
| IDs | **nanoid** | Gerador de ID curto, sem dependências. (Alternativa aceitável: `crypto.randomUUID()` nativo — ver decisão D-07.) |
| Roteamento | **hash routing próprio** (sem lib) | GitHub Pages serve estático; hash (`#/...`) evita 404 em deep-link sem precisar de config de servidor. Simples o bastante para não precisar de react-router. |
| Rough (hand-drawn) | **roughjs** — **NÃO na v1** | Reservado; o render é abstraído para permitir plugá-lo depois sem reescrever. |

> **Fronteira crítica:** React re-renderiza quando **estado de UI** muda (trocar de board,
> abrir diálogo, mudar ferramenta). O **canvas nunca depende de re-render**: ele roda um
> loop imperativo que lê `SceneStore` diretamente. Nunca colocar o array de elementos em
> `useState`. Isto é a decisão de performance mais importante do projeto.

## 2. Estrutura de pastas do projeto

O app novo vive em **`apps/whiteboard/`** (workspace separado; não toca o `apps/web` do
fantasy antigo, que continua no ar até o OK do dono).

```
apps/whiteboard/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  public/
    favicon.ico            # gerado depois (verde neon)
  src/
    main.tsx               # bootstrap React, monta <App/>
    App.tsx                # layout raiz: roteia entre <Workspace/> e <SharedViewer/>
    router.ts              # hash router mínimo (parse/subscribe de location.hash)

    canvas/                # NÚCLEO IMPERATIVO — zero React aqui dentro
      CanvasRoot.ts        # cria <canvas>, RAF loop, dirty-flag, DPR/resize
      Renderer.ts          # desenha a cena (com culling); dispatch por tipo de elemento
      shapes/              # um módulo de desenho por tipo
        rectangle.ts
        ellipse.ts
        line.ts
        arrow.ts
        freehand.ts
        text.ts
      viewport.ts          # {scale,offsetX,offsetY}; screen<->world; zoom-to-cursor
      hitTest.ts           # teste de acerto por tipo + AABB
      selection.ts         # bounding box + alças de canto (geometria)
      binding.ts           # nearest-border point, gruda/recalcula pontas de seta
      InputController.ts   # máquina de estados de input (ver §5)
      SceneStore.ts        # elementos[], seleção, viewport; API mutável + subscribe
      geometry.ts          # utilidades: AABB, distância ponto-segmento, clamp, etc.

    commands/              # UNDO/REDO (op-log)
      Command.ts           # interface {do(), undo()}
      commands.ts          # AddElement, UpdateElement, DeleteElement, Move...
      History.ts           # pilhas undo/redo; execute(cmd)

    store/                 # ESTADO DE UI (Zustand)
      uiStore.ts           # ferramenta ativa, estilos padrão, diálogo aberto, boardId atual
      libraryStore.ts      # árvore de pastas + metadados de boards (listagem)

    persistence/           # IndexedDB
      db.ts                # abre o DB (idb), define stores e versões/migração
      boardsRepo.ts        # CRUD de boards no IndexedDB
      foldersRepo.ts       # CRUD de pastas
      settingsRepo.ts      # PAT, repo de sync, config
      thumbnails.ts        # gera PNG offscreen de um board

    sync/                  # GitHub como backend
      github.ts            # cliente REST fino (fetch + PAT); contents & gists
      syncEngine.ts        # push/pull de board, comparação sha/updatedAt, conflito
      indexFile.ts         # ler/escrever index.json remoto (árvore de pastas)
      share.ts             # criar gist secreto; resolver #/s/<id> (read-only)

    ui/                    # CHROME em React
      Workspace.tsx        # layout: Sidebar + Toolbar + host do canvas + painéis
      Sidebar.tsx          # árvore de pastas/boards; CRUD; drag pra mover
      Toolbar.tsx          # seleção de ferramenta, undo/redo, zoom
      StylePanel.tsx       # cor/espessura/opacidade/fonte do elemento/ferramenta
      SyncPanel.tsx        # status de sync, botão sync, config de PAT/repo
      ShareDialog.tsx      # gerar/copiar link de compartilhamento
      SharedViewer.tsx     # modo leitura para #/s/<id> (monta canvas read-only)
      CanvasHost.tsx       # <div> que hospeda o CanvasRoot imperativo (via ref/effect)
      dialogs/             # Rename, Confirm, MoveTo, etc.
      components/          # botões, inputs, tree-item — usando os tokens visuais

    styles/
      tokens.css           # design tokens (ver 04-visual-identity.md)
      global.css           # reset + base

    types/
      model.ts             # tipos do domínio (Element, Board, Folder, Index) — ver 03
      index.ts             # re-exports

    lib/                   # utilidades genéricas sem dependência de domínio
      debounce.ts
      id.ts                # wrapper de nanoid/randomUUID
      events.ts            # mini emitter (subscribe/notify) usado pelo SceneStore
```

**Fronteiras de módulo (regras de dependência):**
- `canvas/` **não importa** de `ui/`, `store/`, `sync/` ou React. É autocontido e
  comunica-se para fora via callbacks/eventos (`events.ts`).
- `ui/` importa de `store/`, `commands/`, `persistence/`, `sync/` e monta o `canvas/` via
  `CanvasHost.tsx`.
- `persistence/` e `sync/` não importam de `ui/` nem de `canvas/` (só de `types/`).
- `commands/` opera sobre o `SceneStore` (recebe referência); não conhece React.

## 3. Loop de render

```
CanvasRoot:
  - cria contexto 2D; ajusta canvas.width/height = cssSize * devicePixelRatio
  - mantém um dirty flag (boolean). SceneStore.notify() e viewport changes marcam dirty.
  - requestAnimationFrame(tick):
      if (dirty) { Renderer.draw(ctx, scene, viewport); dirty = false }
      requestAnimationFrame(tick)
```

Regras:
- **Um único `<canvas>`** (não um por elemento). DPR aplicado uma vez no resize.
- `Renderer.draw`:
  1. limpa; aplica `ctx.setTransform(scale,0,0,scale,offsetX,offsetY)` (mundo→tela).
  2. calcula a **AABB da viewport em world space**; itera elementos; **pula** os que não
     intersectam (culling).
  3. desenha cada elemento pelo módulo de `shapes/` correspondente.
  4. desenha overlays de seleção (bounding box + alças) por cima.
- Redesenhar **só** quando `dirty`. Interações (drag) marcam dirty a cada `pointermove`.
- **Overlay de UI** (textarea de edição de texto, alças HTML se preferir) fica em `<div>`
  posicionado por cima do canvas, convertendo world→screen a cada frame relevante.

**Coordenadas (fonte única de verdade em `viewport.ts`):**
- `worldToScreen({x,y})  = { X: x*scale + offsetX, Y: y*scale + offsetY }`
- `screenToWorld({X,Y})  = { x: (X - offsetX)/scale, y: (Y - offsetY)/scale }`
- Zoom-to-cursor: ao dar zoom, ajustar `offset` para que o ponto sob o cursor permaneça
  fixo. Fórmula documentada na tarefa correspondente em `05-roadmap.md`.

## 4. Undo/Redo — op-log (command pattern)

**Decisão (D-03):** usar **lista de operações inversíveis**, não snapshots do array inteiro.
Motivo: com boards grandes + culling, snapshot por ação custa memória/CPU; commands são
O(1) por ação, e encaixam com o histórico de commits do sync.

```
interface Command { do(scene): void; undo(scene): void; label: string }
```

Commands v1:
- `AddElement(el)` — do: push; undo: remove por id.
- `DeleteElement(el)` — do: remove; undo: reinsere na posição original (guarda o índice).
- `UpdateElement(id, before, after)` — patch de props; undo aplica `before`.
  (Move e resize produzem `UpdateElement` com as coords antes/depois — capturadas no
  `pointerdown` e no `pointerup`, gerando **um** command por gesto, não um por frame.)
- `AddText`, `UpdateText` — casos de `Add/UpdateElement` para `type: 'text'`.

`History`:
- `execute(cmd)`: `cmd.do(scene)`; empilha em `undoStack`; limpa `redoStack`.
- `undo()`: pop de `undoStack`; `cmd.undo(scene)`; empilha em `redoStack`.
- `redo()`: pop de `redoStack`; `cmd.do(scene)`; empilha em `undoStack`.
- Limite de histórico configurável (ex.: 200) para não crescer sem limite.
- Todo `execute/undo/redo` marca a cena dirty e agenda autosave (debounced).

**Regra inviolável:** **toda** mutação da cena passa por um Command. Nada de mutar
`scene.elements` direto fora de um command (exceto operações efêmeras de preview durante um
gesto, que só viram command no `pointerup`).

## 5. Máquina de estados de input (`InputController`)

Estados:
```
idle → panning
idle → drawing        (ferramenta de shape/linha/seta/freehand ativa + pointerdown)
idle → placingText    (ferramenta texto + pointerdown → abre textarea)
idle → selecting      (ferramenta seleção + pointerdown no vazio → marquee opcional*)
idle → dragging       (ferramenta seleção + pointerdown sobre elemento selecionado)
idle → resizing       (ferramenta seleção + pointerdown sobre uma alça)
qualquer → idle       (pointerup / Escape)
```
`*` Na v1 seleção é de **um elemento**; o marquee pode só destacar/selecionar o topo sob o
retângulo. Multi-seleção com transform em grupo está **fora** (ver 01 §3.2).

Eventos de entrada (desktop-only): `pointerdown/move/up`, `wheel` (zoom), `keydown`
(atalhos, Delete, Escape, Space para pan). **Não** usar multi-touch/pinch na v1.

Transições-chave (resumo; detalhe fica nas tarefas):
- **pointerdown**:
  - ferramenta = seleção → hit-test: alça? `resizing`. elemento? seleciona + `dragging`.
    vazio? limpa seleção (`selecting`/idle).
  - ferramenta = shape/linha/seta/freehand → cria elemento "em construção" e vai p/ `drawing`.
  - ferramenta = texto → cria textarea no ponto (`placingText`).
  - Space segurado (qualquer ferramenta) → `panning`.
- **pointermove**: atualiza o elemento em construção / posição do drag / tamanho do resize /
  offset do pan. Marca dirty. (Efêmero — ainda não é command.)
- **pointerup**: finaliza. `drawing` → `AddElement` command. `dragging`/`resizing` →
  `UpdateElement` command (before/after). Volta a `idle`.
- **wheel**: zoom-to-cursor (independe do estado, exceto durante gesto ativo).
- Ao mover/resize um shape com setas vinculadas: `binding.ts` recalcula as pontas ligadas
  dentro do mesmo command (as pontas fazem parte do `after`).

## 6. Fluxo de sync (visão macro; detalhe em 03 §5)

```
Editar board → SceneStore.notify() → debounce(1s) → boardsRepo.put(board) [IndexedDB]
                                                    → marca board "dirty p/ remoto"

Botão "Sync" (ou auto opcional) por board:
  1. github.getFile(boards/<id>.json) → {sha, remote.updatedAt}
  2. se remote.updatedAt > board.baseRemoteUpdatedAt  (remoto avançou desde a última base)
        → CONFLITO: diálogo {Sobrescrever, Manter remoto, Cancelar}
  3. senão (ou se dono escolheu Sobrescrever):
        github.putFile(boards/<id>.json, conteúdo, sha) → novo commit
        atualiza board.remoteSha / baseRemoteUpdatedAt
  4. atualiza index.json remoto (árvore de pastas + lista de boards).

Abrir app num device:
  - github.getFile(index.json); para cada board cujo remote.updatedAt > local.updatedAt →
    pull (getFile boards/<id>.json → boardsRepo.put). Merge da árvore de pastas.
```

Compartilhar (gist):
```
ShareDialog → github.createSecretGist({ "board-<id>.json": JSON }) → gistId
            → link https://11a3.dev/#/s/<gistId>
Abrir #/s/<id> → github.getGist(id) SEM PAT → SharedViewer (read-only)
              → "Importar para mim" → boardsRepo.put(cópia com novo id, folder=root)
```

## 7. Roteamento

Hash-based, sem lib:
- `#/`               → Workspace (listagem + último board aberto).
- `#/b/<boardId>`    → Workspace com esse board aberto.
- `#/s/<gistId>`     → SharedViewer (modo leitura).
- `router.ts` expõe `getRoute()` e `onRouteChange(cb)` (ouve `hashchange`).
- `App.tsx` decide entre `<Workspace/>` e `<SharedViewer/>` pela rota.

> Hash routing é escolhido porque GitHub Pages não tem rewrite de servidor; deep links com
> path (`/b/123`) dariam 404 no reload. O `404.html` do deploy antigo é um fallback de SPA,
> mas hash é mais robusto e simples aqui.

## 8. Build & deploy (referência — NÃO executar sem OK)

- `vite.config.ts` usa `base` relativo/compatível com `11a3.dev` (raiz, pois há CNAME).
- O `.github/workflows/deploy.yml` atual buda `apps/web`. Quando (e só quando) o dono
  autorizar a virada, o workflow será apontado para `apps/whiteboard` — **isso é uma tarefa
  futura explícita, fora da v1 de desenvolvimento**, e não acontece sem o OK.
