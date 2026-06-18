import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Base path. "/" for local dev and a user/custom-domain site; the deploy
  // workflow passes VITE_BASE="/<repo>/" so assets resolve on a GitHub Pages
  // project site (matheustorresii.github.io/<repo>/).
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    // Allow serving the symlinked /data dir (public/data -> ../../../data).
    fs: { allow: [".."] },
  },
});
