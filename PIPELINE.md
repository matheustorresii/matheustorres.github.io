# Pipeline de extração (VLR.gg)

> Objetivo: **um evento por link → JSON normalizado**, offline, com cache e educadamente.

## Entradas (por evento, você me manda)

1. **Stats**: `https://www.vlr.gg/event/stats/{event_id}/{slug}`
   Ex.: `https://www.vlr.gg/event/stats/1015/valorant-champions-2022`
2. **Overview/colocações**: `https://www.vlr.gg/event/{event_id}/{slug}`
   (a página de stats **não** tem colocação final — vem daqui / da aba de matches/bracket).

A partir do link de stats dá pra derivar o de overview (mesmo `event_id`).

## Etapas

```
fetch(stats_url)    ─┐
fetch(overview_url) ─┤→ cache HTML cru → parse → normalize → validate → events/{id}.json
                     ┘
```

### 1. Fetch + cache (respeitoso)
- **Cache local obrigatório**: `data/cache/{sha1(url)}.html`. Se existe, não rebaixa.
  Reprocessar é sempre offline a partir do cache.
- **Rate-limit**: no máx. 1 request a cada ~2–3 s, serial (sem paralelismo).
- **User-Agent** identificável e honesto; respeitar `robots.txt`; sem retries agressivos.
- Reprocessamento (mudou o parser/fórmula) **nunca** rebaixa: roda tudo do cache.

### 2. Parse do stats table
Colunas: `Player, Agents, Rnd, R2.0, ACS, K:D, KAST, ADR, KPR, APR, FKPR, FDPR, HS%, CL%,
K, D, A, FK, FD`.

**Parsing de nome + time (o ponto delicado):**
- O texto visível vem com a **tag do time grudada**: `kiNggLEV` = handle `kiNgg`, time `LEV`.
- **Fonte da verdade do nome**: o slug do link do player na própria linha →
  `/player/8549/kingg` ⇒ `playerId="8549"`, `handle="kingg"`.
- **`displayName`** (casing bonito): pega o texto visível e **remove o sufixo da tag**
  (a tag costuma ser a substring final em maiúsculas que casa com a tag do time da linha).
  Cross-check: `displayName.toLowerCase()` deve bater com `handle`.
- **Time**: a tag (`LEV`) + o nome/escudo do time na linha → resolve `teamId`/`name`.
  Confirmar pela página de overview (rosters) pra evitar ambiguidade de tag.
- `agents`: dos ícones (cada `<img>` tem o nome do agente no `src`/`alt`).
- Percentuais (`KAST`, `HS%`, `CL%`) chegam como `"73%"` → guardar `73.0` (número).
- Campos vazios (ex. CL% sem clutch) → `0` ou `null` documentado.

### 3. Parse de colocações
Da página de overview/bracket/matches do evento: campeão, vice, top4, top8, fase de grupos.
Mapear cada `teamId` → `Placement` com `rank` + `tier` (`PlacementTier` em DATA_MODEL.md).
Estruturas variam por evento (alguns têm Swiss, outros grupos) → o parser de colocação
precisa ser tolerante; na pior hipótese, **override manual** num arquivo
`data/overrides/{event_id}.json` (decisão em aberto: quanto automatizar vs. confirmar à mão).

### 4. Normalize + validate
- Dedup de `Player`/`Team` por id.
- Validar com schema (zod) — toda linha de stats tem placement do time? todo team tem
  placement? Falha barulhenta se não.
- Computar `cards` chamando `packages/overall`.
- Emitir `events/{id}.json` + atualizar `events/index.json`.

## scraping vs. vlrggapi (community API) — avaliação

[vlrggapi](https://github.com/axsddlr/vlrggapi) é uma API comunitária não-oficial sobre o
VLR. Cobre bem: resultados de matches, próximos jogos, rankings, notícias, e *stats de
jogador*. **Mas a cobertura de "tabela de stats por evento" e de "colocação final por
evento" é limitada/instável**, que é exatamente o que precisamos.

**Recomendação:** scraping com cache como **fonte da verdade**, atrás de uma interface
`EventSource` (`fetchStats(eventId)`, `fetchPlacements(eventId)`). Assim um adapter
`VlrggapiSource` pode ser plugado depois pra campos que a API cobrir bem (cross-check),
sem reescrever o pipeline. Começar simples: scraper + cache + rate-limit. **Decisão em
aberto** caso você prefira priorizar a API.

## Reprodutibilidade
- `pipelineVersion` no `meta` de cada arquivo.
- HTML cru no cache ⇒ qualquer mudança de parser/fórmula é reproduzível sem rede.
- **Decisão em aberto:** commitar o `data/cache/` no git (repro total, repo maior) ou
  só os JSONs normalizados (repo enxuto, mas re-fetch exige rede).
