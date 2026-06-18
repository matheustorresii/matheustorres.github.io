import type { DraftPlayer, DraftSquad, Role } from "@11a3/domain";

export const ROLE_ORDER: Role[] = ["duelist", "initiator", "controller", "sentinel"];
export const COMP_SIZE = 5;

export type GameMode = "classic" | "almanac";

/** The comp formation chosen at setup: 5 fixed role slots. */
export interface CompTemplate {
  slots: Role[];
}

export const DEFAULT_TEMPLATE: CompTemplate = {
  slots: ["duelist", "duelist", "initiator", "controller", "sentinel"],
};

/** Rerolls (re-draws of the current team) allowed for the whole draft. */
export const rerollsFor = (mode: GameMode): number => (mode === "classic" ? 5 : 1);

/** A drafted entry: a player, the squad they came from, and the (fixed) role slot. */
export interface Pick {
  player: DraftPlayer;
  squad: DraftSquad;
  role: Role;
}
