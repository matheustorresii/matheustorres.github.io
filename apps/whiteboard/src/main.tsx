import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./App";
import { requestPersistence } from "./persistence/db";

void requestPersistence();

// Note: no <StrictMode>. It double-mounts effects in dev, which recreates the
// imperative CanvasRoot and steals focus from the text-edit overlay (committing
// it empty on the spurious blur). The imperative canvas manages its own
// lifecycle, so StrictMode's remount stress-test hurts more than it helps here.
createRoot(document.getElementById("root")!).render(<App />);
