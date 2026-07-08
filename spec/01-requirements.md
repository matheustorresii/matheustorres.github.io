# 01 — Requisitos

## 1. Visão

Um app de **quadro branco / diagramas** (estilo Excalidraw), construído do zero, que roda
**inteiramente no navegador** e é hospedado **estaticamente** (GitHub Pages, `11a3.dev`).
Uso primário: **pessoal** (o dono), com capacidade de **compartilhar boards individuais**
em modo leitura com poucos amigos. A funcionalidade que mais importa é **organização de
boards em pastas e subpastas** — algo que é pago no Excalidraw Plus.

**Princípios de produto:**
- Local-first: funciona offline; a nuvem é sync, não dependência.
- Simplicidade e performance acima de completude de features.
- Controle total do código: sem clonar Excalidraw; libs só pequenas e pontuais.

## 2. Personas

- **Dono (primário)** — usa em múltiplos dispositivos (desktop). Quer desenhar rápido,
  organizar em pastas, e ter os boards sincronizados entre seus devices sem servidor.
- **Amigo convidado (secundário, ~até 10 pessoas)** — recebe um link de um board
  específico, abre em modo **somente leitura**, sem precisar de conta ou token. Pode,
  opcionalmente, **importar** uma cópia para o próprio armazenamento local.

## 3. Escopo

### 3.1 Dentro da v1 (MUST)

**Canvas e elementos:**
- Elementos: **retângulo, elipse, linha, seta, desenho livre (freehand), texto simples**.
- Selecionar, mover, redimensionar (pelos cantos), deletar.
- Pan e zoom performáticos (zoom para o cursor).
- Undo/redo.
- Seta com **binding simplificado**: quando a ponta chega perto de um shape, gruda no
  ponto da borda mais próximo e guarda `boundTo`; ao mover o shape, a ponta recalcula.

**Organização (prioridade máxima):**
- Pastas e subpastas de boards (aninhamento arbitrário).
- CRUD de boards e pastas: criar, renomear, mover, duplicar, deletar.
- Thumbnail/preview de cada board na listagem.

**Persistência e sync:**
- Persistência local no navegador via **IndexedDB** (não localStorage).
- Sync entre devices do dono usando a **API do GitHub** como backend:
  boards salvos como JSON num **repositório privado do dono**, autenticado por um **PAT**
  colado uma vez por device (guardado no IndexedDB).
- Cada save remoto = **um commit** (histórico de versões de graça).
- Conflito: **last-writer-wins**, mas **avisando** quando existe versão mais nova no
  remoto antes de sobrescrever.

**Compartilhamento (leve):**
- Compartilhar um board via **gist secreto** → link `11a3.dev/#/s/<gistId>`.
- Amigo abre em **somente leitura**, sem conta/PAT. Opção "importar para mim".

### 3.2 Fora da v1 (WON'T — cortado de propósito)

- Colaboração em tempo real / multiusuário simultâneo.
- Edição em **touch/mobile** (a v1 é **desktop-only**: mouse + teclado). Abrir/visualizar
  no celular pode funcionar, mas editar bem é só no desktop.
- **Rotação** de elementos.
- **Texto rico** (negrito/itálico/multi-estilo). Só texto simples de uma fonte/cor/tamanho.
- **Curvas** nas setas (setas são retas/segmentos).
- **Multi-seleção com transformação em grupo.** (Seleção é de um elemento por vez na v1;
  ver RF-CANVAS-06 para o comportamento exato.)
- Estilo de traço **"hand-drawn"** (roughjs) — reservado para depois.
- Servidor próprio, WebSocket, backend Node, banco hospedado.

> **Nota sobre estas exclusões:** o modelo de dados deve **reservar espaço** para elas
> (ex.: campo `rotation`, `seed`) sem implementá-las, para evitar migração dolorosa depois.
> Ver `03-data-model.md`.

## 4. User stories

Formato: `Como <persona>, quero <ação>, para <benefício>`.

**Canvas:**
- US-01 — Como dono, quero desenhar um retângulo arrastando o mouse, para esboçar caixas.
- US-02 — Como dono, quero selecionar um elemento clicando nele, para editá-lo.
- US-03 — Como dono, quero mover um elemento selecionado arrastando, para reposicioná-lo.
- US-04 — Como dono, quero redimensionar um elemento pelos cantos, para ajustar o tamanho.
- US-05 — Como dono, quero deletar o elemento selecionado com Delete/Backspace.
- US-06 — Como dono, quero dar pan (espaço+arrastar ou botão do meio) e zoom (scroll),
  para navegar por um board grande sem travar.
- US-07 — Como dono, quero desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z), para corrigir erros.
- US-08 — Como dono, quero desenhar seta que gruda num shape, para conectar caixas; ao
  mover a caixa, a seta acompanha.
- US-09 — Como dono, quero escrever texto no board, para rotular partes do diagrama.

**Organização:**
- US-10 — Como dono, quero criar/renomear/mover/duplicar/deletar boards, para gerenciá-los.
- US-11 — Como dono, quero criar pastas e subpastas e mover boards entre elas, para
  organizar por assunto.
- US-12 — Como dono, quero ver um thumbnail de cada board na listagem, para reconhecê-los.

**Sync e compartilhamento:**
- US-13 — Como dono, quero colar meu PAT uma vez por device, para sincronizar meus boards.
- US-14 — Como dono, quero que cada save gere um commit no meu repo privado, para ter
  histórico.
- US-15 — Como dono, quero ser avisado quando o remoto tem versão mais nova antes de
  sobrescrever, para não perder trabalho por acidente.
- US-16 — Como dono, quero gerar um link de leitura de um board, para mandar a um amigo.
- US-17 — Como amigo, quero abrir esse link sem login e ver o board, e opcionalmente
  importar uma cópia para editar do meu lado.

## 5. Requisitos funcionais (RF)

> Cada RF é testável. IDs são referenciados pelas tarefas em `05-roadmap.md`.

### Canvas
- **RF-CANVAS-01** — O canvas ocupa a área útil da janela e re-escala em `resize`,
  respeitando `devicePixelRatio` (sem borrado em telas HiDPI).
- **RF-CANVAS-02** — Render via `requestAnimationFrame`, **redesenhando só quando há
  mudança** (dirty flag). Em repouso, uso de CPU ≈ 0.
- **RF-CANVAS-03** — **Culling**: elementos cujo AABB não intersecta a viewport não são
  desenhados.
- **RF-CANVAS-04** — Pan e zoom: zoom com scroll centrado no cursor; escala limitada
  (`0.05`–`64`); pan por barra de espaço+arrastar ou botão do meio do mouse.
- **RF-CANVAS-05** — Ferramentas de desenho: retângulo, elipse, linha, seta, freehand,
  texto. Uma ferramenta ativa por vez, selecionável por toolbar e por atalho de teclado.
- **RF-CANVAS-06** — Seleção: clicar num elemento o seleciona (um por vez); clicar no vazio
  limpa a seleção. Elemento selecionado mostra bounding box com 4 alças de canto.
- **RF-CANVAS-07** — Mover: arrastar um elemento selecionado o move. Redimensionar:
  arrastar uma alça de canto reescala mantendo o canto oposto fixo.
- **RF-CANVAS-08** — Deletar: Delete/Backspace remove o elemento selecionado.
- **RF-CANVAS-09** — Undo/redo cobre **todas** as mutações de cena (add, update, delete,
  move, resize) via op-log. Atalhos Ctrl+Z / Ctrl+Shift+Z (e Cmd no macOS).
- **RF-CANVAS-10** — Binding de seta: ao soltar/mover a ponta de uma seta a ≤ `THRESHOLD`
  px (world) de um shape, a ponta gruda no ponto da borda mais próximo e grava `boundTo`.
  Ao mover/redimensionar o shape vinculado, as pontas ligadas recalculam.
- **RF-CANVAS-11** — Texto: clicar com a ferramenta de texto abre um `<textarea>` flutuante
  alinhado ao ponto no board (posição/tamanho corretos em qualquer zoom); ao confirmar,
  vira um elemento `text`.
- **RF-CANVAS-12** — Painel de estilo do elemento selecionado (ou dos padrões da
  ferramenta): cor de traço, cor de preenchimento, espessura, opacidade, tamanho de fonte.

### Organização
- **RF-ORG-01** — Listagem de boards e pastas em árvore (sidebar), com o board aberto
  destacado.
- **RF-ORG-02** — Criar board (em uma pasta ou na raiz), renomear, duplicar, deletar,
  mover para outra pasta.
- **RF-ORG-03** — Criar pasta/subpasta (aninhamento arbitrário), renomear, mover, deletar.
  Deletar pasta pede confirmação e explica o destino do conteúdo (ver RF-ORG-04).
- **RF-ORG-04** — Deletar uma pasta **move seu conteúdo para a raiz** por padrão (não
  deleta boards em cascata sem aviso). A UI deve deixar isso explícito.
- **RF-ORG-05** — Cada board tem um **thumbnail** PNG pequeno, atualizado ao salvar,
  exibido na listagem.

### Persistência / Sync
- **RF-SYNC-01** — Todo board é persistido localmente no **IndexedDB**, com autosave
  debounced (≤ 1s após parar de editar). Funciona offline.
- **RF-SYNC-02** — Configuração de sync: o dono cola um **PAT** e informa o **repo**
  (`owner/repo`) uma vez por device; ambos ficam no IndexedDB (store `settings`).
- **RF-SYNC-03** — Push de um board: grava/atualiza `boards/<id>.json` no repo via API de
  Contents, gerando **um commit**. Atualiza `index.json`.
- **RF-SYNC-04** — Antes de sobrescrever, o app compara `updatedAt`/`sha` local x remoto.
  Se o remoto for mais novo que a base conhecida localmente → **avisa** e oferece
  {Sobrescrever, Manter remoto, Cancelar}. (Last-writer-wins **com aviso**.)
- **RF-SYNC-05** — Pull: ao abrir o app/entrar num device, busca `index.json` e traz
  boards cujo `updatedAt` remoto seja mais novo que o local.
- **RF-SYNC-06** — Estado de sync visível por board: {local-only, sincronizado, remoto mais
  novo, conflito, offline}.

### Compartilhamento
- **RF-SHARE-01** — "Compartilhar board" cria um **gist secreto** com o JSON do board e
  gera um link `https://11a3.dev/#/s/<gistId>`.
- **RF-SHARE-02** — Abrir `#/s/<gistId>` carrega o board em **modo leitura** (sem
  ferramentas de edição, sem sidebar de organização), buscando o gist **sem PAT**.
- **RF-SHARE-03** — No modo leitura há botão "Importar para mim": clona o board para o
  IndexedDB local do visitante (na raiz), virando um board editável **independente**.
- **RF-SHARE-04** — (Cap de produto, opcional) a UI pode limitar o número de boards
  compartilhados ativos; alvo informal ~10. Não é uma trava técnica.

## 6. Requisitos não-funcionais (RNF)

- **RNF-PERF-01** — Com **1.000 elementos** num board, pan/zoom deve manter ~60fps em
  desktop moderno (graças a culling + dirty-flag). Meta de fluidez, verificada
  manualmente com um board de stress.
- **RNF-PERF-02** — Em repouso (sem interação) o app não redesenha o canvas.
- **RNF-STATIC-01** — Build gera **apenas** assets estáticos (HTML/CSS/JS) publicáveis em
  GitHub Pages. Sem nenhum processo de servidor.
- **RNF-OFFLINE-01** — Todas as operações de canvas e organização funcionam **offline**;
  só o sync/compartilhamento exige rede.
- **RNF-SEC-01** — O PAT é armazenado **apenas** no IndexedDB local do device, nunca
  enviado a lugar nenhum além da própria API do GitHub. Recomendar token **fine-grained**
  com escopo mínimo (Contents R/W no repo de sync; Gists para compartilhar). Ver riscos.
- **RNF-BROWSER-01** — Alvo: navegadores desktop evergreen (Chrome/Edge/Firefox/Safari
  recentes). Sem suporte a IE.
- **RNF-A11Y-01** — UI chrome (toolbar, diálogos, sidebar) navegável por teclado e com
  foco visível. (O canvas em si é ponteiro-primário; não é meta de a11y na v1.)
- **RNF-I18N-01** — Idioma padrão **pt-BR**. Estrutura de strings centralizada para
  permitir en depois (não obrigatório na v1).

## 7. Critérios de aceite globais

O produto v1 é considerado "pronto" quando:
1. Dá para criar um board, desenhar os 6 tipos de elemento, selecionar/mover/resize/deletar,
   dar pan/zoom fluido, e desfazer/refazer qualquer ação.
2. Setas grudam em shapes e acompanham quando o shape se move.
3. Dá para organizar boards em pastas/subpastas com CRUD completo e ver thumbnails.
4. Tudo persiste offline no IndexedDB e sobrevive a reload.
5. Com um PAT válido, boards sincronizam entre dois devices do dono, com aviso de conflito.
6. Um board pode ser compartilhado por link e aberto em leitura por alguém sem PAT.
7. `npm run build` gera assets estáticos; nenhum push/deploy foi feito sem OK do dono.
