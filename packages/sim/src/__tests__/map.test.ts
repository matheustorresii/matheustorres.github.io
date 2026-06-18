import { describe, it, expect } from "vitest";
import { isMapOver, simulateMap } from "../map.js";
import { simulateSeries } from "../series.js";
import { createRng } from "../rng.js";
import { DEFAULT_ROUND_V1, DEFAULT_ROUND_V2, DEFAULT_MAP_POOL } from "../config.js";
import type { SimTeam } from "../types.js";

const team = (id: string, strength: number): SimTeam => ({ id, name: id, strength });

describe("isMapOver — exact Valorant rules", () => {
  it("regulation: 13 wins when opponent <= 11", () => {
    expect(isMapOver(13, 0)).toBe(true);
    expect(isMapOver(13, 11)).toBe(true);
    expect(isMapOver(11, 13)).toBe(true);
  });

  it("13-12 does NOT end (must reach 14 in OT)", () => {
    expect(isMapOver(13, 12)).toBe(false);
    expect(isMapOver(12, 13)).toBe(false);
  });

  it("12-12 goes to overtime", () => {
    expect(isMapOver(12, 12)).toBe(false);
  });

  it("overtime requires a 2-round lead", () => {
    expect(isMapOver(13, 13)).toBe(false);
    expect(isMapOver(14, 13)).toBe(false);
    expect(isMapOver(14, 12)).toBe(true);
    expect(isMapOver(15, 13)).toBe(true);
    expect(isMapOver(16, 14)).toBe(true);
    expect(isMapOver(13, 15)).toBe(true);
  });

  it("not over before anyone reaches a winning score", () => {
    expect(isMapOver(12, 10)).toBe(false);
    expect(isMapOver(0, 0)).toBe(false);
  });
});

describe("simulateMap — terminal states", () => {
  for (const params of [DEFAULT_ROUND_V1, DEFAULT_ROUND_V2]) {
    it(`always ends in a valid terminal score (${params.version})`, () => {
      const rng = createRng(123);
      for (let i = 0; i < 500; i++) {
        const a = team("A", 70 + rng.next() * 25);
        const b = team("B", 70 + rng.next() * 25);
        const m = simulateMap(a, b, "Ascent", params, rng);
        // Final score is a terminal state.
        expect(isMapOver(m.scoreA, m.scoreB)).toBe(true);
        // The score right before the last round was NOT terminal.
        const last = m.rounds[m.rounds.length - 1]!;
        const prevA = last.winner === "a" ? m.scoreA - 1 : m.scoreA;
        const prevB = last.winner === "b" ? m.scoreB - 1 : m.scoreB;
        expect(isMapOver(prevA, prevB)).toBe(false);
        // Winner has the higher score; scores never tie at the end.
        expect(m.scoreA).not.toBe(m.scoreB);
        expect(m.winner).toBe(m.scoreA > m.scoreB ? "a" : "b");
        // Winner reached at least 13.
        expect(Math.max(m.scoreA, m.scoreB)).toBeGreaterThanOrEqual(13);
      }
    });
  }

  it("is deterministic for a given seed", () => {
    const m1 = simulateMap(team("A", 85), team("B", 78), "Bind", DEFAULT_ROUND_V2, createRng(42));
    const m2 = simulateMap(team("A", 85), team("B", 78), "Bind", DEFAULT_ROUND_V2, createRng(42));
    expect(m1).toEqual(m2);
  });

  it("equal strength gives a 50% first round in v1", () => {
    const m = simulateMap(team("A", 80), team("B", 80), "Haven", DEFAULT_ROUND_V1, createRng(7));
    expect(m.rounds[0]!.pWinA).toBeCloseTo(0.5, 5);
  });
});

describe("simulateSeries — best-of", () => {
  it("MD3 ends at 2 map wins, MD5 at 3", () => {
    const md3 = simulateSeries(team("A", 88), team("B", 70), 3, DEFAULT_MAP_POOL, DEFAULT_ROUND_V1, createRng(1));
    expect(Math.max(md3.mapsA, md3.mapsB)).toBe(2);
    expect(md3.maps.length).toBeLessThanOrEqual(3);

    const md5 = simulateSeries(team("A", 88), team("B", 70), 5, DEFAULT_MAP_POOL, DEFAULT_ROUND_V1, createRng(1));
    expect(Math.max(md5.mapsA, md5.mapsB)).toBe(3);
    expect(md5.maps.length).toBeLessThanOrEqual(5);
  });
});
