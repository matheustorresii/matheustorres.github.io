import type { Board } from "../types/model";

// The portable board is what lives in the repo — no device-local fields
// (thumbnail, sync metadata). See spec 03 §5.2.
export function toPortableJSON(board: Board): string {
  const {
    thumbnailDataUrl: _t,
    remoteSha: _r,
    baseRemoteUpdatedAt: _b,
    syncState: _s,
    sharedGistId: _g,
    ...portable
  } = board;
  void _t;
  void _r;
  void _b;
  void _s;
  void _g;
  return JSON.stringify(portable, null, 2);
}

export function fromPortableJSON(text: string): Board {
  return JSON.parse(text) as Board;
}
