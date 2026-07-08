# 03 — Modelo de dados

> Estes são **contratos**, não implementação. O executor deve reproduzir estes tipos
> exatamente em `src/types/model.ts`. Comentários explicam invariantes. Unidades de
> coordenada são sempre **world space** (não pixels de tela), salvo indicação contrária.

## 1. Elemento

Um único tipo discriminado por `type`. Campos comuns a todos + campos específicos.

```ts
// Identificadores e versões são strings; coordenadas são números em world space.
export type ElementType =
  | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text';

export interface BaseElement {
  id: string;              // nanoid; único dentro do board
  type: ElementType;
  x: number;               // canto superior-esquerdo do AABB (world)
  y: number;
  w: number;               // largura do AABB (>= 0). Para line/arrow/freehand é derivado
  h: number;               // altura do AABB  (>= 0). dos points, mas mantido em cache.
  rotation: number;        // RESERVADO. Sempre 0 na v1 (rotação está fora de escopo).
  strokeColor: string;     // hex, ex. "#acd52c"
  fillColor: string;       // hex ou "transparent"
  strokeWidth: number;     // px em world space (multiplicado por scale no render)
  opacity: number;         // 0..1
  zIndex: number;          // ordem de desenho; maior = na frente
  seed: number;            // RESERVADO para roughjs (hand-drawn). v1 pode gravar 1.
  createdAt: number;       // epoch ms
  updatedAt: number;       // epoch ms
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
}

// Line e Arrow guardam pontos RELATIVOS a (x,y). points[0] = {0,0} por convenção.
// v1: line/arrow têm exatamente 2 pontos (retos). Múltiplos pontos ficam reservados.
export interface LinePoint { x: number; y: number } // relativo a (element.x, element.y)

export interface LineElement extends BaseElement {
  type: 'line';
  points: LinePoint[];     // >= 2; v1 usa 2
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  points: LinePoint[];     // >= 2; v1 usa 2 (início, fim)
  boundStart?: Binding;    // vínculo da PRIMEIRA ponta a um shape, se houver
  boundEnd?: Binding;      // vínculo da ÚLTIMA ponta a um shape, se houver
}

export interface Binding {
  elementId: string;       // id do shape ao qual a ponta está grudada
  // ponto de ancoragem normalizado na AABB do alvo (0..1 em cada eixo), recalculado
  // p/ a borda mais próxima quando o alvo se move. Ver 02 §5 e binding.ts.
  focusX: number;          // 0..1
  focusY: number;          // 0..1
  gap: number;             // folga em world units entre a ponta e a borda (>= 0)
}

// Freehand: pontos capturados do traço, relativos a (x,y). Renderizado com perfect-freehand.
export interface FreehandElement extends BaseElement {
  type: 'freehand';
  points: LinePoint[];         // caminho bruto (input)
  pressures?: number[];        // opcional; se ausente, pressão constante
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;                // conteúdo literal (com \n)
  fontSize: number;            // px em world space
  fontFamily: string;          // ex. "Inter" (uma só na v1)
  // w/h derivam da medição do texto ao editar; guardados em cache no elemento.
}

export type Element =
  | RectangleElement | EllipseElement | LineElement
  | ArrowElement | FreehandElement | TextElement;
```

**Invariantes:**
- `w >= 0` e `h >= 0`. Ao redimensionar cruzando o eixo, normalizar (trocar cantos) para
  manter positivos; a lógica de resize cuida disso.
- Para `line`/`arrow`/`freehand`, `x,y,w,h` = AABB dos `points` (recalculado ao editar).
- `points` são **relativos** a `(x,y)`. Mover o elemento só muda `x,y` (não os points).
- `boundStart/boundEnd` só existem em `arrow`. Ao mover o shape alvo, a ponta ligada é
  recomputada a partir de `focus*` + `gap` sobre a nova AABB do alvo.
- `zIndex` define a ordem; ao adicionar, usar `max(zIndex)+1`.

## 2. Board

```ts
export interface Board {
  id: string;                 // nanoid
  name: string;
  folderId: string | null;    // null = raiz
  elements: Element[];
  appState: BoardAppState;    // viewport salvo, estilos padrão do board
  thumbnailDataUrl?: string;  // PNG pequeno (data URL), atualizado ao salvar
  createdAt: number;
  updatedAt: number;          // epoch ms; base para comparação de conflito
  schemaVersion: number;      // ver §6 (migração). v1 = 1
  // ---- metadados de sync (só locais; NÃO vão no JSON compartilhado) ----
  remoteSha?: string;             // sha do blob no GitHub da última sincronização
  baseRemoteUpdatedAt?: number;   // updatedAt remoto conhecido na última base
  syncState?: 'local-only' | 'synced' | 'remote-newer' | 'conflict' | 'offline';
  sharedGistId?: string;          // se compartilhado, id do gist
}

export interface BoardAppState {
  viewport: { scale: number; offsetX: number; offsetY: number };
  defaults: StyleDefaults;    // últimos estilos usados neste board
}

export interface StyleDefaults {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
}
```

## 3. Pasta (Folder)

```ts
export interface Folder {
  id: string;                 // nanoid
  name: string;
  parentId: string | null;    // null = raiz; aninhamento arbitrário
  order: number;              // ordenação entre irmãos
  createdAt: number;
  updatedAt: number;
}
```

**Regras:**
- Aninhamento arbitrário via `parentId`. Proibir ciclos (mover uma pasta para dentro de si
  mesma ou de um descendente é bloqueado pela UI — ver tarefa de "mover pasta").
- Deletar pasta: por padrão **reparenteia** boards e subpastas filhas para a raiz
  (`folderId=null` / `parentId=null`), **não** deleta em cascata sem aviso (RF-ORG-04).

## 4. Índice de biblioteca (listagem)

Usado pela sidebar sem precisar carregar todos os boards inteiros. Deriva de folders +
metadados de boards.

```ts
export interface BoardMeta {
  id: string;
  name: string;
  folderId: string | null;
  updatedAt: number;
  thumbnailDataUrl?: string;   // opcional; pode ser carregado sob demanda
}

export interface LibraryIndex {
  folders: Folder[];
  boards: BoardMeta[];         // metadados leves (sem elements)
}
```

## 5. Serialização

### 5.1 IndexedDB (local)

DB `whiteboard` (via `idb`). **Object stores:**

| Store | keyPath | Conteúdo | Índices |
|---|---|---|---|
| `boards` | `id` | `Board` completo (com `elements`, `thumbnailDataUrl`) | `by-folder` (folderId), `by-updatedAt` |
| `folders` | `id` | `Folder` | `by-parent` (parentId) |
| `settings` | `key` | pares `{key, value}`: PAT, repo de sync, config, flags | — |

- Autosave: `boardsRepo.put(board)` no store `boards` (debounced ≤ 1s após parar de editar).
- A listagem (LibraryIndex) é **derivada** lendo `folders` (todos) + `boards` (projeção dos
  metadados). Não há store separado de índice local.
- `settings` guarda: `github.pat`, `github.repo` (`"owner/repo"`), `github.branch`
  (default `"main"`), `ui.lastBoardId`, `ui.lang`, etc.
- Pedir **persistent storage** (`navigator.storage.persist()`) na primeira execução para
  reduzir risco de evição (ver riscos).

### 5.2 JSON no GitHub (repo privado do dono)

Layout **plano** (decisão D-05 — evita churn de arquivo ao mover board entre pastas):

```
<repo-privado>/
  index.json                 # árvore de pastas + lista de boards (metadados)
  boards/
    <boardId>.json           # um board por arquivo (sem metadados de sync locais)
```

**`boards/<id>.json`** — o board **portável** (campos locais de sync são removidos):
```jsonc
{
  "schemaVersion": 1,
  "id": "…",
  "name": "…",
  "folderId": "… | null",
  "elements": [ /* Element[] */ ],
  "appState": { "viewport": {…}, "defaults": {…} },
  "createdAt": 0,
  "updatedAt": 0
  // NÃO inclui: thumbnailDataUrl, remoteSha, baseRemoteUpdatedAt, syncState, sharedGistId
}
```
> O thumbnail **não** vai para o JSON remoto (peso); é regenerável localmente. (Decisão
> D-06; pode ser revisto se o dono quiser thumbnails sincronizados.)

**`index.json`** — árvore + metadados, para reconciliar entre devices:
```jsonc
{
  "schemaVersion": 1,
  "updatedAt": 0,
  "folders": [ { "id": "…", "name": "…", "parentId": null, "order": 0,
                 "createdAt": 0, "updatedAt": 0 } ],
  "boards":  [ { "id": "…", "name": "…", "folderId": null, "updatedAt": 0,
                 "path": "boards/<id>.json" } ]
}
```

**Mover board entre pastas** = atualizar `folderId` no `boards/<id>.json` **e** no
`index.json`. Nenhum arquivo é renomeado/movido (layout plano). Cada operação = commit.

### 5.3 Gist de compartilhamento (leitura)

Um **gist secreto** com um arquivo `board-<id>.json` = o board portável (§5.2), **mais**
os assets embutidos que ele precisa para renderizar sozinho (na v1, nenhum asset externo —
tudo é vetorial/texto). O `SharedViewer` faz `GET /gists/<id>` **sem PAT** e renderiza
read-only. "Importar para mim" gera um **novo id** e grava no IndexedDB do visitante.

## 6. Versionamento e migração

- Todo board e o `index.json` carregam `schemaVersion` (v1 = **1**).
- `persistence/db.ts` centraliza migração: ao carregar um board com `schemaVersion < atual`,
  aplicar migrações em cadeia (`migrateV1toV2`, …) antes de usar.
- Campos **reservados** (`rotation`, `seed`, `points` com >2 pontos, `pressures`) já existem
  para que features futuras (rotação, hand-drawn, curvas) **não** exijam bump destrutivo.
- Regra: **nunca** remover/renomear um campo sem uma migração correspondente.

## 7. Geração de IDs

- `lib/id.ts` expõe `newId()`. Implementação v1: `nanoid()` (ou `crypto.randomUUID()` —
  decisão D-07). IDs são opacos; nunca derivar significado deles.
