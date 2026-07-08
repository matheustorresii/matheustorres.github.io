// Minimal GitHub REST client for the Contents API. No dependencies — just
// fetch + a PAT. Used to store each board as a JSON file in the user's own
// private repo (the "login" is the PAT, see spec 02 §6).

export interface GitHubConfig {
  pat: string;
  repo: string; // "owner/repo"
  branch: string; // e.g. "main"
}

export interface FileContent {
  sha: string;
  text: string;
}

const API = "https://api.github.com";

function headers(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// UTF-8 safe base64 (btoa only handles latin1)
function encodeB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function decodeB64(b: string): string {
  const bin = atob(b.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function friendly(status: number, path: string): string {
  if (status === 401)
    return "Token inválido ou expirado (401). Gere um novo token fine-grained e cole de novo (o GitHub só mostra o token uma vez — copie inteiro).";
  if (status === 403)
    return "Sem permissão (403). O token precisa de Contents: Read and write nesse repositório.";
  if (status === 404)
    return "Repositório não encontrado (404). Confira o owner/repo e se o token dá acesso a esse repo.";
  return `Erro ${status} em ${path}.`;
}

/** Validate that the token can read the repo. Returns null on success. */
export async function checkAccess(cfg: GitHubConfig): Promise<string | null> {
  try {
    const res = await fetch(`${API}/repos/${cfg.repo}`, {
      headers: headers(cfg.pat),
      cache: "no-store",
    });
    if (res.status === 401) return "Token inválido (401).";
    if (res.status === 404) return "Repositório não encontrado ou sem acesso (404).";
    if (!res.ok) return `Erro ${res.status} ao acessar o repositório.`;
    return null;
  } catch {
    return "Falha de rede ao contatar o GitHub.";
  }
}

/** Read a file. Returns null when the file does not exist (404). */
export async function getContent(
  cfg: GitHubConfig,
  path: string,
): Promise<FileContent | null> {
  const url = `${API}/repos/${cfg.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, { headers: headers(cfg.pat), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(res.status, friendly(res.status, `GET ${path}`));
  const data = (await res.json()) as { sha: string; content: string };
  return { sha: data.sha, text: decodeB64(data.content) };
}

/** Create or update a file (one commit). Pass `sha` to update an existing file. */
export async function putContent(
  cfg: GitHubConfig,
  path: string,
  text: string,
  sha: string | undefined,
  message: string,
): Promise<{ sha: string }> {
  const url = `${API}/repos/${cfg.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const content = encodeB64(text);
  const attempt = (useSha: string | undefined, includeBranch: boolean) =>
    fetch(url, {
      method: "PUT",
      cache: "no-store",
      headers: { ...headers(cfg.pat), "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content,
        ...(includeBranch ? { branch: cfg.branch } : {}),
        ...(useSha ? { sha: useSha } : {}),
      }),
    });

  let res = await attempt(sha, true);
  // An empty repo has no branch yet, so a create that names `main` 404s. Retry
  // once without the branch so GitHub creates the file on the default branch.
  if (res.status === 404 && !sha) res = await attempt(undefined, false);

  // Stale sha (remote advanced since we read it): refetch the current sha and
  // retry once. Self-heals the "stuck on 409 forever" case.
  if (res.status === 409) {
    const fresh = await getContent(cfg, path);
    res = await attempt(fresh?.sha, true);
  }

  if (res.status === 409)
    throw new GitHubError(409, "Conflito de sha persistente — tente sincronizar de novo.");
  if (res.status === 404)
    throw new GitHubError(
      404,
      "Repo vazio ou branch inexistente. Crie o repositório com um README (ou faça um primeiro commit) e sincronize de novo.",
    );
  if (!res.ok) throw new GitHubError(res.status, friendly(res.status, `PUT ${path}`));
  const data = (await res.json()) as { content: { sha: string } };
  return { sha: data.content.sha };
}
