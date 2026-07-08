import type { Board, Folder } from "../types/model";
import { SCHEMA_VERSION as SV } from "../types/model";
import * as boardsRepo from "../persistence/boardsRepo";
import * as foldersRepo from "../persistence/foldersRepo";
import { makeThumbnail } from "../persistence/thumbnails";
import { toPortableJSON, fromPortableJSON } from "./portable";
import { getContent, putContent, type GitHubConfig } from "./github";

const INDEX_PATH = "index.json";
const boardPath = (id: string) => `boards/${id}.json`;

interface RemoteIndex {
  schemaVersion: number;
  updatedAt: number;
  folders: Folder[];
  boards: { id: string; name: string; folderId: string | null; updatedAt: number }[];
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

function buildIndex(boards: Board[], folders: Folder[]): RemoteIndex {
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
    const localBoards = await boardsRepo.allBoards();
    const localById = new Map(localBoards.map((b) => [b.id, b]));

    // merge remote folders into local (upsert by id)
    if (index) {
      const localFolders = await foldersRepo.allFolders();
      const lfById = new Map(localFolders.map((f) => [f.id, f]));
      for (const rf of index.folders) {
        const lf = lfById.get(rf.id);
        if (!lf || rf.updatedAt > lf.updatedAt) await foldersRepo.putFolder(rf);
      }
    }

    // decide per-board pull/push/conflict
    const remoteMetas = new Map((index?.boards ?? []).map((m) => [m.id, m]));
    for (const [id, meta] of remoteMetas) {
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

    // push local boards that don't exist on the remote yet
    for (const b of localBoards) {
      if (!remoteMetas.has(b.id)) {
        await pushBoard(cfg, b);
        result.pushed++;
      }
    }

    // rewrite the index from the current local state
    await writeIndex(cfg);
    return result;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  } finally {
    syncBusy = false;
  }
}

async function writeIndex(cfg: GitHubConfig): Promise<void> {
  const [boards, folders] = await Promise.all([
    boardsRepo.allBoards(),
    foldersRepo.allFolders(),
  ]);
  const existing = await getContent(cfg, INDEX_PATH);
  await putContent(
    cfg,
    INDEX_PATH,
    JSON.stringify(buildIndex(boards, folders), null, 2),
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
  await writeIndex(cfg);
}

/** Conflict resolution: discard local, take the remote versions. */
export async function resolveUseRemote(cfg: GitHubConfig, ids: string[]): Promise<void> {
  for (const id of ids) await pullBoard(cfg, id);
}
