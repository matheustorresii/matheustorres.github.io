import type { Role } from "./types.js";

/**
 * Agent -> role mapping. Keyed by the normalized image basename used on VLR
 * (e.g. /img/vlr/game/agents/kayo.png -> "kayo"). Data-driven on purpose:
 * new agents arrive each act, so adding one is a single line here.
 *
 * VERIFY the roster when ingesting a new act. Current state (2026):
 */
export const AGENT_ROLE: Record<string, Role> = {
  // Duelists
  jett: "duelist",
  raze: "duelist",
  reyna: "duelist",
  phoenix: "duelist",
  neon: "duelist",
  yoru: "duelist",
  iso: "duelist",
  waylay: "duelist",
  // Initiators
  sova: "initiator",
  breach: "initiator",
  skye: "initiator",
  kayo: "initiator",
  fade: "initiator",
  gekko: "initiator",
  tejo: "initiator",
  // Controllers
  brimstone: "controller",
  omen: "controller",
  viper: "controller",
  astra: "controller",
  harbor: "controller",
  clove: "controller",
  // Sentinels
  killjoy: "sentinel",
  cypher: "sentinel",
  sage: "sentinel",
  chamber: "sentinel",
  deadlock: "sentinel",
  vyse: "sentinel",
};

/** Pretty names for display, keyed by the same normalized basename. */
export const AGENT_DISPLAY: Record<string, string> = {
  kayo: "KAY/O",
};

/** Normalize an agent image basename or label to the AGENT_ROLE key. */
export function normalizeAgent(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.png$/, "")
    .replace(/[^a-z0-9]/g, "");
}

export function roleOfAgent(rawAgent: string): Role | undefined {
  return AGENT_ROLE[normalizeAgent(rawAgent)];
}

export function agentDisplayName(rawAgent: string): string {
  const key = normalizeAgent(rawAgent);
  return AGENT_DISPLAY[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
