# 06 — Riscos, mitigações e log de decisões

## Parte A — Riscos técnicos e mitigação

### R-01 — Performance do canvas com muitos elementos
- **Risco:** redesenhar tudo todo frame trava com centenas/milhares de elementos.
- **Mitigação (já no design):** **dirty-flag** (só redesenha quando muda) + **culling** por
  AABB de viewport. Um único `<canvas>`. Se ainda faltar perf com >5k elementos, adicionar
  um **spatial hash / grid** para hit-test e culling (reservado; não v1). Não usar
  React para o array de elementos (evita re-render).

### R-02 — Nitidez em telas HiDPI / DPR
- **Risco:** canvas borrado em telas retina.
- **Mitigação:** dimensionar `canvas.width/height = cssSize * devicePixelRatio` e escalar o
  contexto; refazer no `resize` e em mudança de DPR. Coberto por T1.2.

### R-03 — Matemática de coordenadas (screen↔world) com bugs
- **Risco:** off-by-scale/offset causam seleção/desenho no lugar errado, pior sob zoom.
- **Mitigação:** **uma única** fonte de conversão em `viewport.ts`, com testes unitários
  (T1.1). Nunca duplicar a fórmula em outro módulo. Overlays (textarea) usam sempre
  `worldToScreen`.

### R-04 — Alinhamento do textarea de edição de texto sob zoom
- **Risco:** o `<textarea>` HTML não bate com o texto renderizado no canvas em zoom != 100%.
- **Mitigação:** posicionar o textarea via `worldToScreen` e aplicar `transform: scale()`
  = viewport.scale; usar a mesma fonte/tamanho. Testar em 50% e 200%.

### R-05 — Segurança do PAT no navegador
- **Risco:** o PAT fica em texto claro no IndexedDB; XSS ou device compartilhado o expõe.
- **Mitigação:** (1) app é estático e self-hosted (sem terceiros injetando script); manter
  dependências mínimas e confiáveis. (2) Recomendar **fine-grained PAT** com escopo mínimo:
  Contents R/W **só** no repo de sync + permissão de Gists. (3) Botão "esquecer token neste
  device" que apaga do IndexedDB. (4) Documentar o trade-off para o dono. **Aceito
  conscientemente** — é uso pessoal, sem servidor por design.

### R-06 — Rate limit / erros da API do GitHub
- **Risco:** falhas de rede, 409 (sha desatualizado), 5000 req/h.
- **Mitigação:** sync é **sob demanda/debounced**, não por keystroke → volume baixo.
  Tratar 409 como "remoto avançou" → fluxo de conflito (T8.3). Backoff em 403/rate-limit.
  Mensagens de erro claras no SyncPanel.

### R-07 — Evição do IndexedDB pelo navegador
- **Risco:** navegador limpa storage sob pressão de disco → perda de boards não
  sincronizados.
- **Mitigação:** `navigator.storage.persist()` na 1ª execução; avisar o dono para
  sincronizar com o GitHub (que é o backup real). O local é cache-first, não o único lar.

### R-08 — Conflito last-writer-wins pode perder trabalho
- **Risco:** sobrescrever a versão do outro device.
- **Mitigação:** **aviso obrigatório** antes de sobrescrever quando o remoto avançou
  (RF-SYNC-04); commits preservam o histórico (dá para recuperar no GitHub). Merge
  automático de conteúdo está fora de escopo (decisão consciente).

### R-09 — Complexidade da máquina de estados de input
- **Risco:** estados de input (drag/resize/draw/pan/text) se misturam e geram bugs.
- **Mitigação:** `InputController` com estados **explícitos** e transições documentadas
  (02 §5); um estado ativo por vez; `Escape` sempre volta a `idle`. Desktop-only reduz a
  superfície (sem multi-touch).

### R-10 — Interação binding × undo/redo
- **Risco:** desfazer um move deixa a seta "presa" numa posição inconsistente.
- **Mitigação:** o recálculo das pontas ligadas faz parte do **mesmo** `UpdateElement`
  (before/after incluem as pontas). Undo reverte posição e binding atomicamente (T5.2).

### R-11 — Escopo inflar ("só mais uma feature")
- **Risco:** o app nunca fica "pronto".
- **Mitigação:** cortes explícitos em `01 §3.2`; campos reservados no modelo evitam
  refactor. Roadmap fatiado em fases usáveis. Qualquer feature nova vira item da Fase 10+.

### R-12 — Deploy acidental derruba o site antigo
- **Risco:** um `git push origin main` publica o whiteboard incompleto sobre o fantasy.
- **Mitigação:** **regra inviolável** (README): sem push na `main` até o OK. Trabalhar em
  branch `whiteboard`. A virada do `deploy.yml` para `apps/whiteboard` é uma tarefa
  **futura e explícita**, nunca automática.

## Parte B — Log de decisões (Decision Log)

Cada decisão com contexto e razão. IDs referenciados nos outros docs.

- **D-01 — Stack: React + Vite + TS.** UI em React (chrome), canvas imperativo fora do
  React. Motivo: confiabilidade do executor + deploy Vite já suportado. (02 §1)
- **D-02 — Desktop-only na v1.** Sem touch/pinch. Motivo: enxugar a máquina de estados e
  garantir a "sensação boa" no desktop primeiro. (01 §3.2)
- **D-03 — Undo/redo por op-log (commands), não snapshots.** Motivo: O(1) por ação, casa
  com histórico de commits, escala melhor. (02 §4)
- **D-04 — GitHub como backend: repo privado para sync pessoal + gist secreto para
  compartilhar.** Resolve "quero que seja só meu" **e** "quero mandar para um amigo" sem
  colaboradores/PAT para os amigos. Cap informal ~10 pessoas (produto, não técnico). (01 §3)
- **D-05 — Layout remoto plano (`boards/<id>.json` + `index.json`).** Motivo: mover board
  entre pastas não renomeia arquivo (menos chamadas/churn). Pastas são metadados no
  `index.json`. (03 §5.2)
- **D-06 — Thumbnail não sincroniza (fica só local).** Motivo: peso no JSON remoto;
  thumbnail é regenerável. Revisável se o dono quiser previews entre devices. (03 §5.2)
- **D-07 — IDs via `nanoid`** (ou `crypto.randomUUID()` nativo, à escolha na execução).
  Ambos opacos e suficientes. (03 §7)
- **D-08 — Texto simples entra na v1** (não rico). Motivo: whiteboard sem texto frustra;
  rich text é complexidade grande. (01 §3.1)
- **D-09 — Estado de cena fora do React** (`SceneStore` imperativo lido pelo RAF loop).
  Motivo: performance — evitar re-render por frame. (02 §1)
- **D-10 — Hash routing próprio** (sem react-router). Motivo: deep-link sem 404 em GitHub
  Pages, e escopo mínimo. (02 §7)
- **D-11 — Libs permitidas:** `perfect-freehand`, `idb`, `zustand`, `nanoid`
  (todas pequenas/independentes). `roughjs` só pós-v1. O render é abstraído para plugá-lo
  depois. (02 §1, 01 §3.2)

## Parte C — Perguntas em aberto (para o dono decidir quando quiser)

Nenhuma bloqueia o início da execução. Todas têm um **default** já registrado:

- **Q-01 — Fontes: Google Fonts ou self-host?** Default: Google Fonts (simples). Self-host é
  mais "estático puro" e privado — trocar é barato depois.
- **Q-02 — Auto-sync ou sync manual por botão?** Default: **manual/debounced sob demanda**
  (menos commits, menos rate-limit). Auto pode ser um toggle no SyncPanel depois.
- **Q-03 — Thumbnails sincronizados entre devices?** Default: **não** (D-06). Reabrir se o
  dono quiser previews idênticos em todo device.
- **Q-04 — Cap de 10 compartilhamentos é trava dura ou só aviso?** Default: **aviso**
  (sem trava técnica).
