import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../persistence/settingsRepo";
import { checkAccess, type GitHubConfig } from "../sync/github";
import {
  resolveKeepLocal,
  resolveUseRemote,
  syncAll,
  type SyncResult,
} from "../sync/syncEngine";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; msg: string }
  | { kind: "ok"; msg: string }
  | { kind: "error"; msg: string };

export function SyncPanel({
  onClose,
  onSynced,
}: {
  onClose: () => void;
  onSynced: () => void;
}) {
  const [pat, setPat] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [conflicts, setConflicts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    void (async () => {
      setPat((await getSetting<string>("github.pat")) ?? "");
      setRepo((await getSetting<string>("github.repo")) ?? "");
      setBranch((await getSetting<string>("github.branch")) ?? "main");
    })();
  }, []);

  const cfg = (): GitHubConfig => ({ pat: pat.trim(), repo: repo.trim(), branch: branch.trim() || "main" });

  const persist = async () => {
    await setSetting("github.pat", pat.trim());
    await setSetting("github.repo", repo.trim());
    await setSetting("github.branch", branch.trim() || "main");
  };

  const test = async () => {
    setStatus({ kind: "busy", msg: "Testando acesso…" });
    const err = await checkAccess(cfg());
    setStatus(err ? { kind: "error", msg: err } : { kind: "ok", msg: "Acesso OK ✓" });
  };

  const doSync = async () => {
    if (!pat.trim() || !repo.trim()) {
      setStatus({ kind: "error", msg: "Preencha o token e o repositório." });
      return;
    }
    await persist();
    setStatus({ kind: "busy", msg: "Sincronizando…" });
    setConflicts([]);
    const res: SyncResult = await syncAll(cfg());
    if (res.error) {
      setStatus({ kind: "error", msg: res.error });
      return;
    }
    if (res.conflicts.length) {
      setConflicts(res.conflicts);
      setStatus({
        kind: "error",
        msg: `${res.conflicts.length} conflito(s): editados nos dois lados.`,
      });
    } else {
      setStatus({
        kind: "ok",
        msg: `Pronto — ${res.pushed} enviado(s), ${res.pulled} recebido(s).`,
      });
    }
    onSynced();
  };

  const forget = async () => {
    await setSetting("github.pat", "");
    setPat("");
    setStatus({ kind: "ok", msg: "Token removido deste device." });
  };

  const keepLocal = async () => {
    setStatus({ kind: "busy", msg: "Mantendo suas versões…" });
    await resolveKeepLocal(cfg(), conflicts.map((c) => c.id));
    setConflicts([]);
    setStatus({ kind: "ok", msg: "Suas versões foram enviadas." });
    onSynced();
  };
  const useRemote = async () => {
    setStatus({ kind: "busy", msg: "Trazendo versões do remoto…" });
    await resolveUseRemote(cfg(), conflicts.map((c) => c.id));
    setConflicts([]);
    setStatus({ kind: "ok", msg: "Versões do remoto aplicadas." });
    onSynced();
  };

  const statusColor =
    status.kind === "error"
      ? "var(--danger)"
      : status.kind === "ok"
        ? "var(--accent)"
        : "var(--muted)";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <h3>Sincronizar com o GitHub</h3>
        <div className="hint">
          O seu "login" é um token do GitHub. Ele fica <b>só neste device</b>{" "}
          (nada de servidor) e conversa direto com o GitHub.
        </div>

        <details style={{ fontSize: 13, color: "var(--muted)" }}>
          <summary style={{ cursor: "pointer", color: "var(--text)" }}>
            Como pegar o token (1 vez)
          </summary>
          <ol style={{ paddingLeft: 18, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>
              Crie um repositório privado em{" "}
              <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                github.com/new
              </a>{" "}
              (ex.: <code>meus-boards</code>) — <b>marque "Add a README file"</b>{" "}
              pra ele não nascer vazio.
            </li>
            <li>
              Gere um token <b>fine-grained</b> em{" "}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                settings/personal-access-tokens
              </a>
              .
            </li>
            <li>
              Em <b>Repository access</b>: só o repo acima. Em <b>Permissions →
              Repository → Contents</b>: <b>Read and write</b>. Defina uma{" "}
              <b>expiração</b>.
            </li>
            <li>Copie o token (<code>github_pat_…</code>) e cole abaixo.</li>
          </ol>
          <div style={{ marginTop: 6 }}>
            Use fine-grained (não "classic"): assim o token só mexe nesse 1 repo
            e expira sozinho.
          </div>
        </details>

        <div className="field">
          <label>Personal Access Token</label>
          <input
            type="password"
            value={pat}
            placeholder="github_pat_…"
            onChange={(e) => setPat(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Repositório (owner/repo)</label>
          <input
            type="text"
            value={repo}
            placeholder="seu-usuario/meus-boards"
            onChange={(e) => setRepo(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Branch</label>
          <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} />
        </div>

        {status.kind !== "idle" && (
          <div style={{ color: statusColor, fontSize: 13 }}>{status.msg}</div>
        )}

        {conflicts.length > 0 && (
          <div className="field">
            <label>Conflitos</label>
            <div className="hint">
              {conflicts.map((c) => c.name).join(", ")}
            </div>
            <div className="row">
              <button className="btn" onClick={keepLocal}>
                Manter os meus
              </button>
              <button className="btn" onClick={useRemote}>
                Usar os do remoto
              </button>
            </div>
          </div>
        )}

        <div className="dialog-actions" style={{ justifyContent: "space-between" }}>
          <button
            className="btn"
            onClick={forget}
            title="Apaga o token guardado neste device"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
          >
            Esquecer token
          </button>
          <div className="row">
            <button className="btn" onClick={test}>
              Testar acesso
            </button>
            <button className="btn" onClick={onClose}>
              Fechar
            </button>
            <button
              className="btn btn-primary"
              onClick={doSync}
              disabled={status.kind === "busy"}
            >
              Sincronizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
