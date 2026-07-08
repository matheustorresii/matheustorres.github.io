import { create } from "zustand";
import type { Board, BoardMeta, Folder } from "../types/model";
import { DEFAULT_STYLE, SCHEMA_VERSION } from "../types/model";
import { newId } from "../lib/id";
import * as boardsRepo from "../persistence/boardsRepo";
import * as foldersRepo from "../persistence/foldersRepo";

interface LibraryState {
  folders: Folder[];
  boards: BoardMeta[];
  loaded: boolean;
  refresh: () => Promise<void>;
  createBoard: (folderId: string | null) => Promise<Board>;
  renameBoard: (id: string, name: string) => Promise<void>;
  duplicateBoard: (id: string) => Promise<Board | null>;
  removeBoard: (id: string) => Promise<void>;
  moveBoard: (id: string, folderId: string | null) => Promise<void>;
  createFolder: (parentId: string | null, name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  moveFolder: (id: string, parentId: string | null) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;
}

function newBoard(folderId: string | null): Board {
  const now = Date.now();
  return {
    id: newId(),
    name: "Sem título",
    folderId,
    elements: [],
    appState: {
      viewport: { scale: 1, offsetX: 0, offsetY: 0 },
      defaults: { ...DEFAULT_STYLE },
    },
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    syncState: "local-only",
  };
}

/** Descendant folder ids of `id`, inclusive, using the current folder list. */
function descendantFolderIds(folders: Folder[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folders: [],
  boards: [],
  loaded: false,

  refresh: async () => {
    const [folders, boards] = await Promise.all([
      foldersRepo.allFolders(),
      boardsRepo.boardMetas(),
    ]);
    folders.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    boards.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ folders, boards, loaded: true });
  },

  createBoard: async (folderId) => {
    const board = newBoard(folderId);
    await boardsRepo.putBoard(board);
    await get().refresh();
    return board;
  },

  renameBoard: async (id, name) => {
    const b = await boardsRepo.getBoard(id);
    if (!b) return;
    b.name = name;
    b.updatedAt = Date.now();
    await boardsRepo.putBoard(b);
    await get().refresh();
  },

  duplicateBoard: async (id) => {
    const b = await boardsRepo.getBoard(id);
    if (!b) return null;
    const now = Date.now();
    const copy: Board = {
      ...structuredClone(b),
      id: newId(),
      name: `${b.name} (cópia)`,
      createdAt: now,
      updatedAt: now,
      remoteSha: undefined,
      baseRemoteUpdatedAt: undefined,
      sharedGistId: undefined,
      syncState: "local-only",
    };
    await boardsRepo.putBoard(copy);
    await get().refresh();
    return copy;
  },

  removeBoard: async (id) => {
    await boardsRepo.deleteBoard(id);
    await get().refresh();
  },

  moveBoard: async (id, folderId) => {
    const b = await boardsRepo.getBoard(id);
    if (!b) return;
    b.folderId = folderId;
    b.updatedAt = Date.now();
    await boardsRepo.putBoard(b);
    await get().refresh();
  },

  createFolder: async (parentId, name) => {
    const now = Date.now();
    const folder: Folder = {
      id: newId(),
      name,
      parentId,
      order: get().folders.length,
      createdAt: now,
      updatedAt: now,
    };
    await foldersRepo.putFolder(folder);
    await get().refresh();
    return folder;
  },

  renameFolder: async (id, name) => {
    const f = get().folders.find((x) => x.id === id);
    if (!f) return;
    await foldersRepo.putFolder({ ...f, name, updatedAt: Date.now() });
    await get().refresh();
  },

  moveFolder: async (id, parentId) => {
    // guard against cycles: cannot move into itself or a descendant
    const banned = descendantFolderIds(get().folders, id);
    if (parentId && banned.has(parentId)) return;
    const f = get().folders.find((x) => x.id === id);
    if (!f) return;
    await foldersRepo.putFolder({ ...f, parentId, updatedAt: Date.now() });
    await get().refresh();
  },

  removeFolder: async (id) => {
    // reparent children + boards to root (no cascade delete)
    const banned = descendantFolderIds(get().folders, id);
    const childFolders = get().folders.filter(
      (f) => f.parentId === id,
    );
    for (const cf of childFolders) {
      await foldersRepo.putFolder({ ...cf, parentId: null, updatedAt: Date.now() });
    }
    const boards = await boardsRepo.allBoards();
    for (const b of boards) {
      if (b.folderId && banned.has(b.folderId) && b.folderId === id) {
        b.folderId = null;
        b.updatedAt = Date.now();
        await boardsRepo.putBoard(b);
      }
    }
    await foldersRepo.deleteFolder(id);
    await get().refresh();
  },
}));
