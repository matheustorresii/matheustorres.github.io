import { createContext, useContext } from "react";

export type Lang = "pt" | "es" | "en";
export type Theme = "dark" | "light";

export const isLang = (v: unknown): boolean => v === "pt" || v === "es" || v === "en";
export const isTheme = (v: unknown): boolean => v === "dark" || v === "light";

/**
 * Lightweight i18n: the Portuguese string IS the key. `t()` returns the
 * translation for the active language (falling back to the PT string), or the
 * PT string itself when lang === "pt".
 */
const ES: Record<string, string> = {
  // Shell / settings
  "Início": "Inicio",
  "Apoie": "Apoya",
  "Configurações": "Configuración",
  "Idioma": "Idioma",
  "Tema": "Tema",
  "Escuro": "Oscuro",
  "Claro": "Claro",
  "Português": "Portugués",
  "Espanhol": "Español",
  "Inglês": "Inglés",

  // Setup
  "Montar comp": "Armar comp",
  "Formação · escolha a role de cada posição": "Formación · elige la role de cada posición",
  "Modo": "Modo",
  "Clássico": "Clásico",
  "Almanaque": "Almanaque",
  "Overall visível durante o draft.": "Overall visible durante el draft.",
  "oculto": "oculto",
  "escolhe no conhecimento (nome, role, time, campeonato).": "eliges por conocimiento (nombre, role, equipo, campeonato).",
  "Começar draft →": "Empezar draft →",

  // Draft
  "Draft": "Draft",
  "Rerolls:": "Rerolls:",
  "selecionado — clique numa posição destacada.": "seleccionado — haz clic en una posición destacada.",
  "🎲 ROLAR": "🎲 GIRAR",
  "Sorteia um time + campeonato da base.": "Sortea un equipo + campeonato de la base.",
  "Revisar time →": "Revisar equipo →",
  "Comp completa!": "¡Comp completa!",
  "Já está na sua comp": "Ya está en tu comp",
  "Nenhuma posição compatível aberta": "Ninguna posición compatible abierta",
  "Escolher": "Elegir",
  "aqui": "aquí",
  "Rolar de novo": "Girar de nuevo",
  "Ninguém encaixa — rolar de novo (grátis)": "Nadie encaja — girar de nuevo (gratis)",

  // Campaign config
  "Seu time": "Tu equipo",
  "Força do time": "Fuerza del equipo",
  "Enfrenta 15 elencos históricos: fase de grupos → playoffs (chave dupla) → grande final MD5. Mesmo seed + mesma comp = mesma campanha.":
    "Enfrenta 15 planteles históricos: fase de grupos → playoffs (llave doble) → gran final MD5. Mismo seed + misma comp = misma campaña.",
  "Gerar outro": "Generar otro",
  "Jogo a jogo (round a round)": "Partido a partido (ronda a ronda)",
  "Automático": "Automático",

  // Watch / report
  "Jogo": "Partido",
  "Atacando": "Atacando",
  "Defendendo": "Defendiendo",
  "mapa": "mapa",
  "mapas": "mapas",
  "Lento": "Lento",
  "Normal": "Normal",
  "Rápido": "Rápido",
  "Turbo": "Turbo",
  "Vitória": "Victoria",
  "Derrota": "Derrota",
  "Próximo": "Próximo",
  "Fim do seu caminho neste torneio.": "Fin de tu camino en este torneo.",
  "Continuar →": "Continuar →",
  "levou": "ganó",
  "pistol": "pistol",

  // Final card
  "Caminho da campanha": "Camino de la campaña",
  "Compartilhar run": "Compartir run",
  "Link copiado!": "¡Link copiado!",
  "Nova run": "Nueva run",
  "Copie o link da sua run:": "Copia el link de tu run:",

  // Bracket
  "Grupos": "Grupos",
  "Chave superior": "Llave superior",
  "Quartas": "Cuartos",
  "Semis": "Semis",
  "Final upper": "Final upper",
  "Chave inferior": "Llave inferior",
  "Semi": "Semi",
  "Final lower": "Final lower",
  "Finais": "Finales",
  "Grande final": "Gran final",
  "Grande final · MD5": "Gran final · MD5",
  "a definir": "por definir",
  "Grupo": "Grupo",
  "seu grupo": "tu grupo",

  // Roles
  "Duelista": "Duelista",
  "Iniciador": "Iniciador",
  "Controlador": "Controlador",
  "Sentinela": "Centinela",

  // Placement tiers
  "Campeão": "Campeón",
  "Vice": "Subcampeón",
  "3º": "3º",
  "Top 4": "Top 4",
  "Top 8": "Top 8",
  "Top 12": "Top 12",
  "Fase de grupos": "Fase de grupos",

  // Match stages (from the sim)
  "Abertura": "Apertura",
  "Vencedores": "Ganadores",
  "Eliminação": "Eliminación",
  "Decisão": "Decisión",
  "Upper QF": "Cuartos Upper",
  "Upper SF": "Semis Upper",
  "Upper Final": "Final Upper",
  "Lower R1": "Lower R1",
  "Lower R2": "Lower R2",
  "Lower SF": "Semi Lower",
  "Lower Final": "Final Lower",
  "Grande Final": "Gran Final",

  // Side profile
  "Ataque forte · defesa frágil": "Ataque fuerte · defensa frágil",
  "Leve pendor ofensivo": "Leve tendencia ofensiva",
  "Defesa forte · ataque frágil": "Defensa fuerte · ataque frágil",
  "Leve pendor defensivo": "Leve tendencia defensiva",
  "Equilibrado nos dois lados": "Equilibrado en ambos lados",

  // misc
  "Carregando base…": "Cargando base…",
  "Base vazia. Rode": "Base vacía. Ejecuta",
  "Base em construção — em breve.": "Base en construcción — pronto.",
};

const EN: Record<string, string> = {
  // Shell / settings
  "Início": "Home",
  "Apoie": "Support",
  "Configurações": "Settings",
  "Idioma": "Language",
  "Tema": "Theme",
  "Escuro": "Dark",
  "Claro": "Light",
  "Português": "Portuguese",
  "Espanhol": "Spanish",
  "Inglês": "English",

  // Setup
  "Montar comp": "Build comp",
  "Formação · escolha a role de cada posição": "Formation · pick each position's role",
  "Modo": "Mode",
  "Clássico": "Classic",
  "Almanaque": "Almanac",
  "Overall visível durante o draft.": "Overall visible during the draft.",
  "oculto": "hidden",
  "escolhe no conhecimento (nome, role, time, campeonato).": "pick by knowledge (name, role, team, championship).",
  "Começar draft →": "Start draft →",

  // Draft
  "Draft": "Draft",
  "Rerolls:": "Rerolls:",
  "selecionado — clique numa posição destacada.": "selected — click a highlighted position.",
  "🎲 ROLAR": "🎲 ROLL",
  "Sorteia um time + campeonato da base.": "Draws a team + championship from the pool.",
  "Revisar time →": "Review team →",
  "Comp completa!": "Comp complete!",
  "Já está na sua comp": "Already in your comp",
  "Nenhuma posição compatível aberta": "No compatible position open",
  "Escolher": "Pick",
  "aqui": "here",
  "Rolar de novo": "Roll again",
  "Ninguém encaixa — rolar de novo (grátis)": "Nobody fits — roll again (free)",

  // Campaign config
  "Seu time": "Your team",
  "Força do time": "Team strength",
  "Enfrenta 15 elencos históricos: fase de grupos → playoffs (chave dupla) → grande final MD5. Mesmo seed + mesma comp = mesma campanha.":
    "Face 15 historic rosters: group stage → playoffs (double elim) → MD5 grand final. Same seed + same comp = same campaign.",
  "Gerar outro": "Generate another",
  "Jogo a jogo (round a round)": "Game by game (round by round)",
  "Automático": "Automatic",

  // Watch / report
  "Jogo": "Game",
  "Atacando": "Attacking",
  "Defendendo": "Defending",
  "mapa": "map",
  "mapas": "maps",
  "Lento": "Slow",
  "Normal": "Normal",
  "Rápido": "Fast",
  "Turbo": "Turbo",
  "Vitória": "Victory",
  "Derrota": "Defeat",
  "Próximo": "Next",
  "Fim do seu caminho neste torneio.": "End of your road in this tournament.",
  "Continuar →": "Continue →",
  "levou": "won",
  "pistol": "pistol",

  // Final card
  "Caminho da campanha": "Campaign path",
  "Compartilhar run": "Share run",
  "Link copiado!": "Link copied!",
  "Nova run": "New run",
  "Copie o link da sua run:": "Copy your run link:",

  // Bracket
  "Grupos": "Groups",
  "Chave superior": "Upper bracket",
  "Quartas": "Quarters",
  "Semis": "Semis",
  "Final upper": "Upper final",
  "Chave inferior": "Lower bracket",
  "Semi": "Semi",
  "Final lower": "Lower final",
  "Finais": "Finals",
  "Grande final": "Grand final",
  "Grande final · MD5": "Grand final · Bo5",
  "a definir": "TBD",
  "Grupo": "Group",
  "seu grupo": "your group",

  // Roles
  "Duelista": "Duelist",
  "Iniciador": "Initiator",
  "Controlador": "Controller",
  "Sentinela": "Sentinel",

  // Placement tiers
  "Campeão": "Champion",
  "Vice": "Runner-up",
  "3º": "3rd",
  "Top 4": "Top 4",
  "Top 8": "Top 8",
  "Top 12": "Top 12",
  "Fase de grupos": "Group stage",

  // Match stages (from the sim)
  "Abertura": "Opening",
  "Vencedores": "Winners",
  "Eliminação": "Elimination",
  "Decisão": "Decider",
  "Upper QF": "Upper QF",
  "Upper SF": "Upper SF",
  "Upper Final": "Upper Final",
  "Lower R1": "Lower R1",
  "Lower R2": "Lower R2",
  "Lower SF": "Lower SF",
  "Lower Final": "Lower Final",
  "Grande Final": "Grand Final",

  // Side profile
  "Ataque forte · defesa frágil": "Strong attack · weak defense",
  "Leve pendor ofensivo": "Slight offensive lean",
  "Defesa forte · ataque frágil": "Strong defense · weak attack",
  "Leve pendor defensivo": "Slight defensive lean",
  "Equilibrado nos dois lados": "Balanced on both sides",

  // misc
  "Carregando base…": "Loading database…",
  "Base vazia. Rode": "Empty database. Run",
  "Base em construção — em breve.": "Database under construction — coming soon.",
};

const DICTS: Record<Lang, Record<string, string>> = { pt: {}, es: ES, en: EN };

export function tr(lang: Lang, s: string): string {
  if (lang === "pt") return s;
  return DICTS[lang][s] ?? s;
}

interface SettingsValue {
  t: (s: string) => string;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const SettingsCtx = createContext<SettingsValue>({
  t: (s) => s,
  lang: "pt",
  setLang: () => {},
  theme: "dark",
  setTheme: () => {},
});

export const useSettings = () => useContext(SettingsCtx);
export const useT = () => useContext(SettingsCtx).t;
