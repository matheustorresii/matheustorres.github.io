import { useRef, useState } from "react";
import type { DraftPlayer, DraftSquad, Role } from "@11a3/domain";
import { ROLE_ABBR_PT, ROLE_LABEL_PT, overallClass } from "../labels.js";
import { useT } from "../i18n.js";
import { rerollsFor, type CompTemplate, type GameMode, type Pick } from "./types.js";

const rand = <T,>(arr: T[]): T | null =>
  arr.length ? arr[Math.floor(Math.random() * arr.length)]! : null;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const rolesOf = (p: DraftPlayer): Role[] => [...new Set(p.rolesPlayed)];

interface Slot { role: Role; pick: Pick | null; }
interface Rolled { squad: DraftSquad; order: DraftPlayer[]; }

export function Draft({
  pool,
  template,
  mode,
  onComplete,
}: {
  pool: DraftSquad[];
  template: CompTemplate;
  mode: GameMode;
  onComplete: (picks: Pick[]) => void;
}) {
  const t = useT();
  const [slots, setSlots] = useState<Slot[]>(() => template.slots.map((role) => ({ role, pick: null })));
  const [rerolls, setRerolls] = useState(() => rerollsFor(mode));
  const [rolled, setRolled] = useState<Rolled | null>(null);
  const [pickSel, setPickSel] = useState<DraftPlayer | null>(null); // roll player awaiting a slot
  const [compSel, setCompSel] = useState<number | null>(null); // placed slot awaiting move/swap
  const [spin, setSpin] = useState<DraftSquad | null>(null);
  const [spinning, setSpinning] = useState(false);
  const runId = useRef(0);

  const filled = slots.filter((s) => s.pick).length;
  const complete = filled === slots.length;
  const pickedIds = new Set(slots.map((s) => s.pick?.player.playerId).filter(Boolean));

  const openSlotsFor = (p: DraftPlayer): number[] => {
    const roles = rolesOf(p);
    return slots.flatMap((s, i) => (!s.pick && roles.includes(s.role) ? [i] : []));
  };
  const selectable = (p: DraftPlayer) => !pickedIds.has(p.playerId) && openSlotsFor(p).length > 0;

  // Can the player in slot `from` go to slot `to` (move to empty, or swap)?
  const validMove = (from: number, to: number): boolean => {
    if (from === to) return false;
    const fromPlayer = slots[from]!.pick!.player;
    const toSlot = slots[to]!;
    if (!toSlot.pick) return rolesOf(fromPlayer).includes(toSlot.role);
    return rolesOf(fromPlayer).includes(toSlot.role) && rolesOf(toSlot.pick.player).includes(slots[from]!.role);
  };

  const isPickTarget = (s: Slot) => !!pickSel && !s.pick && rolesOf(pickSel).includes(s.role);
  const isMoveTarget = (i: number) => compSel !== null && validMove(compSel, i);
  const isTarget = (i: number) => isPickTarget(slots[i]!) || isMoveTarget(i);

  const placeIn = (i: number, p: DraftPlayer) => {
    if (!rolled) return;
    setSlots((prev) => {
      const next = [...prev];
      next[i] = { ...next[i]!, pick: { player: p, squad: rolled.squad, role: next[i]!.role } };
      return next;
    });
    setRolled(null);
    setPickSel(null);
    setCompSel(null);
  };

  const moveSwap = (from: number, to: number) => {
    setSlots((prev) => {
      const next = [...prev];
      const fromPick = prev[from]!.pick!;
      const toPick = prev[to]!.pick;
      next[to] = { ...prev[to]!, pick: { ...fromPick, role: prev[to]!.role } };
      next[from] = { ...prev[from]!, pick: toPick ? { ...toPick, role: prev[from]!.role } : null };
      return next;
    });
    setCompSel(null);
  };

  const onCardClick = (i: number) => {
    const slot = slots[i]!;
    if (pickSel) {
      if (isPickTarget(slot)) placeIn(i, pickSel);
      return;
    }
    if (compSel !== null) {
      if (i === compSel) setCompSel(null);
      else if (isMoveTarget(i)) moveSwap(compSel, i);
      else if (slot.pick) setCompSel(i);
      return;
    }
    if (slot.pick) setCompSel(i);
  };

  const choose = (p: DraftPlayer) => {
    if (!selectable(p)) return;
    // Toggle: select first (then click a slot); click again to deselect so you
    // can go back to editing your current comp.
    setCompSel(null);
    setPickSel((cur) => (cur?.playerId === p.playerId ? null : p));
  };

  const roll = (costsReroll: boolean) => {
    if (spinning) return;
    if (costsReroll) {
      if (rerolls <= 0) return;
      setRerolls((r) => r - 1);
    }
    setPickSel(null);
    setCompSel(null);
    setRolled(null);
    let landing = rand(pool);
    for (let i = 0; i < 25; i++) {
      const c = rand(pool);
      if (c && c.players.some(selectable)) { landing = c; break; }
    }
    const myRun = ++runId.current;
    setSpinning(true);
    const ticks = 13;
    let i = 0;
    const step = () => {
      if (runId.current !== myRun) return;
      if (i >= ticks) {
        setSpinning(false);
        setSpin(null);
        if (landing) setRolled({ squad: landing, order: shuffle(landing.players) });
        return;
      }
      setSpin(rand(pool));
      i++;
      setTimeout(step, 28 + i * i * 0.7);
    };
    step();
  };

  const noPickable = !!rolled && !rolled.order.some(selectable);

  return (
    <div className="draft">
      <div className="draft-head">
        <h2>{t("Draft")} <span className="counter">{filled}/{slots.length}</span></h2>
        <span className="rerolls">{t("Rerolls:")} <b>{rerolls}</b> · {mode === "classic" ? t("Clássico") : t("Almanaque")}</span>
      </div>

      <div className="comp">
        {slots.map((s, i) => {
          const target = isTarget(i);
          const sel = compSel === i;
          return (
            <div
              key={i}
              className={`comp-card ${s.pick ? "" : "is-empty"} ${target ? "is-target" : ""} ${sel ? "is-selected" : ""} ${s.pick && rolesOf(s.pick.player).length > 1 ? "is-flex" : ""}`}
              onClick={() => onCardClick(i)}
            >
              <div className={`role-badge chip-${s.role}`}>{ROLE_ABBR_PT[s.role]}</div>
              {s.pick ? (
                <div className="comp-filled pop-in">
                  {mode === "classic" && (
                    <span className={`${overallClass(s.pick.player.overall)} comp-ovr`}>{s.pick.player.overall}</span>
                  )}
                  <div className="comp-name">{s.pick.player.displayName}</div>
                  <div className="comp-src muted">{s.pick.squad.teamName} · {s.pick.squad.year}</div>
                </div>
              ) : (
                <div className="comp-empty muted">{t(ROLE_LABEL_PT[s.role])}</div>
              )}
            </div>
          );
        })}
      </div>

      {complete ? (
        <div className="draft-done fade-in">
          <button className="btn-primary big" onClick={() => onComplete(slots.map((s) => s.pick!))}>{t("Revisar time →")}</button>
        </div>
      ) : spinning && spin ? (
        <div className="roll-result spinning">
          <div className="roll-team">
            <span className="roll-team-name">{spin.teamName}</span>
            <span className="roll-team-event muted">{spin.eventName} · {spin.year}</span>
          </div>
        </div>
      ) : !rolled ? (
        <div className="roll-cta fade-in">
          <button className="btn-primary big pulse" onClick={() => roll(false)}>{t("🎲 ROLAR")}</button>
          <p className="muted">{t("Sorteia um time + campeonato da base.")}</p>
        </div>
      ) : (
        <div className="roll-result fade-in">
          <div className="roll-team">
            <span className="roll-team-name">{rolled.squad.teamName}</span>
            <span className="roll-team-event muted">{rolled.squad.eventName} · {rolled.squad.year}</span>
          </div>
          <div className="roll-players">
            {rolled.order.map((p) => {
              const ok = selectable(p);
              const isSel = pickSel?.playerId === p.playerId;
              const reason = pickedIds.has(p.playerId) ? t("Já está na sua comp") : t("Nenhuma posição compatível aberta");
              return (
                <button
                  key={p.playerId}
                  className={`pcard ${ok ? "" : "is-disabled"} ${isSel ? "is-selected" : ""}`}
                  disabled={!ok}
                  onClick={() => choose(p)}
                  title={ok ? t("Escolher") : reason}
                >
                  {mode === "classic" && <span className={overallClass(p.overall)}>{p.overall}</span>}
                  <span className="pcard-name">{p.displayName}</span>
                  <span className="pcard-roles">
                    {rolesOf(p).map((r) => (
                      <span key={r} className={`rchip chip-${r}`}>{ROLE_ABBR_PT[r]}</span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="roll-actions">
            {noPickable ? (
              <button className="free-roll" onClick={() => roll(false)}>🎲 {t("Ninguém encaixa — rolar de novo (grátis)")}</button>
            ) : (
              <button onClick={() => roll(true)} disabled={rerolls <= 0}>
                🎲 {t("Rolar de novo")} <span className="muted">({rerolls})</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
