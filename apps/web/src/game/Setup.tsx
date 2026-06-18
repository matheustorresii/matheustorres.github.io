import type { Role } from "@11a3/domain";
import { ROLE_ABBR_PT, ROLE_LABEL_PT } from "../labels.js";
import { usePersisted } from "../usePersisted.js";
import { useT } from "../i18n.js";
import { ROLE_ORDER, DEFAULT_TEMPLATE, type CompTemplate, type GameMode } from "./types.js";

export interface SetupChoice {
  template: CompTemplate;
  mode: GameMode;
}

const cycle = (r: Role, dir: 1 | -1): Role => {
  const i = ROLE_ORDER.indexOf(r);
  return ROLE_ORDER[(i + dir + ROLE_ORDER.length) % ROLE_ORDER.length]!;
};

const isFormation = (v: unknown): boolean =>
  Array.isArray(v) && v.length === 5 && v.every((r) => (ROLE_ORDER as string[]).includes(r));
const isMode = (v: unknown): boolean => v === "classic" || v === "almanac";

export function Setup({ onStart }: { onStart: (c: SetupChoice) => void }) {
  const t = useT();
  const [slots, setSlots] = usePersisted<Role[]>("11a3.formation", DEFAULT_TEMPLATE.slots, isFormation);
  const [mode, setMode] = usePersisted<GameMode>("11a3.mode", "classic", isMode);

  const setSlot = (i: number, r: Role) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? r : s)));

  return (
    <div className="setup">
      <h2>{t("Montar comp")}</h2>

      <section className="setup-block">
        <h3>{t("Formação · escolha a role de cada posição")}</h3>
        <div className="formation">
          {slots.map((role, i) => (
            <div key={i} className="form-slot">
              <div className="form-pos muted">#{i + 1}</div>
              <span className={`role-badge chip-${role} role-flip`} key={role}>
                {ROLE_ABBR_PT[role]}
              </span>
              <div className="form-arrows">
                <button className="role-arrow" onClick={() => setSlot(i, cycle(role, -1))}>‹</button>
                <span className="form-role-name">{t(ROLE_LABEL_PT[role])}</span>
                <button className="role-arrow" onClick={() => setSlot(i, cycle(role, 1))}>›</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="setup-block">
        <h3>{t("Modo")}</h3>
        <div className="option-grid">
          <button
            className={`option-card ${mode === "classic" ? "is-active" : ""}`}
            onClick={() => setMode("classic")}
          >
            <div className="option-title">{t("Clássico")}</div>
            <div className="option-desc">{t("Overall visível durante o draft.")}</div>
          </button>
          <button
            className={`option-card ${mode === "almanac" ? "is-active" : ""}`}
            onClick={() => setMode("almanac")}
          >
            <div className="option-title">{t("Almanaque")}</div>
            <div className="option-desc">
              Overall <b>{t("oculto")}</b> — {t("escolhe no conhecimento (nome, role, time, campeonato).")}
            </div>
          </button>
        </div>
      </section>

      <button className="btn-primary big" onClick={() => onStart({ template: { slots }, mode })}>
        {t("Começar draft →")}
      </button>
    </div>
  );
}
