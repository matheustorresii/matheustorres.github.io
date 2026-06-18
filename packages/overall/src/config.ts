import type { PlacementTier, Role } from "@11a3/domain";

/**
 * All overall coefficients live here. Tweaking the "feel" of the game = editing
 * this file, never the logic in overall.ts. See OVERALL.md for rationale.
 */

/** Fixed min/max anchors map a raw stat to a 0..100 normalized score. */
export interface Anchor {
  lo: number; // value that maps to 0
  hi: number; // value that maps to 100
}

export interface OverallConfig {
  /** Anchors for the individual-base metrics. Event-agnostic for cross-event comparability. */
  anchors: {
    r20: Anchor;
    acs: Anchor;
    kast: Anchor;
    kd: Anchor;
    adr: Anchor;
  };
  /** Weights of the individual base (should sum to 1.0). R2.0 dominates but not alone. */
  baseWeights: {
    r20: number;
    acs: number;
    kast: number;
    kd: number;
    adr: number;
  };
  /** Maps the 0..100 base into a realistic overall band before bonuses. */
  scale: number; // multiplier on base
  offset: number; // additive floor of the band
  floor: number; // hard minimum overall
  cap: number; // hard maximum overall

  /** Team-campaign bonus by placement tier. THIS is what lets a champion outvalue a better individual. */
  placementBonus: Record<PlacementTier, number>;

  /**
   * Minimum overall guaranteed by reaching a tier. Ensures deep-run, high-impact
   * players aren't dragged down by modest individual numbers (e.g. an IGL who
   * reached the grand final). 0 = no floor for that tier.
   */
  placementFloor: Record<PlacementTier, number>;

  /**
   * Small per-role nudge so support/IGL roles (controllers/initiators) aren't
   * undervalued by raw fragging stats. Kept small on purpose. Disable by zeroing.
   */
  roleAdjust: Record<Role, number>;

  /** Anchors used only for the cosmetic FIFA-style sub-attributes. */
  subAnchors: {
    hsPct: Anchor;
    acs: Anchor;
    kpr: Anchor;
    fkpr: Anchor;
    clPct: Anchor;
    apr: Anchor;
    aPerRound: Anchor;
    kast: Anchor;
  };
}

export const DEFAULT_CONFIG: OverallConfig = {
  anchors: {
    r20: { lo: 0.7, hi: 1.4 },
    acs: { lo: 130, hi: 300 },
    kast: { lo: 60, hi: 85 },
    kd: { lo: 0.7, hi: 1.6 },
    adr: { lo: 100, hi: 200 },
  },
  baseWeights: {
    r20: 0.5,
    acs: 0.18,
    kast: 0.14,
    kd: 0.1,
    adr: 0.08,
  },
  scale: 0.6,
  offset: 36,
  floor: 40,
  cap: 99,
  // Team-campaign boost. Deliberately strong so historic, deep-run players are
  // valued for the campaign even when their individual numbers are modest.
  placementBonus: {
    champion: 20,
    runnerUp: 15,
    top4: 10,
    top8: 5,
    top12: 2,
    groups: 0,
  },
  placementFloor: {
    champion: 75,
    runnerUp: 70,
    top4: 63,
    top8: 0,
    top12: 0,
    groups: 0,
  },
  // Support/IGL roles sacrifice fragging stats — a slightly larger nudge so the
  // in-game leaders aren't undervalued.
  roleAdjust: {
    controller: 3,
    initiator: 2,
    sentinel: 1,
    duelist: 0,
  },
  subAnchors: {
    hsPct: { lo: 10, hi: 40 },
    acs: { lo: 130, hi: 300 },
    kpr: { lo: 0.4, hi: 1.0 },
    fkpr: { lo: 0.0, hi: 0.3 },
    clPct: { lo: 0, hi: 40 },
    apr: { lo: 0.1, hi: 0.7 },
    aPerRound: { lo: 0.1, hi: 0.7 },
    kast: { lo: 55, hi: 85 },
  },
};
