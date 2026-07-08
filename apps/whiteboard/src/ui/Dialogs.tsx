import { useEffect, useRef, useState } from "react";

export interface PromptSpec {
  title: string;
  initial?: string;
  placeholder?: string;
  okLabel?: string;
  onOk: (value: string) => void;
}

export function PromptDialog({
  spec,
  onClose,
}: {
  spec: PromptSpec;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(spec.initial ?? "");

  useEffect(() => {
    const id = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const submit = () => {
    const v = value.trim();
    if (v) spec.onOk(v);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{spec.title}</h3>
        <input
          ref={ref}
          type="text"
          value={value}
          placeholder={spec.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={submit}>
            {spec.okLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ConfirmSpec {
  title: string;
  message?: string;
  okLabel?: string;
  danger?: boolean;
  onOk: () => void;
}

export function ConfirmDialog({
  spec,
  onClose,
}: {
  spec: ConfirmSpec;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{spec.title}</h3>
        {spec.message && <div className="hint">{spec.message}</div>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            style={
              spec.danger
                ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }
                : undefined
            }
            onClick={() => {
              spec.onOk();
              onClose();
            }}
          >
            {spec.okLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
