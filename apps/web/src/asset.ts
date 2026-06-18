/**
 * Resolve a path to a file in the public dir under the app's base URL.
 *
 * In dev the base is "/", so asset("data/x.json") → "/data/x.json". When built
 * for a GitHub Pages project site the base is "/<repo>/", so the same call
 * yields "/<repo>/data/x.json". Always pass a path WITHOUT a leading slash (a
 * leading slash is stripped defensively). `import.meta.env.BASE_URL` always
 * ends with a trailing slash.
 */
export const asset = (path: string): string =>
  import.meta.env.BASE_URL + path.replace(/^\/+/, "");
