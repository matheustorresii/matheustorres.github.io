import Prism from "prismjs";
// languages (order matters — deps first). markup/css/js are safe standalones.
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";

export const CODE_LANGS: { id: string; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "json", label: "JSON" },
  { id: "bash", label: "Bash" },
  { id: "markup", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "plain", label: "Texto" },
];

// One Dark-ish theme: token type → color.
const COLORS: Record<string, string> = {
  plain: "#abb2bf",
  keyword: "#c678dd",
  builtin: "#e5c07b",
  "class-name": "#e5c07b",
  function: "#61afef",
  "function-variable": "#61afef",
  string: "#98c379",
  char: "#98c379",
  "template-string": "#98c379",
  number: "#d19a66",
  boolean: "#d19a66",
  constant: "#d19a66",
  comment: "#5c6370",
  operator: "#56b6c2",
  punctuation: "#8a919e",
  property: "#e06c75",
  "property-access": "#e06c75",
  tag: "#e06c75",
  "attr-name": "#d19a66",
  "attr-value": "#98c379",
  selector: "#e06c75",
  variable: "#e06c75",
  regex: "#98c379",
  important: "#c678dd",
  parameter: "#abb2bf",
};

export function colorFor(type: string): string {
  return COLORS[type] ?? COLORS.plain;
}

interface Run {
  text: string;
  type: string;
}

type Toklike = string | { type?: string; content: unknown };

function flatten(tokens: Toklike[], parentType: string, out: Run[]): void {
  for (const t of tokens) {
    if (typeof t === "string") {
      out.push({ text: t, type: parentType });
    } else {
      const type = t.type ?? parentType;
      const c = t.content;
      if (typeof c === "string") out.push({ text: c, type });
      else if (Array.isArray(c)) flatten(c as Toklike[], type, out);
      else flatten([c as Toklike], type, out);
    }
  }
}

/** Tokenize into visual lines of colored runs. Falls back to plain on error. */
export function tokenizeLines(text: string, lang: string): Run[][] {
  const runs: Run[] = [];
  const grammar = Prism.languages[lang];
  if (lang === "plain" || !grammar) {
    runs.push({ text, type: "plain" });
  } else {
    try {
      flatten(Prism.tokenize(text, grammar) as Toklike[], "plain", runs);
    } catch {
      runs.push({ text, type: "plain" });
    }
  }
  const lines: Run[][] = [[]];
  for (const r of runs) {
    const parts = r.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, type: r.type });
    });
  }
  return lines;
}
