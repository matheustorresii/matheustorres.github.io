import { describe, it, expect } from "vitest";
import { simulateDoubleElim8, simulateTournament } from "../bracket.js";
import { createRng } from "../rng.js";
import { DEFAULT_TOURNAMENT, DEFAULT_ROUND_V1, DEFAULT_ROUND_V2 } from "../config.js";
import type { SimTeam } from "../types.js";

const mk = (n: number, strength: number): SimTeam => ({ id: `T${n}`, name: `T${n}`, strength });

describe("simulateDoubleElim8", () => {
  const seeds = Array.from({ length: 8 }, (_, i) => mk(i + 1, 90 - i * 2));

  it("produces 8 distinct final placements with a champion and a vice", () => {
    const r = simulateDoubleElim8(seeds, DEFAULT_TOURNAMENT, DEFAULT_ROUND_V1, createRng(1), []);
    expect(r.standings).toHaveLength(8);
    const ids = new Set(r.standings.map((s) => s.team.id));
    expect(ids.size).toBe(8); // every seed placed exactly once
    expect(r.standings[0]!.team.id).toBe(r.champion.id);
    expect(r.standings[1]!.team.id).toBe(r.runnerUp.id);
    expect(r.champion.id).not.toBe(r.runnerUp.id);
  });

  it("is deterministic per seed", () => {
    const a = simulateDoubleElim8(seeds, DEFAULT_TOURNAMENT, DEFAULT_ROUND_V2, createRng(99), []);
    const b = simulateDoubleElim8(seeds, DEFAULT_TOURNAMENT, DEFAULT_ROUND_V2, createRng(99), []);
    expect(a.champion.id).toBe(b.champion.id);
    expect(a.standings.map((s) => s.team.id)).toEqual(b.standings.map((s) => s.team.id));
  });

  it("a dominant team wins the bracket far more often than chance", () => {
    const field = (seedNum: number) =>
      Array.from({ length: 8 }, (_, i) =>
        mk(i + 1, i === 0 ? 95 : 72 + (i % 3)),
      );
    let titles = 0;
    const N = 200;
    for (let s = 0; s < N; s++) {
      const r = simulateDoubleElim8(field(s), DEFAULT_TOURNAMENT, DEFAULT_ROUND_V1, createRng(s), []);
      if (r.champion.id === "T1") titles++;
    }
    // Random would be ~1/8 = 12.5%. A +23 strength edge should dominate.
    expect(titles / N).toBeGreaterThan(0.5);
  });
});

describe("simulateTournament", () => {
  it("runs groups -> double elim and the best team wins most often", () => {
    const teams: SimTeam[] = [
      mk(1, 95), // clear favorite
      ...Array.from({ length: 15 }, (_, i) => mk(i + 2, 70 + (i % 5))),
    ];
    let titles = 0;
    const N = 120;
    for (let s = 0; s < N; s++) {
      const r = simulateTournament(teams, DEFAULT_TOURNAMENT, DEFAULT_ROUND_V1, createRng(s));
      expect(r.standings).toHaveLength(8);
      expect(r.seeds).toHaveLength(8);
      if (r.champion.id === "T1") titles++;
    }
    expect(titles / N).toBeGreaterThan(0.4);
  });
});
