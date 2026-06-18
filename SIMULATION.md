# Motor de simulação

> Determinístico com **PRNG injetável** (seed) → reprodutível e testável. Camadas:
> round → mapa → série → bracket. v1 simples; v2 com lados/pistol/eco/momentum atrás de flag.

## 1. Força do time

```
team_strength = mean(overall dos 5 cards escalados)
```
**Proposta default: média simples.** Alternativa configurável: média ponderada (ex. peso
maior pro card de maior overall ou pro duelista). Recomendo simples no v1 — fácil de
entender e calibrar. (Agregado = **decisão em aberto**.)

## 2. Round (v1)

Modelo logístico na diferença de força, com aleatoriedade via Bernoulli:
```
d  = team_strength_A − team_strength_B          // em pontos de overall
p  = 1 / (1 + exp(−K * d / SCALE_D))            // P(A vence o round)
winner = rng() < p ? A : B
```
- `SCALE_D` (default ~6): de quantos pontos de overall "vale" uma diferença relevante.
- `K` (default ~1.0): inclinação. K↑ = mais determinístico; K↓ = mais zebra.
- Em `d = 0` → `p = 0.5`. Diferença grande nunca vira 100% (sempre cabe zebra).
- (Parâmetros `K`/`SCALE_D` = **decisão em aberto** — calibrar pra "sensação" boa.)

### Round v2 (atrás de flag `roundModel: "v2"`, Fase 6)
- **Lados ataque/defesa**: bônus por mapa/lado (alguns mapas favorecem defesa).
- **Pistol** (rounds 1 e 13): peso próprio; vitória influencia os 2 rounds seguintes (eco).
- **Economia/eco**: estado simples de "bonus/eco/full-buy" afetando `p`.
- **Momentum**: pequeno bônus por sequência de rounds ganhos.
- Tudo opcional; **v1 ignora** e usa só o logístico puro.

## 3. Mapa — regras EXATAS de placar

Primeiro a **13** vence. Empate **12–12 → overtime**, vencendo por **2 de diferença**
(14–12, 15–13, 16–14, ...). Pseudocódigo da condição de término:

```ts
function isMapOver(a: number, b: number): boolean {
  if (a >= 13 && a - b >= 2 && b <= 11) return true;   // 13–0 .. 13–11
  if (b >= 13 && b - a >= 2 && a <= 11) return true;
  if (a >= 14 && a - b >= 2) return true;              // OT: 14–12, 15–13, ...
  if (b >= 14 && b - a >= 2) return true;
  return false;
}
// 12–12 NÃO termina; segue até 2 de diferença a partir de 14.
```
Casos de teste obrigatórios: `13–0`, `13–11`, `12–12→14–12`, `12–12→13–13→15–13`,
`16–14`, e que `13–12` **nunca** encerra. (Fase 2.)

> Mapa simulado **round a round**: a engine emite a sequência de rounds (placar a cada
> round) pra UI animar "os rounds passando".

## 4. Série (Best-of)

- **MD3**: primeiro a **2** mapas. **MD5** (grande final): primeiro a **3**.
- `bestOf` é parâmetro da partida (config do torneio define onde é MD3 vs MD5).
- **Mapas**: sorteados do `mapPool` do evento (ver DATA_MODEL.md). v1: sorteio simples sem
  repetição. v2 (opcional): veto pick/ban alternado entre os times.
- **Verificar o map pool atual** — rotaciona por ato; fica em `EventInfo.mapPool`,
  data-driven. (Pool atual = **decisão em aberto** a confirmar.)

## 5. Bracket / formato do torneio

Espelha um Champions/Masters real, **configurável**:
```
fase de grupos (round-robin) OU Swiss
        ↓ classificados
playoffs double-elimination (upper / lower bracket)
        ↓
grande final (MD5)
```
- v1 recomendado: **grupos round-robin** + **double-elim** nos playoffs (mais simples de
  parear que Swiss). Swiss fica como opção. (**grupos vs Swiss = decisão em aberto**.)
- Config do torneio (`TournamentConfig`): nº de grupos, times por grupo, quantos avançam,
  tamanho do bracket, onde aplicar MD3 vs MD5, e o `mapPool`.
- A engine expõe o estado do bracket (próxima série, resultados) pra UI navegar.

## 7. Estado da implementação (v1 + v2 — `packages/sim`)

Implementado e testado (16 testes). Defaults travados (todos em
`packages/sim/src/config.ts`, ajustáveis):

| Knob | Default | Onde |
|---|---|---|
| Força do time | **média** dos 5 maiores overalls | `strengthOf` (peso opcional p/ topo) |
| Logístico | `K=1.0`, `scaleD=6`, clamp `p∈[0.02, 0.98]` | `DEFAULT_ROUND_V1` |
| v2 lados (composição) | duelista/iniciador puxam **ataque**, controlador/sentinela puxam **defesa**; `±(roles−2.5)·3` de força por lado | `sideRoleWeight`, `attackMod` |
| v2 lado global | defensor `+1.5` de força | `sideBias` |
| **Campanha** | perfil achatado `scaleD=24`, `p∈[0.14,0.86]` → placares competitivos (menos 13-0/13-1) | `DEFAULT_ROUND_CAMPAIGN` |
| v2 pistol | gap × `0.4` (mais moeda ao ar) nos rounds 1 e 13 | `pistolDamp` |
| v2 eco | vencedor do pistol `±4` por 2 rounds | `ecoSwing` |
| v2 momentum | `+0.6`/round na sequência, teto `+3` | `momentumPerWin`/`momentumCap` |
| Bracket | 4 grupos de 4, top 2 → double-elim 8 → final MD5 | `DEFAULT_TOURNAMENT` |
| Séries | grupos/upper/lower MD3, grande final MD5 | `bestOf` |

Rodar: `npm run sim -- <eventId> <v1|v2> [seed]` (constrói os times a partir dos
overalls reais do evento e simula o torneio inteiro, com um mapa round-a-round de amostra).

> **Calibração em aberto:** `scaleD=6` torna diferenças grandes de força quase
> determinísticas (muitos 13-1/13-2). Simular times do *mesmo* evento exagera isso
> (o spread de overall já embute a colocação). Para comps mais equilibradas o gap cai.
> `scaleD` é o principal botão de "quão zebra" o jogo é — calibrar quando o draft existir.

## 6. Determinismo e testes
- PRNG seedável injetado em toda a engine (`createRng(seed)`); nada usa `Math.random`
  direto. Mesma seed + mesmos times = mesmo torneio.
- Testes: regras de placar (§3), término de série (§4), e *propriedade* — o time mais
  forte vence **mais** ao longo de N seeds (não sempre, mas com frequência > 50%).
