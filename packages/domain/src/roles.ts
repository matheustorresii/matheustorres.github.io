import type { Role } from "./types.js";
import { roleOfAgent } from "./agents.js";

export interface RoleResult {
  role: Role; // primary role
  isFlex: boolean; // plays 2+ roles
  rolesPlayed: Role[]; // distinct roles covered, primary first
}

/**
 * Deduce role from the agent list on the stats page.
 *
 * The VLR stats table lists agents ordered by usage (most played first) but
 * does NOT expose per-agent round counts. So:
 *  - primary role = role of the most-played agent (agents[0]); ties broken by
 *    how many listed agents fall in each role.
 *  - isFlex = the listed agents span 2+ distinct roles.
 *
 * This is a documented Phase 0 heuristic (see DATA_MODEL.md "flex").
 */
export function deduceRole(agents: string[]): RoleResult {
  const roles = agents
    .map((a) => roleOfAgent(a))
    .filter((r): r is Role => r !== undefined);

  if (roles.length === 0) {
    // Unknown agents (e.g. a brand-new agent not yet mapped): default sensibly.
    return { role: "duelist", isFlex: false, rolesPlayed: [] };
  }

  // Distinct roles, preserving first-seen (usage) order.
  const distinct: Role[] = [];
  for (const r of roles) if (!distinct.includes(r)) distinct.push(r);

  const primary = roles[0]!; // role of the most-played agent

  // Flex is decided on the TWO most-played agents only, so a single situational
  // third pick doesn't flag a specialist as flex. (Heuristic — we lack per-agent
  // round counts; see DATA_MODEL.md.)
  const topTwoRoles = new Set(roles.slice(0, 2));

  return {
    role: primary,
    isFlex: topTwoRoles.size >= 2,
    rolesPlayed: distinct,
  };
}
