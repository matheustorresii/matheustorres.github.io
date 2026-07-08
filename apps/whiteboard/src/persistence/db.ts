import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Board, Folder } from "../types/model";

interface WhiteboardDB extends DBSchema {
  boards: {
    key: string;
    value: Board;
    indexes: { "by-folder": string; "by-updatedAt": number };
  };
  folders: {
    key: string;
    value: Folder;
    indexes: { "by-parent": string };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<WhiteboardDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<WhiteboardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WhiteboardDB>("whiteboard", 1, {
      upgrade(db) {
        const boards = db.createObjectStore("boards", { keyPath: "id" });
        boards.createIndex("by-folder", "folderId");
        boards.createIndex("by-updatedAt", "updatedAt");
        const folders = db.createObjectStore("folders", { keyPath: "id" });
        folders.createIndex("by-parent", "parentId");
        db.createObjectStore("settings", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

/** Ask the browser to keep our storage (reduces eviction risk). */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
}
