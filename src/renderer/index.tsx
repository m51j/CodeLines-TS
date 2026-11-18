import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyAppearance } from "./appearance/apply";
import { appStyles } from "./skins/styles";
// The saved look is applied before React renders, so the first paint is already right.
applyAppearance(window.codelines.boot, appStyles);
createRoot(document.getElementById("root")!).render(<App />);
