import { create } from "zustand";
import type { StyleDefaults, Tool } from "../types/model";
import { DEFAULT_STYLE } from "../types/model";
import { getTheme, STROKE_LIGHT } from "../theme";

interface UiState {
  tool: Tool;
  style: StyleDefaults;
  snap: boolean;
  setTool: (t: Tool) => void;
  setStyle: (patch: Partial<StyleDefaults>) => void;
  setSnap: (on: boolean) => void;
}

const GRID_KEY = "11a3.grid";
function loadGridPref(): boolean {
  try {
    return localStorage.getItem(GRID_KEY) === "1";
  } catch {
    return false;
  }
}

export const useUiStore = create<UiState>((set) => ({
  tool: "select",
  style: {
    ...DEFAULT_STYLE,
    strokeColor: getTheme() === "light" ? STROKE_LIGHT : DEFAULT_STYLE.strokeColor,
  },
  snap: loadGridPref(), // grid + snap; off by default, persisted per device
  setTool: (tool) => set({ tool }),
  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setSnap: (snap) => {
    try {
      localStorage.setItem(GRID_KEY, snap ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ snap });
  },
}));
