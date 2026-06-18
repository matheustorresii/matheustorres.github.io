// Core domain types for 5a0. Code/identifiers in English; UI strings live in the web app.

export type Role = "duelist" | "initiator" | "controller" | "sentinel";

export type EventType = "champions" | "masters" | "lockin" | "other";

/** Placement buckets used by the overall formula. Order = best to worst. */
export type PlacementTier =
  | "champion"
  | "runnerUp"
  | "top4"
  | "top8"
  | "top12"
  | "groups";

/** Canonical, event-independent identity of a player (keyed by VLR player id). */
export interface Player {
  id: string; // VLR player id, e.g. "8549"
  handle: string; // clean game name from the URL slug, e.g. "kingg"
  displayName: string; // pretty casing as shown on VLR, e.g. "kiNgg"
}

/** A team as it appears in a single event. */
export interface Team {
  id: string; // VLR team id when resolvable, else synthetic `${eventId}:${tag}`
  tag: string; // short tag glued to player names on the stats page, e.g. "LEV"
  name: string; // full display name, e.g. "Leviatán"
  slug: string; // VLR slug, e.g. "leviat-n"
  vlrTeamId?: string; // VLR team id if found on the overview page
}

export interface EventInfo {
  id: string; // "1015"
  slug: string; // "valorant-champions-2022"
  name: string; // "Valorant Champions 2022"
  year: number;
  type: EventType;
  sourceUrls: { stats: string; overview: string };
}

/** One row of the VLR per-event stats table. */
export interface PlayerEventStats {
  playerId: string;
  eventId: string;
  teamTag: string; // links the row to a Team within the event
  agents: string[]; // canonical agent names, ordered by usage (most played first)
  rounds: number; // Rnd
  r20: number; // R2.0
  acs: number; // ACS
  kd: number; // K:D
  kast: number; // KAST %, stored as a number (e.g. 77)
  adr: number; // ADR
  kpr: number; // KPR
  apr: number; // APR
  fkpr: number; // FKPR
  fdpr: number; // FDPR
  hsPct: number; // HS %
  clPct: number; // CL % (clutch success)
  k: number;
  d: number;
  a: number;
  fk: number;
  fd: number;
}

export interface Placement {
  eventId: string;
  teamTag: string;
  tier: PlacementTier;
  rank: number; // lower bound of the placement, 1 = champion
  label: string; // raw display label, e.g. "7º–8º" / "Campeão"
}

export interface SubAttributes {
  aim: number; // Mira
  firepower: number; // Poder de fogo
  clutch: number; // Clutch
  consistency: number; // Consistência
  support: number; // Suporte
}

/** Derived draftable unit: a player at a specific event. */
export interface PlayerCard {
  cardId: string; // `${playerId}@${eventId}`
  playerId: string;
  eventId: string;
  teamTag: string;
  role: Role;
  isFlex: boolean;
  rolesPlayed: Role[];
  overall: number; // 0–99
  subAttributes: SubAttributes;
  breakdown: {
    baseIndividual: number;
    placementBonus: number;
    roleAdjust: number;
  };
}

/** Self-contained payload the inspector loads per event. */
export interface EventFile {
  event: EventInfo;
  teams: Team[];
  placements: Placement[];
  players: Player[];
  stats: PlayerEventStats[];
  cards: PlayerCard[];
  meta: { scrapedAt: string; pipelineVersion: string };
}

/** Lightweight entry for the global event index consumed by the selector. */
export interface EventIndexEntry {
  id: string;
  name: string;
  year: number;
  type: EventType;
}

/** A draftable player inside a squad (a player at a specific event). */
export interface DraftPlayer {
  playerId: string;
  displayName: string;
  role: Role;
  isFlex: boolean;
  rolesPlayed: Role[];
  overall: number;
}

/** A roll unit in the draft: one team AT one championship, with its players. */
export interface DraftSquad {
  key: string; // `${eventId}:${teamTag}`
  eventId: string;
  eventName: string;
  year: number;
  type: EventType;
  teamTag: string;
  teamName: string;
  teamKey: string; // normalized team name, to find "same team, other championship"
  players: DraftPlayer[];
}
