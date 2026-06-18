/**
 * Aggregate a comp's 5 overalls into a single team strength.
 *
 * v1 default = simple mean (transparent, easy to calibrate). A weighted variant
 * is available (slightly higher weight to the top performers), off by default.
 */
export interface StrengthOptions {
  /** If > 0, sort overalls desc and apply geometric weights w^i. 0 = plain mean. */
  topWeight?: number;
}

export function strengthOf(overalls: number[], opts: StrengthOptions = {}): number {
  if (overalls.length === 0) return 0;
  const w = opts.topWeight ?? 0;
  if (w <= 0) {
    return overalls.reduce((s, x) => s + x, 0) / overalls.length;
  }
  const sorted = [...overalls].sort((a, b) => b - a);
  let num = 0;
  let den = 0;
  sorted.forEach((ovr, i) => {
    const weight = Math.pow(w, i);
    num += ovr * weight;
    den += weight;
  });
  return num / den;
}
