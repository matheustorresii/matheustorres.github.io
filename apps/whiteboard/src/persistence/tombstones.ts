import { getSetting, setSetting } from "./settingsRepo";

// Deletion markers so removals propagate through sync instead of the item being
// re-pulled from the remote. Stored in the settings store (no DB migration).
export interface Tombstone {
  id: string;
  kind: "board" | "folder";
  deletedAt: number;
}

const KEY = "tombstones";

export async function getTombstones(): Promise<Tombstone[]> {
  return (await getSetting<Tombstone[]>(KEY)) ?? [];
}

export async function addTombstone(id: string, kind: "board" | "folder"): Promise<void> {
  const list = await getTombstones();
  const next = list.filter((t) => t.id !== id);
  next.push({ id, kind, deletedAt: Date.now() });
  await setSetting(KEY, next);
}

/** Merge in a batch, keeping the latest deletedAt per id. */
export async function mergeTombstones(incoming: Tombstone[]): Promise<Tombstone[]> {
  const byId = new Map<string, Tombstone>();
  for (const t of await getTombstones()) byId.set(t.id, t);
  for (const t of incoming) {
    const cur = byId.get(t.id);
    if (!cur || t.deletedAt > cur.deletedAt) byId.set(t.id, t);
  }
  const merged = [...byId.values()];
  await setSetting(KEY, merged);
  return merged;
}
