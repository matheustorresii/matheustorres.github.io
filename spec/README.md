# 11A3 — Whiteboard/Diagramas · Especificação (SDD)

> **Status:** Planejamento (Fase de specs). **Nenhum código de app foi escrito ainda.**
> **Produto:** app de quadro branco / diagramas estilo Excalidraw, 100% estático,
> reaproveitando **apenas o nome `11A3`** do projeto anterior. Identidade visual nova
> (verde neon `#acd52c`). Deploy futuro em GitHub Pages / `11a3.dev`.

---

## Como usar estes documentos (para o executor)

Estes specs foram escritos por um planejador (Opus 4.8) para serem executados por um
modelo mais fraco (Sonnet ou inferior). **A regra de ouro é: zero ambiguidade.** Se algo
neste plano parecer ambíguo durante a execução, **NÃO invente** — pare e sinalize. Cada
decisão relevante já foi tomada e está registrada. O executor deve:

1. Ler **todos** os documentos na ordem numérica antes de começar.
2. Executar **uma tarefa por vez**, na ordem de `05-roadmap.md`.
3. Só marcar uma tarefa como concluída quando o **critério de aceite (DoD)** dela passar.
4. Nunca fazer `git push` na branch `main` sem autorização explícita do dono
   (ver "Regras invioláveis" abaixo).

## Índice dos documentos

| Arquivo | Conteúdo |
|---|---|
| `01-requirements.md` | Visão, escopo (in/out), personas, user stories, requisitos funcionais e não-funcionais, critérios de aceite globais. **O quê e o porquê.** |
| `02-architecture.md` | Stack + justificativa, estrutura de pastas, fronteiras de módulos, loop de render, máquina de estados de input, undo/redo, fluxo de sync. **O como técnico.** |
| `03-data-model.md` | Schemas (elemento, board, pasta, índice), serialização IndexedDB, formato JSON no GitHub, versionamento/migração. **Os contratos de dados.** |
| `04-visual-identity.md` | Paleta verde neon, design tokens, tipografia, logo, componentes base. |
| `05-roadmap.md` | Roadmap incremental em fases + tarefas atômicas com DoD. **O que o executor segue linha a linha.** |
| `06-risks-and-decisions.md` | Riscos técnicos + mitigação, e o **log de decisões** (o que foi decidido e por quê). |

## Regras invioláveis (do dono do projeto)

- **NÃO fazer deploy.** O site antigo (fantasy de Valorant) precisa continuar no ar em
  `11a3.dev` até o dono testar o novo e dar o OK explícito.
- O deploy dispara em **push na branch `main`** (`.github/workflows/deploy.yml`).
  Portanto: **commits locais são permitidos**, mas **NÃO dar push na `main`**.
  Enquanto o projeto estiver em construção, trabalhar em branch separada
  (`whiteboard`) ou só commitar local.
- Reaproveitar do projeto antigo: **apenas o nome `11A3`**. Nada de código, layout,
  paleta ou assets do fantasy.

## Glossário

- **Board / quadro** — um documento de desenho (uma tela infinita com elementos).
- **Elemento** — uma primitiva desenhável (retângulo, elipse, linha, seta, freehand, texto).
- **Cena (scene)** — o conjunto {elementos + viewport + seleção} de um board aberto.
- **Viewport** — a transformação câmera→tela: `{ scale, offsetX, offsetY }`.
- **World space** — coordenadas do board (infinitas). **Screen space** — pixels da tela.
- **Culling** — pular do render os elementos fora da viewport.
- **Binding** — vínculo de uma ponta de seta a um shape (`boundTo: idDoShape`).
- **Op-log / command** — operação inversível (do/undo) usada para undo/redo.
- **PAT** — Personal Access Token do GitHub, usado para autenticar o sync.
- **DoD** — Definition of Done: critério objetivo de conclusão de uma tarefa.
