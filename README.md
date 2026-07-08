# 11A3 — Whiteboard

Um app de **quadro branco / diagramas** estilo Excalidraw, 100% no navegador, sem
servidor. Hospedado estaticamente no GitHub Pages (`11a3.dev`).

## Rodar

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # gera apps/whiteboard/dist (estático)
npm run typecheck
```

## O que ele faz

- Canvas infinito: retângulo, elipse, linha, seta (com rótulo e binding), desenho livre,
  texto (com modo "código" monospace), imagens (colar/arrastar) e ícones de arquitetura.
- Selecionar / mover / redimensionar / **rotacionar**, multi-seleção (marquee, Cmd+A/C/V/D),
  undo/redo, pan/zoom, snap ao grid.
- Organização em **pastas e subpastas**, com thumbnails. Persistência local em IndexedDB.
- **Sync via GitHub** (o "login" é um PAT fine-grained no próprio device): cada board vira
  um JSON num repo privado seu; sync manual + ao sair/entrar do app; aviso de conflito.
- **Compartilhar** um board por link somente-leitura (gist secreto).

## Estrutura

```
apps/whiteboard/   o app (Vite + React + TS)
  src/canvas/      núcleo imperativo do canvas (render loop, input, shapes)
  src/sync/        cliente GitHub + motor de sync + compartilhamento
  src/persistence/ IndexedDB
  src/ui/          chrome em React (toolbar, sidebar, painéis, diálogos)
spec/              a especificação (SDD): requisitos, arquitetura, modelo de dados, etc.
```

O plano completo está em [`spec/`](./spec).

## Deploy

`.github/workflows/deploy.yml` faz build de `apps/whiteboard` e publica no GitHub Pages a
cada push na `main`.
