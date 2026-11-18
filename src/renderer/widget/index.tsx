import { createRoot } from "react-dom/client";
import { WidgetApp } from "./Widget";
import { applyAppearance } from "../appearance/apply";
import { widgetStyles } from "./styles";
if (window.codelinesWidget) applyAppearance(window.codelinesWidget.boot, widgetStyles);
createRoot(document.getElementById("root")!).render(<WidgetApp />);
