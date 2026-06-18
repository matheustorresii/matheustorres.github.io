import type { Team } from "@11a3/domain";
import type { RawStatRow } from "./parseStats.js";
import type { RawPlacement } from "./parsePlacements.js";

/** "paper-rex" -> "Paper Rex". Best-effort fallback when no proper name is known. */
export function deslugify(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}

const tokenize = (slug: string) => slug.split("-").filter(Boolean);

// Generic org suffixes that must NOT be treated as a distinctive match signal
// (otherwise "bilibili-gaming" would look like "edward-gaming").
const STOPWORDS = new Set([
  "gaming", "esports", "esport", "team", "gc", "academy", "fc", "club", "sports", "e",
]);

/**
 * Extract the two team slugs from a KMax match href, with the event suffix
 * removed. e.g. "/130679/leviat-n-vs-loud-valorant-champions-2022-ubqf"
 * with eventSlug "valorant-champions-2022" -> ["leviat-n", "loud"].
 */
function slugsFromMatchHref(href: string, eventSlug: string): string[] {
  const path = href.replace(/^\//, "");
  const afterId = path.replace(/^\d+\//, ""); // drop "130679/"
  // The event slug in match URLs varies (e.g. "valorant-champions" without the
  // year, or "champions-tour-2024-..."), so cut at the EARLIEST reliable marker
  // rather than the exact catalog slug. No team slug contains these tokens.
  const markers = [`-${eventSlug}`, "-valorant", "-champions"];
  let cut = -1;
  for (const m of markers) {
    const i = afterId.indexOf(m);
    if (i >= 0 && (cut < 0 || i < cut)) cut = i;
  }
  const core = cut >= 0 ? afterId.slice(0, cut) : afterId;
  return core.split("-vs-").filter(Boolean);
}

export interface ResolvedTeams {
  teams: Team[];
  /** Per tag: how often each candidate slug appeared in that tag's KMax matches. */
  candidatesByTag: Map<string, Map<string, number>>;
}

/**
 * Build one Team per stats tag. The tag is the reliable in-event identity; we
 * also gather candidate VLR slugs from each team's players' KMax match links
 * (each KMax match involves that player's team). A provisional slug/name is the
 * mode, but final identity is fixed later by matchPlacementsToTeams, which is
 * robust to small brackets where finalists share their KMax match.
 */
export function resolveTeams(
  rows: RawStatRow[],
  eventId: string,
  eventSlug: string,
): ResolvedTeams {
  const candidatesByTag = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.teamTag) continue;
    if (!candidatesByTag.has(r.teamTag)) candidatesByTag.set(r.teamTag, new Map());
    const counter = candidatesByTag.get(r.teamTag)!;
    if (!r.kmaxHref) continue;
    for (const slug of slugsFromMatchHref(r.kmaxHref, eventSlug)) {
      counter.set(slug, (counter.get(slug) ?? 0) + 1);
    }
  }

  const teams: Team[] = [];
  for (const [tag, counter] of candidatesByTag) {
    let slug = tag.toLowerCase();
    let best = -1;
    for (const [s, n] of counter) {
      if (n > best) {
        best = n;
        slug = s;
      }
    }
    teams.push({
      id: `${eventId}:${tag}`,
      tag,
      name: deslugify(slug),
      slug,
    });
  }

  teams.sort((a, b) => a.name.localeCompare(b.name));
  return { teams, candidatesByTag };
}

const normTag = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Small tiebreak: does the stats tag look like the placement's team? Capped at
 * 1, strictly below the exact-frequency step (2), so it only separates ties —
 * crucial for finalists whose KMax histories are identical (T1 vs G2, where the
 * tag "t1" matching slug "t1" is the only distinguishing signal).
 */
function tagAffinity(tag: string, p: RawPlacement): number {
  const nt = normTag(tag);
  if (nt.length < 2) return 0;
  const tokens = tokenize(p.slug);
  if (tokens.includes(nt)) return 1;
  if (tokens.some((t) => t.startsWith(nt))) return 0.7;
  if (normTag(p.name).includes(nt)) return 0.4;
  return 0;
}

/** Does a slug look like it belongs to this tag (its own abbreviation)? */
function slugTagAffinity(tag: string, slug: string): number {
  const nt = normTag(tag);
  if (nt.length < 2) return 0;
  const tokens = tokenize(slug);
  if (tokens.includes(nt)) return 5;
  if (tokens.some((t) => t.startsWith(nt))) return 4; // "fur" -> "furia"
  if (slug.replace(/-/g, "").startsWith(nt)) return 3;
  return 0;
}

/**
 * Resolve display slugs/names for teams that have NO placement (eliminated early),
 * as a GLOBAL UNIQUE assignment so two tags never share a slug. The mode of the
 * KMax candidates is unreliable in single-elim (a team that lost once has all its
 * KMax against one opponent, so the opponent's slug can win the mode — that's why
 * FÚRIA showed as "Fnatic" and EDG as "100 Thieves"). Slugs already taken by
 * placed teams are excluded; tag affinity breaks ties toward a team's own slug.
 */
export function assignNonPlacedSlugs(
  teams: Team[],
  candidatesByTag: Map<string, Map<string, number>>,
  placedTags: Set<string>,
): void {
  const taken = new Set<string>();
  for (const t of teams) if (placedTags.has(t.tag)) taken.add(t.slug);

  const triples: { tag: string; slug: string; score: number }[] = [];
  for (const t of teams) {
    if (placedTags.has(t.tag)) continue;
    const cand = candidatesByTag.get(t.tag);
    if (!cand) continue;
    const entries = [...cand.entries()];
    for (const [slug, n] of entries) {
      // Ownership: a team's OWN slug is in all its matches, so it dominates the
      // others; an opponent slug (only in the matches against that team) trails.
      let otherMax = 0;
      for (const [s2, n2] of entries) if (s2 !== slug) otherMax = Math.max(otherMax, n2);
      const ownership = n - otherMax;
      triples.push({ tag: t.tag, slug, score: n + ownership + slugTagAffinity(t.tag, slug) });
    }
  }
  triples.sort((a, b) => b.score - a.score);

  const assignedTag = new Set<string>();
  const slugByTag = new Map<string, string>();
  for (const tr of triples) {
    if (assignedTag.has(tr.tag) || taken.has(tr.slug)) continue;
    assignedTag.add(tr.tag);
    taken.add(tr.slug);
    slugByTag.set(tr.tag, tr.slug);
  }

  for (const t of teams) {
    if (placedTags.has(t.tag)) continue;
    const slug = slugByTag.get(t.tag) ?? t.tag.toLowerCase();
    t.slug = slug;
    t.name = deslugify(slug);
  }
}

/**
 * How well a tag's KMax match history features a placement's team slug.
 * Uses EXACT slug frequency (weighted high) plus distinctive token-containment
 * so a sponsor-renamed standings slug ("kiwoom-drx") still matches the resolved
 * "drx", WITHOUT matching on a generic shared suffix like "-gaming". A small tag
 * affinity term breaks otherwise-symmetric ties.
 */
function placementScore(
  cand: Map<string, number> | undefined,
  p: RawPlacement,
  tag: string,
): number {
  if (!cand) return 0;
  const exact = cand.get(p.slug) ?? 0;
  const pTokens = new Set(tokenize(p.slug));
  let contain = 0;
  let otherMax = 0; // strongest candidate slug that ISN'T this placement
  for (const [slug, n] of cand) {
    if (slug === p.slug) {
      continue;
    }
    otherMax = Math.max(otherMax, n);
    const sTokens = tokenize(slug);
    const subset =
      sTokens.every((t) => pTokens.has(t)) || [...pTokens].every((t) => sTokens.includes(t));
    const distinctive = sTokens.some((t) => pTokens.has(t) && !STOPWORDS.has(t));
    if (subset && distinctive) contain = Math.max(contain, n);
  }
  if (exact === 0 && contain === 0) return 0; // no match history; don't assign on affinity alone
  // Ownership: how dominant this slug is for the tag. For a team's OWN slug this
  // is high; for an opponent artifact (e.g. EDG's "paper-rex") it's ~0 because
  // the team's real slug ties it.
  const ownership = exact - otherMax;
  return exact * 2 + contain + ownership + tagAffinity(tag, p);
}

/**
 * Match authoritative standings rows to stats teams as a GLOBAL max-weight
 * one-to-one assignment (not greedy). The global optimum is what correctly
 * separates finalists who share most of their KMax matches: e.g. LOUD prefers
 * "loud" and OpTic prefers "optic-gaming" jointly, even though each tag's KMax
 * history features both slugs. Returns tag -> placement and upgrades matched
 * teams with the canonical name, slug and VLR team id.
 */
export function matchPlacementsToTeams(
  teams: Team[],
  placements: RawPlacement[],
  candidatesByTag: Map<string, Map<string, number>>,
): Map<string, RawPlacement> {
  const placed = [...placements].sort((a, b) => a.rank - b.rank);

  // Per placement, the tags that plausibly match (score > 0), best first.
  const viable = placed.map((p) =>
    teams
      .map((t) => ({ tag: t.tag, score: placementScore(candidatesByTag.get(t.tag), p, t.tag) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score),
  );

  let best: { score: number; assign: (string | null)[] } = { score: -1, assign: [] };
  const cur: (string | null)[] = [];
  const used = new Set<string>();
  const dfs = (i: number, acc: number) => {
    if (i === placed.length) {
      if (acc > best.score) best = { score: acc, assign: [...cur] };
      return;
    }
    for (const { tag, score } of viable[i]!) {
      if (used.has(tag)) continue;
      used.add(tag);
      cur.push(tag);
      dfs(i + 1, acc + score);
      cur.pop();
      used.delete(tag);
    }
    // Leaving a placement unassigned is allowed (e.g. no resolvable tag).
    cur.push(null);
    dfs(i + 1, acc);
    cur.pop();
  };
  dfs(0, 0);

  const teamByTag = new Map(teams.map((t) => [t.tag, t]));
  const result = new Map<string, RawPlacement>();
  best.assign.forEach((tag, i) => {
    if (!tag) return;
    const p = placed[i]!;
    const team = teamByTag.get(tag)!;
    result.set(tag, p);
    team.name = p.name || team.name;
    team.slug = p.slug;
    team.vlrTeamId = p.vlrTeamId;
    team.id = p.vlrTeamId;
  });
  return result;
}
