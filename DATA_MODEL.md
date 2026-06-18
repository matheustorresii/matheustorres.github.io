# Modelo de dados

> Normalizado. IDs do VLR são a chave canônica (estáveis). Tudo em inglês no código.

## Entidades

### `Player` (canônico, atemporal)
Identidade da pessoa, independente de evento.
```ts
interface Player {
  id: string;          // vlr player id, ex. "8549"  (de /player/8549/kingg)
  handle: string;      // nome de jogo limpo, ex. "kingg" (vem do slug da URL)
  displayName: string; // casing "bonito" do VLR, ex. "kiNgg" (texto visível, sem tag)
  country?: string;    // se disponível na página do player
}
```

### `Team` (por evento — rosters mudam)
```ts
interface Team {
  id: string;    // vlr team id
  name: string;  // "Leviatán"
  tag: string;   // "LEV"  (a sigla grudada no nome no stats table)
}
```

### `EventInfo`
```ts
interface EventInfo {
  id: string;          // "1015"
  slug: string;        // "valorant-champions-2022"
  name: string;        // "Valorant Champions 2022"
  year: number;        // 2022
  tier: "Champions" | "Masters" | "Other";
  mapPool: string[];   // mapas em jogo NAQUELE evento (rotacionam por ato)
  sourceUrls: {        // pra reprodutibilidade/cache
    stats: string;     // /event/stats/1015/...
    overview: string;  // /event/1015/... (colocações)
  };
}
```

### `PlayerEventStats` (o "fato" central — 1 linha por jogador por evento)
Reflete exatamente a tabela de stats do VLR daquele evento.
```ts
interface PlayerEventStats {
  playerId: string;
  eventId: string;
  teamId: string;
  agents: string[];   // agentes jogados no evento (ícones da coluna Agents)
  rounds: number;     // Rnd
  r20: number;        // R2.0 (rating)
  acs: number;        // ACS
  kd: number;         // K:D
  kast: number;       // KAST %  (guardar como número, ex. 73.0)
  adr: number;        // ADR
  kpr: number;        // KPR
  apr: number;        // APR
  fkpr: number;       // FKPR
  fdpr: number;       // FDPR
  hsPct: number;      // HS%
  clPct: number;      // CL% (clutch)
  k: number; d: number; a: number; fk: number; fd: number;
}
```

### `Placement` (1 por time por evento — NÃO está na página de stats)
```ts
interface Placement {
  eventId: string;
  teamId: string;
  rank: number;             // 1 = campeão, 2 = vice, ...
  tier: PlacementTier;      // bucket usado no bônus de overall
  stageReached: string;     // "Champion" | "Grand Final" | "Top 4" | "Groups" | ...
}
type PlacementTier =
  | "champion" | "runnerUp" | "top4" | "top8" | "top12" | "groups";
```

### `PlayerCard` (DERIVADO — a unidade sorteável no draft)
"Jogador X no evento Y". O mesmo jogador em eventos diferentes = cards diferentes
(igual versões de FIFA). Computado por `packages/overall` a partir de stats+placement.
```ts
interface PlayerCard {
  cardId: string;          // `${playerId}@${eventId}`
  playerId: string;
  eventId: string;
  teamId: string;
  role: Role;              // role primária deduzida dos agentes
  isFlex: boolean;         // joga 2+ roles acima do threshold
  rolesPlayed: Role[];     // todas as roles cobertas no evento
  overall: number;         // 0–99
  subAttributes: {         // estilo card FIFA (ver OVERALL.md §5)
    aim: number;           // Mira      (HS%, ACS)
    firepower: number;     // Poder de fogo (KPR, FKPR)
    clutch: number;        // Clutch    (CL%)
    consistency: number;   // Consistência (KAST)
    support: number;       // Suporte   (APR, A)
  };
  breakdown: {             // transparência: como o overall foi montado
    baseIndividual: number;
    placementBonus: number;
    roleAdjust: number;
  };
}
```

## Roles e mapeamento de agentes

```ts
type Role = "duelist" | "initiator" | "controller" | "sentinel";
// "flex" NÃO é uma role própria — é a flag isFlex + um slot que aceita qualquer role.
```

Mapa agente→role (data-driven, em `packages/domain/src/agents.ts`). **Verificar roster
a cada ato — agentes novos entram.** Estado atual proposto:

| Role | Agentes |
|---|---|
| duelist | Jett, Raze, Reyna, Phoenix, Neon, Yoru, Iso, Waylay |
| initiator | Sova, Breach, Skye, KAY/O, Fade, Gekko, Tejo |
| controller | Brimstone, Omen, Viper, Astra, Harbor, Clove |
| sentinel | Killjoy, Cypher, Sage, Chamber, Deadlock, Vyse |

**Dedução da role primária / flex** (proposta — threshold ajustável):
- Idealmente usar contagem de rounds por agente; o stats table do VLR só lista o
  *conjunto* de agentes sem distribuição. **Decisão em aberto:** ou (a) puxar
  distribuição por agente de outra aba do evento, ou (b) aproximar pela ordem/lista de
  agentes (o VLR ordena por uso) — `agents[0]` define a role primária.
- `isFlex = true` se o jogador tem agentes de **2+ roles** distintas no evento (proposta
  simples). Refino possível: exigir ≥ X% de rounds na 2ª role quando tivermos a
  distribuição.

> No draft, um slot "flex" aceita qualquer role; um slot de role fixa (ex. sentinela)
> aceita cards cuja `role === "sentinel"` **ou** que sejam `isFlex` e tenham `sentinel`
> em `rolesPlayed`. (Comportamento exato do flex = decisão em aberto.)

## JSON por evento (artefato do pipeline)

`data/events/{event_id}.json`:
```ts
interface EventFile {
  event: EventInfo;
  players: Player[];               // dedup por id
  teams: Team[];
  stats: PlayerEventStats[];
  placements: Placement[];
  cards: PlayerCard[];             // derivado; recomputável a partir do resto
  meta: { scrapedAt: string; pipelineVersion: string; };
}
```

O índice global `data/events/index.json` lista os eventos disponíveis pra UI montar o pool.
