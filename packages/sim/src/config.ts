/**
 * All simulation knobs in one place. Defaults are the recommended starting
 * point from SIMULATION.md; tweak here to change the "feel". See each field.
 */

export type RoundModelVersion = "v1" | "v2";

export interface RoundParams {
  version: RoundModelVersion;

  /** Logistic slope. Higher = more deterministic (fewer upsets). */
  k: number;
  /** Overall points of strength difference worth one logistic unit. */
  scaleD: number;
  /** Hard clamp so a round is never a literal 0% / 100%. */
  minP: number;
  maxP: number;

  // ---- v2 only (ignored by v1) ----
  /** Defender-side strength bonus (Valorant tends to favor defense early). */
  sideBias: number;
  /** Strength per attack-leaning role above the comp midpoint (composition side bias). */
  sideRoleWeight: number;
  /**
   * How much the QUALITY gap between a comp's attack-side and defense-side
   * players tilts each side. Kept small so the collective (base strength)
   * dominates over which players sit on which side.
   */
  sideQualityWeight: number;
  /** Pistol rounds (1 and 13) shrink the strength gap toward a coin flip. */
  pistolDamp: number;
  /** Strength swing applied to the pistol winner's team on the next 2 rounds (eco/anti-eco). */
  ecoSwing: number;
  /** Strength bonus per consecutive round won, capped. */
  momentumPerWin: number;
  momentumCap: number;
}

export interface MapPool {
  maps: string[];
}

export interface BestOfConfig {
  groups: number; // e.g. 3 (MD3)
  upper: number;
  lower: number; // lower-bracket rounds before the lower final
  lowerFinal: number; // e.g. 5 (MD5) — last match before the grand final
  grandFinal: number; // e.g. 5 (MD5)
}

export interface TournamentConfig {
  groups: {
    count: number; // number of groups
    teamsPerGroup: number;
    advancePerGroup: number; // qualify to playoffs
  };
  /** Playoff bracket size. v1 supports 8-team double elimination. */
  playoffSize: 8;
  bestOf: BestOfConfig;
  mapPool: MapPool;
  round: RoundParams;
}

export const DEFAULT_ROUND_V1: RoundParams = {
  version: "v1",
  k: 1.0,
  scaleD: 6,
  minP: 0.02,
  maxP: 0.98,
  // v2 fields present but unused by v1:
  sideBias: 0,
  sideRoleWeight: 0,
  sideQualityWeight: 0,
  pistolDamp: 1,
  ecoSwing: 0,
  momentumPerWin: 0,
  momentumCap: 0,
};

export const DEFAULT_ROUND_V2: RoundParams = {
  version: "v2",
  k: 1.0,
  scaleD: 6,
  minP: 0.02,
  maxP: 0.98,
  sideBias: 1.5, // defense slightly favored
  sideRoleWeight: 1.5, // small tilt from how many attack vs defense roles
  sideQualityWeight: 0.12, // small tilt from attack-players quality vs defense-players
  pistolDamp: 0.4, // pistols are much closer to a coin flip
  ecoSwing: 4, // winning pistol meaningfully helps the next 2 rounds
  momentumPerWin: 0.6,
  momentumCap: 3, // up to +3 strength from a hot streak
};

/**
 * Tuned profile used by the campaign: flatter logistic (so big strength gaps
 * don't blow out into 13-0/13-1) with the full v2 layer, including the
 * attack/defense composition bias. This is what the game actually plays with.
 */
export const DEFAULT_ROUND_CAMPAIGN: RoundParams = {
  ...DEFAULT_ROUND_V2,
  scaleD: 24,
  minP: 0.14,
  maxP: 0.86,
};

/**
 * Valorant Champions map pool — ROTATES per act, so it's data-driven and must
 * be VERIFIED per event. Default below is a representative 7-map pool; override
 * via TournamentConfig.mapPool when simulating a specific event.
 */
export const DEFAULT_MAP_POOL: MapPool = {
  maps: ["Ascent", "Bind", "Haven", "Lotus", "Sunset", "Abyss", "Breeze"],
};

/**
 * Counter-Strike map pool (Active Duty-style). The CS edition reuses the exact
 * same round/map engine (first-to-13, OT by 2, pistols at rounds 1 & 13), so
 * only the pool differs here. Verify per-event when ingesting a specific Major.
 */
export const DEFAULT_CS_MAP_POOL: MapPool = {
  maps: ["Mirage", "Inferno", "Nuke", "Overpass", "Ancient", "Anubis", "Dust2"],
};

export const DEFAULT_TOURNAMENT: TournamentConfig = {
  groups: { count: 4, teamsPerGroup: 4, advancePerGroup: 2 },
  playoffSize: 8,
  bestOf: { groups: 3, upper: 3, lower: 3, lowerFinal: 5, grandFinal: 5 },
  mapPool: DEFAULT_MAP_POOL,
  round: DEFAULT_ROUND_V1,
};
