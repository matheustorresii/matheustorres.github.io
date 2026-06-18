# 5a0 — Fantasy de Valorant (estilo 7a0)

> Status: **PLANEJAMENTO** — aguardando aprovação antes de implementar.
> Documentos irmãos: [DATA_MODEL.md](./DATA_MODEL.md), [PIPELINE.md](./PIPELINE.md),
> [OVERALL.md](./OVERALL.md), [SIMULATION.md](./SIMULATION.md).

## 1. Visão geral

Jogo web onde o jogador:
1. Escolhe uma **comp** (formação) — 5 roles (default: 1 duelista, 1 iniciador, 1
   controlador, 1 sentinela, 1 flex), com variações configuráveis (ex.: double-duelist).
2. Faz um **draft**: o sistema sorteia *cards* de jogadores reais (um por vez), cada card
   sendo "jogador X no campeonato Y" com os stats reais daquele evento. O usuário encaixa
   cada sorteado numa role válida.
3. Simula um **torneio** (grupos/Swiss → playoffs double-elim → grande final), com séries
   MD3 (MD5 na final) jogadas **round a round** na UI.

Cada card tem um **overall 0–99** que mistura desempenho individual + a campanha do time
naquele campeonato (ver [OVERALL.md](./OVERALL.md)). Esse é o coração do projeto.

## 2. Stack recomendada

**Concordo com a preferência de SPA estática + JSON embarcado, sem backend em runtime.**
Os dados do VLR mudam raramente (um evento só é "fechado" depois que termina), então
extrair offline e embarcar JSON versionado é ideal: deploy estático barato (GitHub
Pages/Netlify/Vercel), zero custo de servidor, e reprodutibilidade total.

| Camada | Escolha | Justificativa |
|---|---|---|
| Linguagem | **TypeScript** em todo o monorepo | Tipos compartilhados entre pipeline, engine e UI — o `Player`/`PlayerCard` é o mesmo contrato em todo lugar. |
| Frontend | **React + Vite** | Ecossistema maduro, build estático rápido, fácil de animar rounds. |
| Estado | **Zustand** | Leve; o estado do draft/torneio é uma máquina de estados simples. |
| Estilo | **Tailwind CSS** | Iteração rápida em UI de "cards estilo FIFA". |
| Pipeline de dados | **Node + TS**, `undici`/`fetch` + **Cheerio** | Parsing de HTML do VLR; reaproveita os tipos do domínio. |
| Engine de simulação | **TS puro** (pacote sem deps de UI) | Determinístico, testável isolado, com `seed` (PRNG injetável). |
| Testes | **Vitest** | Único runner pra pipeline, engine e UI. Roda o critério de aceite. |

> **Por que não Python no scraper?** BeautifulSoup é ótimo, mas perderíamos o
> compartilhamento de tipos com a UI/engine. Como o volume é baixo (dezenas de eventos,
> ~30 jogadores cada) Cheerio dá conta. Decisão reversível — fica como decisão em aberto.

### Estrutura de monorepo (proposta)

```
5a0/
├─ packages/
│  ├─ domain/         # tipos + schemas (Player, Event, PlayerCard, ...) — zero deps
│  ├─ overall/        # cálculo de overall + sub-atributos (+ testes de aceite)
│  ├─ pipeline/       # scraper VLR: link -> stats+colocações -> JSON normalizado
│  └─ sim/            # engine: round -> mapa -> série -> bracket (PRNG injetável)
├─ apps/
│  └─ web/            # SPA React (importa domain/overall/sim + JSON gerado)
├─ data/
│  ├─ cache/          # HTML cru baixado do VLR (gitignored ou commitado p/ repro)
│  └─ events/         # {event_id}.json normalizados (embarcados na build)
└─ ...
```

## 3. Fluxo de dados (build-time vs runtime)

```
[Você manda link do evento]
        │  (offline, manual, um evento por vez)
        ▼
  pipeline (Node/TS) ──> data/cache/*.html  ──> data/events/{id}.json
        │                                              │
        │  (build da SPA: import dos JSONs)             │
        ▼                                              ▼
  apps/web (estático) ──────────────────────────> draft + simulação no browser
```

Nenhuma chamada de rede em runtime. O VLR só é tocado pelo pipeline, offline.

## 4. Fases de implementação (MVP → polish)

> Detalhes de cada peça nos docs irmãos. Numeradas pra fechar uma de cada vez.

- **Fase 0 — Scaffold.** Monorepo, `domain` (tipos), Vitest, fixture manual de um
  subconjunto de Champions 2022 (sem scraping ainda) pra destravar as fases 1 e 3.
- **Fase 1 — Overall + teste de aceite.** Implementar a fórmula de [OVERALL.md](./OVERALL.md)
  sobre a fixture. **Critério de aceite automatizado: `overall(pAncada) > overall(kiNgg)`
  no event 1015.** Nada avança sem esse teste verde.
- **Fase 2 — Engine de simulação v1.** Round-a-round com regras exatas (13 / OT por 2),
  mapa, série MD3/MD5, bracket. Testes das regras de placar. PRNG com seed.
- **Fase 3 — Pipeline real (1 evento).** `link -> stats + colocações -> JSON`, com cache,
  rate-limit e o parsing de nome/time descrito em [PIPELINE.md](./PIPELINE.md). Validar
  reproduzindo a fixture de Champions 2022 a partir do HTML real.
- **Fase 4 — SPA: draft.** Seleção de comp, sorteio um-a-um, encaixe em roles, validação.
- **Fase 5 — SPA: torneio.** Bracket visual + player de rounds (assistir os rounds passando).
- **Fase 6 — Polish.** Cards com sub-atributos estilo FIFA, múltiplos eventos no pool,
  modelo de round v2 (lados/pistol/eco/momentum), UX/animação, persistência local.

## 5. Critério de aceite (resumo)

No **Valorant Champions 2022 (event 1015)**: kiNgg teve R2.0 1.31 (melhor do evento) mas a
Leviatán não foi campeã; pAncada teve R2.0 1.21 (5º) mas a LOUD foi **campeã**. Depois do
cálculo, **`overall(pAncada)` DEVE ser maior que `overall(kiNgg)`**. Teste em
`packages/overall/src/__tests__/champions2022.acceptance.test.ts`. Math worked em
[OVERALL.md](./OVERALL.md) §4.

## 6. Decisões em aberto

Ver seção dedicada no fim da conversa — preciso do seu OK nelas antes de codar.
Resumo: formato exato da comp/flex, agregado de força do time, parâmetros do logístico,
grupos vs Swiss, scraping vs vlrggapi, TS vs Python no scraper, map pool atual.
