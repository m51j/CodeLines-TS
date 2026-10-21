import { createRoot } from "react-dom/client";
import { Reports } from "./reports";
import { useState } from "react";
function Standalone() {
  const [theme, setTheme] = useState("System");
  const dark =
    theme === "Dark" ||
    (theme === "System" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  return (
    <main className="standalone">
      <header className="page-header">
        <div>
          <span className="eyebrow">CODELINES · OFFLINE REPORT</span>
          <h1>AI usage</h1>
          <p>
            Generated{" "}
            {new Date(window.CODELINES_REPORT!.generatedAt).toLocaleString()}
          </p>
        </div>
        <select
          aria-label="Report theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          {["System", "Light", "Dark"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </header>
      <Reports result={window.CODELINES_REPORT!} />
      <footer>
        CodeLines · Report calculations ported from ccstats; see application
        Third-party notices.
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Standalone />);
