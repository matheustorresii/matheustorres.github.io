// Lazy access to the official AWS icon SVGs. The bulky SVG data lives in a
// separate chunk (awsIconData.ts) that is dynamically imported the first time
// an AWS service icon needs to render, keeping it out of the main bundle.

let SVG: Record<string, string> | null = null;
let loading = false;
let onReady: () => void = () => {};

/** Registered by the canvas so a finished load triggers a repaint. */
export function setAwsReadyHandler(fn: () => void): void {
  onReady = fn;
}

/** Kick off the one-time load of the SVG data chunk. */
export function ensureAwsSvgLoaded(): void {
  if (SVG || loading) return;
  loading = true;
  void import("./awsIconData").then((m) => {
    SVG = m.AWS_SVG;
    loading = false;
    onReady();
  });
}

const uriCache = new Map<string, string>();

/** data: URI for an AWS service id, or null while the data chunk loads. */
export function awsSvgDataUri(id: string): string | null {
  if (!SVG) {
    ensureAwsSvgLoaded();
    return null;
  }
  const raw = SVG[id];
  if (!raw) return null;
  let uri = uriCache.get(id);
  if (!uri) {
    // the icons are ASCII, so encodeURIComponent keeps it valid without base64
    uri = "data:image/svg+xml," + encodeURIComponent(raw);
    uriCache.set(id, uri);
  }
  return uri;
}
