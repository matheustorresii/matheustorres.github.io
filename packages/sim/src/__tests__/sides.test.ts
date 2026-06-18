import { describe, it, expect } from "vitest";
import { attackModFromRoles, attackModFromComp } from "../sides.js";
import { simulateMap } from "../map.js";
import { createRng } from "../rng.js";
import { DEFAULT_ROUND_V2 } from "../config.js";
import type { SimTeam } from "../types.js";

describe("attackModFromRoles", () => {
  const W = 3;
  it("leans positive for attack-heavy comps, negative for defense-heavy", () => {
    expect(attackModFromRoles(["duelist", "duelist", "duelist", "initiator", "initiator"], W)).toBeCloseTo(7.5);
    expect(attackModFromRoles(["controller", "controller", "sentinel", "sentinel", "initiator"], W)).toBeCloseTo(-4.5);
    expect(attackModFromRoles(["duelist", "initiator", "controller", "sentinel", "duelist"], W)).toBeCloseTo(1.5);
  });
  it("is zero with no weight or no roles", () => {
    expect(attackModFromRoles(["duelist", "duelist"], 0)).toBe(0);
    expect(attackModFromRoles([], W)).toBe(0);
  });
});

describe("attackModFromComp — quality tilts a little, collective dominates", () => {
  const RW = 1.5, QW = 0.12;
  // 3 attack roles, 2 defense roles (the user's comp shape).
  const strongAtk = [
    { role: "duelist", overall: 90 },
    { role: "duelist", overall: 83 },
    { role: "initiator", overall: 84 },
    { role: "controller", overall: 66 },
    { role: "sentinel", overall: 74 },
  ];
  const evenQuality = [
    { role: "duelist", overall: 79 },
    { role: "duelist", overall: 79 },
    { role: "initiator", overall: 79 },
    { role: "controller", overall: 79 },
    { role: "sentinel", overall: 79 },
  ];

  it("strong attackers + weak defenders lean attack more than equal quality", () => {
    const a = attackModFromComp(strongAtk, RW, QW);
    const b = attackModFromComp(evenQuality, RW, QW);
    expect(a).toBeGreaterThan(b); // quality gap adds attack lean
    expect(a).toBeLessThan(8); // but stays small (collective dominates)
    expect(a).toBeGreaterThan(0);
  });

  it("flips negative when defense players are the strong ones", () => {
    const strongDef = [
      { role: "duelist", overall: 60 },
      { role: "initiator", overall: 62 },
      { role: "controller", overall: 90 },
      { role: "sentinel", overall: 88 },
      { role: "sentinel", overall: 85 },
    ];
    expect(attackModFromComp(strongDef, RW, QW)).toBeLessThan(0);
  });
});

describe("composition side bias affects rounds by side", () => {
  it("an attack-stacked comp wins more attacking than defending — but not all/none", () => {
    const a: SimTeam = { id: "A", name: "A", strength: 75, attackMod: 7.5 };
    const b: SimTeam = { id: "B", name: "B", strength: 75, attackMod: 0 };

    let atkWins = 0, atkRounds = 0, defWins = 0, defRounds = 0;
    const rng = createRng(2024);
    for (let i = 0; i < 1500; i++) {
      const m = simulateMap(a, b, "Map", DEFAULT_ROUND_V2, rng);
      for (const r of m.rounds) {
        if (r.attacker === "a") {
          atkRounds++;
          if (r.winner === "a") atkWins++;
        } else {
          defRounds++;
          if (r.winner === "a") defWins++;
        }
      }
    }
    const atkRate = atkWins / atkRounds;
    const defRate = defWins / defRounds;

    // Attacking is clearly better for this comp...
    expect(atkRate).toBeGreaterThan(defRate + 0.1);
    // ...but it neither wins every attack round nor loses every defense round.
    expect(atkRate).toBeLessThan(0.85);
    expect(defRate).toBeGreaterThan(0.15);
  });
});
