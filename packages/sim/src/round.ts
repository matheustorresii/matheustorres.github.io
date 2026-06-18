import type { RoundParams } from "./config.js";

export const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Probability team A wins a single round given effective strengths.
 *
 * p = logistic(k * (effA - effB) * diffScale / scaleD), clamped to [minP, maxP].
 *
 * v1 calls this with raw team strengths and diffScale = 1. v2 passes
 * side/eco/momentum-adjusted strengths and uses diffScale to dampen pistols.
 * At effA == effB the result is exactly 0.5.
 */
export function roundProbabilityA(
  effA: number,
  effB: number,
  params: RoundParams,
  diffScale = 1,
): number {
  const d = (effA - effB) * diffScale;
  const p = logistic((params.k * d) / params.scaleD);
  return clamp(p, params.minP, params.maxP);
}
