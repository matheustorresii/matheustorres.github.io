# 5a0 — Fase 0 (dados + overall + inspetor)

Fantasy de Valorant inspirado no 7a0. Esta fase entrega **só** a base de dados:
ingestão do VLR.gg, cálculo de overall (0–99) e um **inspetor visual** pra conferir.
Ainda **não** há draft nem simulação (próximas fases — ver `PLAN.md`).

## Setup (uma vez)

```bash
npm install
```

## Adicionar / ingerir um evento

Os eventos vivem em `events_catalog.json` (já vem com 16 campeonatos). Para ingerir:

```bash
npm run ingest -- 1015      # um evento, pelo event_id do VLR
npm run ingest -- all       # todos os aprovados no catálogo
npm run ingest -- status    # tabela de status (catálogo vs ingestão)
```

**Pra adicionar um evento novo que não está no catálogo:** descubra o `event_id` e o
`slug` na URL do VLR (`https://www.vlr.gg/event/stats/{event_id}/{slug}`), adicione uma
linha em `events_catalog.json` e rode `npm run ingest -- {event_id}`. As URLs de stats e
de overview (colocações) são montadas automaticamente.

O que a ingestão faz, por evento:
1. Baixa a página de **stats** e a de **overview** (colocações) — com **cache** em
   `data/cache/` (nada é rebaixado duas vezes) e **rate-limit** educado (~2.5s entre
   requisições reais).
2. Faz o parsing dos stats (nome limpo do slug, time pela tag, agentes, R2.0, ACS, …).
3. Resolve as **colocações finais** da tabela de standings e casa cada time à sua
   colocação (robusto a formatos diferentes; quem não aparece nas standings = "grupos").
4. Deduz a **role** de cada jogador pelos agentes e calcula o **overall** + sub-atributos.
5. Escreve `data/events/{event_id}.json` e reconstrói `data/index.json` e
   `data/players/index.json`.

Saída em `data/` (versionável): um JSON por evento + índices. O status por evento fica em
`data/ingest_status.json`.

## Rodar o app

```bash
npm run dev        # abre o Vite em http://localhost:5173
```

Duas abas:

**Jogar** (o jogo, estilo 7a0):
1. **Setup** — escolhe a formação (1-1-1-1 + Flex, Duelo Duplo, Coringa) e o modo
   **Clássico** (overall visível) ou **Almanaque** (overall oculto).
2. **Draft por sorteio** — botão ROLAR sorteia um **time + campeonato**; aparecem os 5
   jogadores daquele time naquele evento com a **role que jogaram ali**; você escolhe um e
   ele ocupa o slot da role (ou o Flex). Rerolls limitados (**Outro time** / **Outro
   campeonato**, 3 no total). Contador 0/5 → 5/5.
3. **Campanha** — gera um **SEED** textual (ex.: `#GSGKWW`) reproduzível; modo **Jogo a
   jogo** (assiste round a round, com seletor de velocidade) ou **Automático**; fase de
   grupos → playoffs double-elim → grande final MD5. Termina num **card final**
   compartilhável com os 5 jogadores (de qual time/campeonato cada um veio) e a colocação.

**Inspetor** (ferramenta de dados): filtra por **ano**/**campeonato**, vê os **times
ordenados pela colocação** com **overall em destaque** e stats-chave, e **busca por
jogador** entre eventos.

> O app lê os JSON de `data/` via um symlink em `apps/web/public/data` (criado
> automaticamente pela ingestão).

## Simular um torneio (motor v1 / v2)

```bash
npm run sim -- 1015 v1            # modelo de round simples (logístico)
npm run sim -- 1015 v2 minhaSeed  # modelo avançado: lados, pistol, eco, momentum
```

Constrói os 5 jogadores de cada time a partir dos overalls reais do evento, simula
fase de grupos → playoffs double-elim → grande final MD5 (regras exatas: primeiro a 13,
12-12 vai pra OT vencendo por 2) e imprime o bracket, a classificação final e um mapa
**round a round** de amostra. Determinístico por seed. Parâmetros em
`packages/sim/src/config.ts` (ver `SIMULATION.md`).

## Testes

```bash
npm test           # critério de aceite + regras de simulação (16 testes)
npm run typecheck  # checagem de tipos de todos os pacotes
```

**Critério de aceite (event 1015 — Champions 2022):** o overall do **pAncada** (R2.0 1.21,
LOUD campeã) deve ser **maior** que o do **kiNgg** (R2.0 1.31, mas Leviatán caiu antes).
Teste em `packages/overall/src/__tests__/champions2022.acceptance.test.ts`. Resultado
atual: pAncada **90** > kiNgg **86**.

## Estrutura

```
packages/domain     tipos compartilhados, mapa agente→role, dedução de role/flex
packages/overall    fórmula de overall + sub-atributos (config em src/config.ts) + teste
packages/pipeline   scraper VLR (cache, rate-limit, parsers, resolução de time), CLI
packages/sim        motor de simulação: round (v1/v2) → mapa → série → bracket, CLI
apps/web            app (Vite + React): src/game (draft+campanha) + inspetor
data/               saída: events/{id}.json, index.json, players/index.json, cache/
```

A fórmula de overall e seus coeficientes estão em `packages/overall/src/config.ts` e
documentados em `OVERALL.md`.
