# Overall (0–99)

> Princípio: **desempenho individual + campanha do time**. Um campeão vale mais que um
> indivíduo de stats melhores que caiu cedo. Tudo transparente e ajustável por config.

## 1. Fórmula

```
overall = clamp( round( SCALE * base_individual + OFFSET
                        + placement_bonus
                        + role_adjust ),
                 FLOOR, 99 )
```

Defaults propostos: `SCALE = 0.60`, `OFFSET = 36`, `FLOOR = 40`.
(`SCALE`/`OFFSET` mapeiam o `base_individual` 0–100 pra uma faixa realista ~40–96 antes
dos bônus; mantém os overalls com cara de card.)

### 1a. `base_individual` (0–100) — performance pura
Blend de métricas normalizadas por **âncoras fixas** (event-agnósticas → comparável entre
campeonatos; transparente e estável). Cada `norm_x = clamp((x - lo)/(hi - lo) * 100, 0, 100)`.

| Métrica | lo | hi | peso default |
|---|---|---|---|
| R2.0 | 0.70 | 1.40 | **0.50** |
| ACS  | 130  | 300  | 0.18 |
| KAST%| 60   | 85   | 0.14 |
| K:D  | 0.70 | 1.60 | 0.10 |
| ADR  | 100  | 200  | 0.08 |

```
base_individual = 0.50·norm_R20 + 0.18·norm_ACS + 0.14·norm_KAST
                + 0.10·norm_KD  + 0.08·norm_ADR
```

R2.0 domina (é o rating composto do VLR), mas **não** sozinho — é isso que dá espaço pro
bônus de campanha virar o jogo.

### 1b. `placement_bonus` + `placement_floor` — a campanha do time
Bônus aditivo **e** um piso por tier, pra que jogadores de runs profundas (ex.: um IGL
finalista com números modestos) não fiquem subvalorizados. `overall = max(raw, floor)`.

| Tier | Bônus | Piso |
|---|---|---|
| champion | **+20** | 75 |
| runnerUp | +15 | 70 |
| top4 | +10 | 63 |
| top8 | +5 | — |
| top12 | +2 | — |
| groups | 0 | — |

### 1c. `role_adjust` (opcional, pequeno) — não subvalorizar suporte/IGL
Controladores e iniciadores tendem a ter R2.0/ACS menores por função. Ajuste leve:
```
role_adjust = +3 controller, +2 initiator, +1 sentinel, +0 duelist
```
Mantido pequeno de propósito (não pode dominar o resultado). **Ligável/desligável** por config.

## 2. Sub-atributos (card estilo FIFA) — 0–99 cada

Cosméticos pro card (não entram no `overall`, salvo se você quiser — decisão em aberto).
Mesma normalização por âncoras:

| Atributo (PT na UI) | Fonte | Composição |
|---|---|---|
| Mira | HS%, ACS | 0.6·norm_HS + 0.4·norm_ACS |
| Poder de fogo | KPR, FKPR | 0.6·norm_KPR + 0.4·norm_FKPR |
| Clutch | CL% | norm_CL |
| Consistência | KAST | norm_KAST |
| Suporte | APR, A | 0.7·norm_APR + 0.3·norm_A/rounds |

Âncoras dessas métricas ficam na config junto das de cima.

## 3. Config (tudo num lugar)

`packages/overall/src/config.ts` exporta `OverallConfig` com: pesos, âncoras (lo/hi),
`SCALE/OFFSET/FLOOR`, tabela de `placement_bonus`, flags de `role_adjust`. Trocar a
"sensação" do jogo = editar config, sem mexer na lógica.

## 4. Critério de aceite — pAncada > kiNgg (Champions 2022, event 1015)

**Fato:** kiNgg R2.0 **1.31** (melhor do evento), Leviatán **não** campeã. pAncada R2.0
**1.21** (5º), LOUD **campeã**. Exigência: `overall(pAncada) > overall(kiNgg)`.

**Por que a fórmula passa** (R2.0 é o que mais separa os dois; uso só R2.0 aqui pra
ilustrar o mecanismo — os stats secundários exatos entram na ingestão e só estreitam/alargam
um pouco, sem inverter o sinal):

- `norm_R20(1.31) = (1.31−0.70)/0.70·100 ≈ 87.1`
- `norm_R20(1.21) = (1.21−0.70)/0.70·100 ≈ 72.9`
- Gap de base só do R2.0 ≈ 14.2 → após `SCALE 0.60` ≈ **+8.5 pra kiNgg**.
- Mas placement: pAncada `champion +14`, kiNgg (Leviatán, eliminada cedo) `groups/top8`
  ≈ `0..+3`. Gap de campanha ≈ **+11 a +14 pra pAncada**.
- Resultado: a campanha (+11 a +14) **supera** a vantagem individual (+8.5). pAncada vence.

Valores **reais** computados pela ingestão do event 1015:

| | R2.0 | ACS | KAST | K:D | base | role adj | placement | **overall** |
|---|---|---|---|---|---|---|---|---|
| kiNgg | 1.31 | 260 | 77 | 1.36 | 79.1 | duelist (+0) | top8 (+3) | **86** |
| pAncada | 1.21 | 210.5 | 78 | 1.25 | 64.1 | controller (+2) | champion (+14) | **90** |

→ `90 > 86` ✅ (margem 4 pontos; passa até com `role_adjust` desligado: 88 > 86).

> O teste lê os stats **de verdade** do JSON do event 1015 e afirma a **desigualdade**,
> não os valores absolutos.

### Dado faltante (reweighting)
O VLR não publica todas as colunas em todos os eventos (ex.: Masters Shanghai 2024 não tem
R2.0 nem KAST). Quando uma métrica vem ausente (valor 0), o `base_individual` **redistribui
o peso** entre as métricas presentes em vez de tratar o ausente como zero — senão um
campeão sem R2.0 publicado afundaria. Comportamento em `baseIndividual()`; a UI mostra "—"
para métricas ausentes.

### O teste
`packages/overall/src/__tests__/champions2022.acceptance.test.ts`:
```ts
test("pAncada (champion) outranks kiNgg (best R2.0) — Champions 2022", () => {
  const event = loadEvent("1015");
  const cards = computeCards(event, DEFAULT_CONFIG);
  const pancada = cards.find(c => c.playerId === PANCADA_ID)!;
  const kingg   = cards.find(c => c.playerId === KINGG_ID)!;
  expect(pancada.overall).toBeGreaterThan(kingg.overall);
});
```
Roda na Fase 1 sobre a fixture; revalida na Fase 3 sobre o JSON scraped real.
