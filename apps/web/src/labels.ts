import type { PlacementTier, Role } from "@11a3/domain";

export const TIER_LABEL_PT: Record<PlacementTier, string> = {
  champion: "Campeão",
  runnerUp: "Vice",
  top4: "Top 4",
  top8: "Top 8",
  top12: "Top 12",
  groups: "Fase de grupos",
};

export const ROLE_LABEL_PT: Record<Role, string> = {
  duelist: "Duelista",
  initiator: "Iniciador",
  controller: "Controlador",
  sentinel: "Sentinela",
};

export const ROLE_ABBR_PT: Record<Role, string> = {
  duelist: "DUE",
  initiator: "INI",
  controller: "CON",
  sentinel: "SEN",
};

/** Color band for an overall, FIFA-card style. */
export function overallClass(overall: number): string {
  if (overall >= 88) return "ovr ovr-elite";
  if (overall >= 82) return "ovr ovr-gold";
  if (overall >= 75) return "ovr ovr-silver";
  if (overall >= 68) return "ovr ovr-bronze";
  return "ovr ovr-base";
}
