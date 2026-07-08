import type { Board, Folder } from "../types/model";
import { SCHEMA_VERSION as SV } from "../types/model";
import * as boardsRepo from "../persistence/boardsRepo";
import * as foldersRepo from "../persistence/foldersRepo";
import { makeThumbnail } from "../persistence/thumbnails";
import {
  getTombstones,
  mergeTombstones,
  type Tombstone,
} from "../persistence/tombstones";
import { toPortableJSON, fromPortableJSON } from "./portable";
import { deleteContent, getContent, putContent, type GitHubConfig } from "./github";

const INDEX_PATH = "index.json";
const boardPath = (id: string) => `boards/${id}.json`;

interface RemoteIndex {
  schemaVersion: number;
  updatedAt: number;
  folders: Folder[];
  boards: { id: string; name: string; folderId: string | null; updatedAt: number }[];
  deleted?: Tombstone[]; // deletion markers so removals propagate across devices
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: { id: string; name: string }[];
  error?: string;
}

async function fetchIndex(cfg: GitHubConfig): Promise<{ index: RemoteIndex | null; sha?: string }> {
  const f = await getContent(cfg, INDEX_PATH);
  if (!f) return { index: null };
  try {
    return { index: JSON.parse(f.text) as RemoteIndex, sha: f.sha };
  } catch {
    return { index: null, sha: f.sha };
  }
}

function buildIndex(
  boards: Board[],
  folders: Folder[],
  deleted: Tombstone[],
): RemoteIndex {
  return {
    schemaVersion: SV,
    updatedAt: Date.now(),
    folders,
    boards: boards.map((b) => ({
      id: b.id,
      name: b.name,
      folderId: b.folderId,
      updatedAt: b.updatedAt,
    })),
    deleted,
  };
}

async function pullBoard(cfg: GitHubConfig, id: string): Promise<void> {
  const f = await getContent(cfg, boardPath(id));
  if (!f) return;
  const remote = fromPortableJSON(f.text);
  remote.thumbnailDataUrl = makeThumbnail(remote.elements);
  remote.remoteSha = f.sha;
  remote.baseRemoteUpdatedAt = remote.updatedAt;
  remote.syncState = "synced";
  await boardsRepo.putBoard(remote);
}

async function pushBoard(cfg: GitHubConfig, board: Board): Promise<void> {
  const existing = await getContent(cfg, boardPath(board.id));
  const { sha } = await putContent(
    cfg,
    boardPath(board.id),
    toPortableJSON(board),
    existing?.sha,
    `board: ${board.name}`,
  );
  board.remoteSha = sha;
  board.baseRemoteUpdatedAt = board.updatedAt;
  board.syncState = "synced";
  await boardsRepo.putBoard(board);
}

/**
 * Two-way sync: pull anything the remote has newer, push local changes,
 * and surface last-writer-wins conflicts (both sides changed since last sync)
 * instead of silently overwriting. See spec 06 R-08.
 */
let syncBusy = false; // guards against overlapping syncs (load + hide + manual)

export async function syncAll(cfg: GitHubConfig): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: [] };
  if (syncBusy) {
    result.error = "Sincronização já em andamento.";
    return result;
  }
  syncBusy = true;
  try {
    const { index } = await fetchIndex(cfg);

    // 1. reconcile deletions (tombstones). Merge remote+local markers, then
    //    apply remote deletions locally when nothing newer was edited here.
    const tomb = await mergeTombstones(index?.deleted ?? []);
    const tombById = new Map(tomb.map((t) => [t.id, t]));
    for (const t of tomb) {
      if (t.kind === "board") {
        const b = await boardsRepo.getBoard(t.id);
        if (b && b.updatedAt <= t.deletedAt) await boardsRepo.deleteBoard(t.id);
      } else {
        const f = (await foldersRepo.allFolders()).find((x) => x.id === t.id);
        if (f && f.updatedAt <= t.deletedAt) await foldersRepo.deleteFolder(t.id);
      }
    }

    const localBoards = await boardsRepo.allBoards();
    const localById = new Map(localBoards.map((b) => [b.id, b]));

    // 2. merge remote folders into local (skip tombstoned)
    if (index) {
      const localFolders = await foldersRepo.allFolders();
      const lfById = new Map(localFolders.map((f) => [f.id, f]));
      for (const rf of index.folders) {
        if (tombById.has(rf.id)) continue;
        const lf = lfById.get(rf.id);
        if (!lf || rf.updatedAt > lf.updatedAt) await foldersRepo.putFolder(rf);
      }
    }

    // 3. per-board pull/push/conflict/delete
    const remoteMetas = new Map((index?.boards ?? []).map((m) => [m.id, m]));
    for (const [id, meta] of remoteMetas) {
      if (tombById.has(id)) {
        // deleted somewhere: remove the remote file instead of pulling it back
        const f = await getContent(cfg, boardPath(id));
        if (f) await deleteContent(cfg, boardPath(id), f.sha, `delete board ${id}`);
        continue;
      }
      const local = localById.get(id);
      if (!local) {
        await pullBoard(cfg, id); // brand new remote board
        result.pulled++;
        continue;
      }
      const localChanged = local.updatedAt > (local.baseRemoteUpdatedAt ?? 0);
      const remoteChanged = meta.updatedAt > (local.baseRemoteUpdatedAt ?? 0);
      if (remoteChanged && localChanged) {
        result.conflicts.push({ id, name: local.name });
      } else if (remoteChanged) {
        await pullBoard(cfg, id);
        result.pulled++;
      } else if (localChanged) {
        await pushBoard(cfg, local);
        result.pushed++;
      }
    }

    // 4. push local boards that aren't on the remote yet (and aren't deleted)
    for (const b of localBoards) {
      if (!remoteMetas.has(b.id) && !tombById.has(b.id)) {
        await pushBoard(cfg, b);
        result.pushed++;
      }
    }

    // 5. rewrite the index (carries folders, boards and the deletion markers)
    await writeIndex(cfg, tomb);
    return result;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  } finally {
    syncBusy = false;
  }
}

async function writeIndex(cfg: GitHubConfig, deleted: Tombstone[]): Promise<void> {
  const [boards, folders] = await Promise.all([
    boardsRepo.allBoards(),
    foldersRepo.allFolders(),
  ]);
  const existing = await getContent(cfg, INDEX_PATH);
  await putContent(
    cfg,
    INDEX_PATH,
    JSON.stringify(buildIndex(boards, folders, deleted), null, 2),
    existing?.sha,
    "index",
  );
}

/** Conflict resolution: keep local versions (force push). */
export async function resolveKeepLocal(cfg: GitHubConfig, ids: string[]): Promise<void> {
  for (const id of ids) {
    const b = await boardsRepo.getBoard(id);
    if (b) await pushBoard(cfg, b);
  }
  await writeIndex(cfg, await getTombstones());
}

/** Conflict resolution: discard local, take the remote versions. */
export async function resolveUseRemote(cfg: GitHubConfig, ids: string[]): Promise<void> {
  for (const id of ids) await pullBoard(cfg, id);
}
