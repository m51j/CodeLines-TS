import { createRoot } from "react-dom/client";
import { WidgetApp } from "./Widget";
import "../styles.css";
import "./widget.css";
createRoot(document.getElementById("root")!).render(<WidgetApp />);
