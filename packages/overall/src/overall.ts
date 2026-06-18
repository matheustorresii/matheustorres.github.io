import type {
  PlayerCard,
  PlayerEventStats,
  Placement,
  Role,
  SubAttributes,
} from "@11a3/domain";
import { deduceRole } from "@11a3/domain";
import { DEFAULT_CONFIG, type Anchor, type OverallConfig } from "./config.js";

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

/** Map a raw stat to 0..100 via fixed anchors. */
export function normalize(value: number, a: Anchor): number {
  if (a.hi === a.lo) return 0;
  return clamp(((value - a.lo) / (a.hi - a.lo)) * 100, 0, 100);
}

/**
 * Weighted 0..100 base. A metric reported as 0 is treated as MISSING (none of
 * R2.0/ACS/KAST/K:D/ADR is legitimately 0 for a player with rounds), and the
 * remaining weights are renormalized. This keeps overalls sensible for events
 * where VLR doesn't publish every column (e.g. Masters Shanghai 2024 has no
 * R2.0/KAST). See OVERALL.md.
 */
export function baseIndividual(
  s: PlayerEventStats,
  cfg: OverallConfig = DEFAULT_CONFIG,
): number {
  const { anchors: an, baseWeights: w } = cfg;
  // [rawValue, normalizedScore, weight]
  const parts: [number, number, number][] = [
    [s.r20, normalize(s.r20, an.r20), w.r20],
    [s.acs, normalize(s.acs, an.acs), w.acs],
    [s.kast, normalize(s.kast, an.kast), w.kast],
    [s.kd, normalize(s.kd, an.kd), w.kd],
    [s.adr, normalize(s.adr, an.adr), w.adr],
  ];

  let weighted = 0;
  let totalWeight = 0;
  for (const [raw, norm, weight] of parts) {
    if (raw > 0) {
      weighted += weight * norm;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

export function subAttributes(
  s: PlayerEventStats,
  cfg: OverallConfig = DEFAULT_CONFIG,
): SubAttributes {
  const a = cfg.subAnchors;
  const aPerRound = s.rounds > 0 ? s.a / s.rounds : 0;
  const round1 = (x: number) => Math.round(x);
  return {
    aim: round1(0.6 * normalize(s.hsPct, a.hsPct) + 0.4 * normalize(s.acs, a.acs)),
    firepower: round1(
      0.6 * normalize(s.kpr, a.kpr) + 0.4 * normalize(s.fkpr, a.fkpr),
    ),
    clutch: round1(normalize(s.clPct, a.clPct)),
    consistency: round1(normalize(s.kast, a.kast)),
    support: round1(
      0.7 * normalize(s.apr, a.apr) + 0.3 * normalize(aPerRound, a.aPerRound),
    ),
  };
}

export interface ComputeInput {
  stats: PlayerEventStats;
  placement: Placement | undefined; // undefined => treated as "groups"
}

export function computeCard(
  input: ComputeInput,
  cfg: OverallConfig = DEFAULT_CONFIG,
): PlayerCard {
  const { stats, placement } = input;
  const roleInfo = deduceRole(stats.agents);
  const role: Role = roleInfo.role;

  const base = baseIndividual(stats, cfg);
  const tier = placement?.tier ?? "groups";
  const placementBonus = cfg.placementBonus[tier];
  const roleAdjust = cfg.roleAdjust[role];

  // Apply the tier floor before the global clamp so deep runs guarantee a
  // respectable overall regardless of individual numbers.
  const raw = Math.max(
    cfg.scale * base + cfg.offset + placementBonus + roleAdjust,
    cfg.placementFloor[tier],
  );
  const overall = clamp(Math.round(raw), cfg.floor, cfg.cap);

  return {
    cardId: `${stats.playerId}@${stats.eventId}`,
    playerId: stats.playerId,
    eventId: stats.eventId,
    teamTag: stats.teamTag,
    role,
    isFlex: roleInfo.isFlex,
    rolesPlayed: roleInfo.rolesPlayed,
    overall,
    subAttributes: subAttributes(stats, cfg),
    breakdown: {
      baseIndividual: Math.round(base * 10) / 10,
      placementBonus,
      roleAdjust,
    },
  };
}

/** Compute all cards for an event given stats rows and a tag -> placement map. */
export function computeCards(
  stats: PlayerEventStats[],
  placementByTag: Map<string, Placement>,
  cfg: OverallConfig = DEFAULT_CONFIG,
): PlayerCard[] {
  return stats.map((s) =>
    computeCard({ stats: s, placement: placementByTag.get(s.teamTag) }, cfg),
  );
}
