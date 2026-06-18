# Formato do torneio (campanha)

Espelha um Champions/Masters real. **16 times**: o seu + 15 elencos históricos
sorteados. Tudo determinístico pelo SEED. Config em
`packages/sim/src/config.ts` → `DEFAULT_TOURNAMENT`.

```
16 times
  └─ Fase de grupos: 4 grupos de 4 (round-robin)  → passam os 2 melhores de cada =/Users/matheustorresii/Developer/vava5a0/apps 8
        └─ Playoffs: chave dupla de 8 (upper/lower)
              └─ Grande Final (MD5) → Campeão
```

## Fase de grupos — formato GSL (igual VCT)

Os 16 são divididos em **4 grupos de 4**. Cada grupo é uma **mini chave dupla**:

```
Abertura:   A vs D ─┐         ┌─ B vs C
                    ▼         ▼
Vencedores:  vencedor A/D × vencedor B/C  → vencedor = 2-0  ✓ AVANÇA (1º)
                    │perdedor      │perdedor
Eliminação: perdedor A/D × perdedor B/C   → perdedor = 0-2  ✗ ELIMINADO (4º)
                    │                  │vencedor (1-1)
Decisão:   perdedor dos Vencedores (1-1) × vencedor da Eliminação (1-1)
                    → vencedor = 2-1  ✓ AVANÇA (2º) · perdedor = 1-2 ✗ ELIMINADO (3º)
```

- **2-0** → avança direto (joga 2). **0-2** → eliminado (joga 2).
- **1-1** → joga a **Decisão**: ganhou (2-1) avança, perdeu (1-2) sai (joga 3).
- **Passam 2 de cada grupo** (o de 2-0 e o de 2-1) = 8 times.

> Era isso que você tinha sacado: ganhou 2 → já está no mata-mata; 1-1 tem o jogo de
> desempate; 0-2 e 1-2 saem. (Antes estava como round-robin — corrigido.)

## Playoffs — chave dupla (double-elimination) de 8

Os 8 classificados começam na **chave superior (upper)**. A graça da chave dupla:
**perder uma vez não elimina** — você cai pra **chave inferior (lower)** e ganha uma
segunda vida.

```
UPPER:   Quartas → Semi → Final Upper ─────────┐
            │loser   │loser      │loser         ▼
LOWER:   R1 → R2 →  Semi → Final Lower ──→  GRANDE FINAL (MD5)
            │                       │loser = eliminado     │
            └─ perdeu no lower = ELIMINADO                  └─→ Campeão
```

- **Perdeu no upper** → desce pro lower (continua vivo).
- **Perdeu no lower** → **eliminado**.
- Ou seja: você sai quando **perde 2 séries** no mata-mata (a 1ª te joga pro lower, a 2ª te
  elimina). Quem vem do lower e vence tudo chega à grande final.
- **Grande Final**: campeão do upper × campeão do lower, em **MD5**.

## Quantos jogos até o título?

Depende do caminho (nos grupos você joga 2 ou 3; no upper são 4 séries até o título):

- **2-0 nos grupos + corre o upper**: 2 + Quartas + Semi + Final Upper + Grande Final = **6 jogos**.
- **2-1 nos grupos + corre o upper**: **7 jogos** (a vibe "7a0").
- **Passando pelo lower**: pode chegar a ~9–10, porque o caminho do lower é mais longo.

## Séries (Best-of)

| Etapa | Formato |
|---|---|
| Grupos | MD3 (primeiro a 2 mapas) |
| Playoffs (upper / lower até a semi) | MD3 |
| Final da chave inferior | **MD5** |
| Grande Final | **MD5** (primeiro a 3 mapas) |

Cada mapa: primeiro a 13; 12–12 vai pra OT vencendo por 2 (14–12, 15–13, …).

## Classificação final

- **1º** campeão (vence a grande final) · **2º** vice
- **3º** quem perde a Final Lower · **4º** quem perde a Lower Semi
- **5º–6º** eliminados na Lower R2 · **7º–8º** eliminados na Lower R1
- **Fase de grupos** quem não passou dos grupos (os 8 de baixo)

## O que dá pra configurar

Em `DEFAULT_TOURNAMENT` (`packages/sim/src/config.ts`): nº de grupos, times por grupo,
quantos avançam, e o `bestOf` de cada etapa. O bracket de playoffs é a chave dupla de 8
(padrão de Champions/Masters). Formato suíço nos grupos é uma extensão possível, mas
**hoje a fase de grupos é round-robin**.
