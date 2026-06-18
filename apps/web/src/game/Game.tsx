import { useEffect, useState } from "react";
import type { DraftSquad } from "@11a3/domain";
import { Setup, type SetupChoice } from "./Setup.js";
import { Draft } from "./Draft.js";
import { Campaign } from "./Campaign.js";
import { readRunFromHash } from "./share.js";
import { useT } from "../i18n.js";
import { asset } from "../asset.js";
import type { Pick } from "./types.js";

type Phase = "setup" | "draft" | "campaign";

export function Game({ dataUrl = asset("data/draft_pool.json") }: { dataUrl?: string }) {
  const t = useT();
  const [pool, setPool] = useState<DraftSquad[] | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [choice, setChoice] = useState<SetupChoice | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [sharedSeed, setSharedSeed] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch(dataUrl)
      .then((r) => r.json() as Promise<DraftSquad[]>)
      .then((p) => {
        setPool(p);
        // Opening a shared link rebuilds the comp + seed and jumps to the campaign.
        const shared = readRunFromHash(p);
        if (shared) {
          setPicks(shared.picks);
          setSharedSeed(shared.seed);
          setPhase("campaign");
        }
      })
      .catch(() => setPool([]));
  }, [dataUrl]);

  const restart = () => {
    if (location.hash) history.replaceState(null, "", location.pathname);
    setPhase("setup");
    setChoice(null);
    setPicks([]);
    setSharedSeed(undefined);
  };

  if (!pool) return <p className="empty">{t("Carregando base…")}</p>;
  if (pool.length === 0)
    return <p className="empty">{t("Base vazia. Rode")} <code>npm run ingest -- all</code>.</p>;

  if (phase === "setup")
    return (
      <Setup
        onStart={(c) => {
          setChoice(c);
          setPhase("draft");
        }}
      />
    );

  if (phase === "draft" && choice)
    return (
      <Draft
        pool={pool}
        template={choice.template}
        mode={choice.mode}
        onComplete={(p) => {
          setPicks(p);
          setPhase("campaign");
        }}
      />
    );

  if (phase === "campaign")
    return <Campaign picks={picks} pool={pool} onRestart={restart} initialSeed={sharedSeed} />;

  return null;
}
