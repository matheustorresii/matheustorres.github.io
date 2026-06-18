import type { RoundParams } from "./config.js";
import type { MapResult, RoundResult, SimTeam } from "./types.js";
import type { Rng } from "./rng.js";
import { roundProbabilityA } from "./round.js";

/**
 * Map is over when:
 *  - a team reaches 13 with the opponent on <= 11 (13-0 .. 13-11), OR
 *  - in overtime (>= 14) a team leads by exactly 2.
 * 12-12 does NOT end; it goes to OT, won by 2 (14-12, 15-13, 16-14, ...).
 */
export function isMapOver(a: number, b: number): boolean {
  if (a >= 13 && a - b >= 2 && b <= 11) return true;
  if (b >= 13 && b - a >= 2 && a <= 11) return true;
  if (a >= 14 && a - b >= 2) return true;
  if (b >= 14 && b - a >= 2) return true;
  return false;
}

/** Which team attacks on a given 1-based round number. A attacks the first half. */
function attackerOf(roundNumber: number): "a" | "b" {
  if (roundNumber <= 12) return "a"; // first half
  if (roundNumber <= 24) return "b"; // second half
  return (roundNumber - 25) % 2 === 0 ? "a" : "b"; // OT alternates
}

interface EcoState {
  delta: number; // strength delta currently applied
  rounds: number; // rounds remaining
}

export function simulateMap(
  teamA: SimTeam,
  teamB: SimTeam,
  name: string,
  params: RoundParams,
  rng: Rng,
): MapResult {
  let scoreA = 0;
  let scoreB = 0;
  const rounds: RoundResult[] = [];

  let lastWinner: "a" | "b" | null = null;
  let streak = 0;
  const eco: Record<"a" | "b", EcoState> = {
    a: { delta: 0, rounds: 0 },
    b: { delta: 0, rounds: 0 },
  };

  const momentumBonus = () =>
    Math.min(streak * params.momentumPerWin, params.momentumCap);

  while (!isMapOver(scoreA, scoreB)) {
    const number = scoreA + scoreB + 1;
    if (number > 100) throw new Error("map did not terminate"); // safety; impossible with minP>0

    const attacker = attackerOf(number);
    const defender = attacker === "a" ? "b" : "a";
    const isPistol = number === 1 || number === 13;

    let effA = teamA.strength;
    let effB = teamB.strength;

    // Composition side bias: a team is stronger attacking if its roles lean
    // attack, and weaker defending (and vice versa). 0 for v1 / neutral comps.
    const amA = teamA.attackMod ?? 0;
    const amB = teamB.attackMod ?? 0;
    effA += attacker === "a" ? amA : -amA;
    effB += attacker === "b" ? amB : -amB;

    // Global defender bonus (Valorant tends to favor defense early).
    if (defender === "a") effA += params.sideBias;
    else effB += params.sideBias;

    // Momentum on the team riding the current streak.
    if (lastWinner && streak > 0) {
      if (lastWinner === "a") effA += momentumBonus();
      else effB += momentumBonus();
    }

    // Economy carry-over from a prior pistol.
    effA += eco.a.delta;
    effB += eco.b.delta;

    const pWinA = roundProbabilityA(effA, effB, params, isPistol ? params.pistolDamp : 1);
    const winner: "a" | "b" = rng.next() < pWinA ? "a" : "b";

    if (winner === "a") scoreA++;
    else scoreB++;

    rounds.push({ number, winner, scoreA, scoreB, attacker, isPistol, pWinA });

    // Update momentum.
    if (winner === lastWinner) streak++;
    else {
      streak = 1;
      lastWinner = winner;
    }

    // Decay economy effects, then (re)set them after a pistol.
    for (const t of ["a", "b"] as const) {
      if (eco[t].rounds > 0) {
        eco[t].rounds--;
        if (eco[t].rounds === 0) eco[t].delta = 0;
      }
    }
    if (isPistol && params.ecoSwing !== 0) {
      const loser = winner === "a" ? "b" : "a";
      eco[winner] = { delta: +params.ecoSwing, rounds: 2 }; // anti-eco next 2 rounds
      eco[loser] = { delta: -params.ecoSwing, rounds: 2 }; // forced/eco next 2 rounds
    }
  }

  return {
    name,
    winner: scoreA > scoreB ? "a" : "b",
    scoreA,
    scoreB,
    rounds,
  };
}
