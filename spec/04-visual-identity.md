# 04 — Identidade visual

Reaproveita **apenas o nome `11A3`**. Visual 100% novo: **verde neon sobre fundo escuro**,
estética limpa e técnica (combina com um app de diagramas). Dark-first; um tema claro é
opcional (tokens já preparados, mas não obrigatório na v1).

## 1. Cor de marca

- **Accent (neon):** `#acd52c` — verde-limão neon. É a cor da marca e das ações primárias.
- **Accent-hover:** `#bde23a` (levemente mais claro).
- **Accent-press:** `#95bb1f` (levemente mais escuro).
- **Accent-ink** (texto/ícone **sobre** o accent): `#0d0f0a` (quase preto). Nunca texto
  branco sobre o neon — contraste ruim.

## 2. Paleta (tokens) — tema escuro (default)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0d0f0a` | fundo da app / do canvas |
| `--bg-canvas` | `#0f120b` | fundo da área de desenho (levemente distinto do chrome) |
| `--panel` | `#15180f` | painéis, sidebar, toolbar |
| `--panel-2` | `#1c2015` | inputs, itens de lista, estados hover sutis |
| `--line` | `#2a2f1e` | bordas/divisores discretos |
| `--line-strong` | `#3b4327` | bordas de destaque, contorno de controles |
| `--text` | `#e8ecd9` | texto primário (off-white esverdeado) |
| `--muted` | `#9aa583` | texto secundário / labels |
| `--accent` | `#acd52c` | marca, ferramenta ativa, ações primárias |
| `--accent-ink` | `#0d0f0a` | texto/ícone sobre accent |
| `--danger` | `#ff5c5c` | deletar / conflito |
| `--warning` | `#f0b429` | aviso (ex.: remoto mais novo) |
| `--selection` | `#acd52c` | bounding box e alças de seleção no canvas |
| `--grid` | `#1a1e12` | (opcional) grade de fundo do canvas |

**Tema claro (opcional, tokens de referência):**
`--bg #f3f5ea`, `--panel #ffffff`, `--panel-2 #eef1e2`, `--line #dfe4cf`,
`--text #1b1e12`, `--muted #5c6347`, `--accent #7ba50f` (neon puro fica ilegível em fundo
claro; escurecer para AA), `--accent-ink #ffffff`.

## 3. Tipografia

Nada de reaproveitar Anton/Oswald do fantasy. Fonte nova, técnica e neutra:

- **UI / corpo:** **Inter** (400/500/600). Legível, neutra, ótima para chrome de app.
- **Display / logo / números:** **Space Grotesk** (500/700). Geométrica, "tech", combina
  com neon.
- **Mono (opcional, para coords/debug):** stack do sistema (`ui-monospace, SFMono-Regular,
  Menlo, monospace`).

Carregar via Google Fonts no `index.html` (como o projeto antigo já fazia), **ou**
self-host (preferível para deploy estático sem depender de terceiros — decisão de execução;
default: Google Fonts por simplicidade, pode virar self-host depois).

Tokens:
```
--font-ui: "Inter", system-ui, sans-serif;
--font-display: "Space Grotesk", "Inter", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
```

## 4. Logo

Textual, reaproveitando o tratamento "letra em destaque" mas com a cor nova:

```
11A3   → "11" e "3" em --text; "A" em --accent (neon)
```
- Fonte: `--font-display` (Space Grotesk 700).
- No app bar: ~28–34px. Clicável → volta para a listagem (`#/`).
- Favicon/og.png: gerar depois em verde neon (tarefa de polish; não bloqueia a v1).

## 5. Tokens de forma e espaçamento

```
--radius: 8px;          /* cartões, painéis */
--radius-sm: 5px;       /* botões, inputs */
--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px;
--shadow: 0 8px 24px rgba(0,0,0,0.4);
--ring: 0 0 0 2px var(--accent);   /* foco de teclado / seleção */
```

## 6. Componentes-base (guia de estilo)

- **Botão primário:** fundo `--accent`, texto `--accent-ink`, `--radius-sm`; hover
  `--accent-hover`, active `--accent-press`.
- **Botão secundário/ícone:** fundo transparente, borda `--line-strong`, texto `--text`;
  hover borda `--accent`.
- **Ferramenta ativa (toolbar):** fundo `--accent`, ícone `--accent-ink`. Inativa: ícone
  `--muted`, hover `--text`.
- **Item de árvore (sidebar):** hover `--panel-2`; ativo com barra/realce `--accent` à
  esquerda e texto `--text`.
- **Input/select:** fundo `--panel-2`, borda `--line-strong`, foco `--ring`.
- **Diálogo:** `--panel`, `--radius`, `--shadow`, overlay `rgba(0,0,0,0.5)`.
- **Estados de sync (chips):** synced = `--muted`; remote-newer/conflict = `--warning`;
  offline = `--muted` tracejado; local-only = contorno `--line-strong`.

## 7. Canvas — estética

- Fundo do canvas `--bg-canvas`; grade opcional pontilhada em `--grid` (pode ficar para
  polish).
- Seleção: bounding box 1px `--selection`, alças de canto quadradas 8px preenchidas
  `--selection` com miolo `--bg`.
- Cor default de novo traço: `--accent` (neon) — mas o dono pode trocar no StylePanel.
- Preenchimento default: `transparent`.

> Todos os valores acima vivem em `src/styles/tokens.css` como custom properties e são a
> **única** fonte de cor/spacing. Nenhum componente hardcoda hex fora desse arquivo.
