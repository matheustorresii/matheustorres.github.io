export type Route =
  | { kind: "home" }
  | { kind: "board"; id: string }
  | { kind: "shared"; payload: string };

export function getRoute(): Route {
  const hash = window.location.hash.replace(/^#/, "");
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "b" && parts[1]) return { kind: "board", id: parts[1] };
  // shared payload is base64url (no slashes) — take everything after "s/"
  if (parts[0] === "s" && parts[1]) {
    return { kind: "shared", payload: hash.slice(hash.indexOf("s/") + 2) };
  }
  return { kind: "home" };
}

export function goToBoard(id: string): void {
  window.location.hash = `#/b/${id}`;
}

export function goHome(): void {
  window.location.hash = "#/";
}

export function onRouteChange(cb: (r: Route) => void): () => void {
  const handler = () => cb(getRoute());
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}
