import type { Board } from "../types/model";
import { toPortableJSON, fromPortableJSON } from "./portable";

// Sharing packs the whole board (gzip + base64url) into the link fragment, so
// it needs no GitHub token, no gist, no server. Fine-grained PATs can't create
// gists (403), and this also lets friends open a board with zero setup.

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encodeBoardToPayload(board: Board): Promise<string> {
  const json = toPortableJSON(board);
  const stream = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return toB64url(new Uint8Array(buf));
}

export async function decodeBoardFromPayload(payload: string): Promise<Board> {
  const bytes = fromB64url(payload);
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  return fromPortableJSON(json);
}
