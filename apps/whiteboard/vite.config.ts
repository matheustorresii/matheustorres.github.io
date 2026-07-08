import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Locks network egress to GitHub + self, so even an injected script can't
// exfiltrate the PAT anywhere else. Applied only to the production build so it
// never interferes with Vite's dev HMR (websocket/eval).
const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://api.github.com",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
      return html.replace("<head>", `<head>\n    ${meta}`);
    },
  };
}

// base './' keeps assets path-relative so the build works at the domain root
// (11a3.dev). Deploy is driven by .github/workflows/deploy.yml.
export default defineConfig({
  base: "./",
  plugins: [react(), cspMeta()],
  server: { port: 5174 },
});
