/**
 * Attack/defense side identity from a comp's role mix.
 *
 * Duelists and initiators are entry/attack-oriented; controllers and sentinels
 * are hold/defense-oriented. A comp's `attackMod` measures how far it leans
 * toward attack vs a neutral 50/50 split. It's bounded and fed through the same
 * logistic as base strength, so stacking one side helps that side and hurts the
 * other — but never to the point of auto-winning/losing a side.
 */
export const ATTACK_ROLES = new Set(["duelist", "initiator"]);

/**
 * +weight per attack role above the neutral midpoint (half the comp).
 * Role-count only (used in tests); prefer attackModFromComp in the game.
 */
export function attackModFromRoles(roles: string[], weight: number): number {
  if (roles.length === 0 || weight === 0) return 0;
  const attack = roles.filter((r) => ATTACK_ROLES.has(r)).length;
  return (attack - roles.length / 2) * weight;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/**
 * Composition side bias from BOTH the role count and the per-side player
 * quality — but kept small, so the collective team strength still dominates.
 *
 *   attackMod = roleTilt(#attack vs #defense) + qualityTilt(avgAttack − avgDefense)
 *
 * A comp with strong duelists/initiators and weaker controllers/sentinels gets
 * a positive attackMod (better attacking, worse defending), and vice versa.
 */
export function attackModFromComp(
  players: { role: string; overall: number }[],
  roleWeight: number,
  qualityWeight: number,
): number {
  if (players.length === 0) return 0;
  const base = mean(players.map((p) => p.overall));
  const atk = players.filter((p) => ATTACK_ROLES.has(p.role));
  const def = players.filter((p) => !ATTACK_ROLES.has(p.role));
  const avgA = atk.length ? mean(atk.map((p) => p.overall)) : base;
  const avgD = def.length ? mean(def.map((p) => p.overall)) : base;
  const roleTilt = (atk.length - players.length / 2) * roleWeight;
  const qualityTilt = (avgA - avgD) * qualityWeight;
  return roleTilt + qualityTilt;
}

/** Human label for a comp's side tendency. */
export function sideProfile(attackMod: number): string {
  if (attackMod >= 3) return "Ataque forte · defesa frágil";
  if (attackMod >= 1) return "Leve pendor ofensivo";
  if (attackMod <= -3) return "Defesa forte · ataque frágil";
  if (attackMod <= -1) return "Leve pendor defensivo";
  return "Equilibrado nos dois lados";
}
