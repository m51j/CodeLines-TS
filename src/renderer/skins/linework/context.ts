/** What the Linework shell lends its pages: navigation with a target tab, the scroller and shared picks. */
import { createContext, useContext, type RefObject } from "react";
import type { Page } from "../../pages";

export type AnalysisTab = "Languages" | "Categories" | "Files" | "Warnings";

export interface Shell {
  go: (page: Page, opts?: { tab?: AnalysisTab }) => void;
  /** The tab a drill-down asked Analysis to open (read once). */
  takeAnalysisTab: () => AnalysisTab | null;
  scroller: RefObject<HTMLDivElement | null>;
  /** The project picked on the Projects page, kept across visits. */
  projectSel: string;
  setProjectSel: (id: string) => void;
  openPalette: (mode?: "commands" | "shortcuts") => void;
  visible: Page[];
}

export const ShellContext = createContext<Shell | null>(null);
export function useShell(): Shell {
  const s = useContext(ShellContext);
  if (!s) throw new Error("useShell must be used inside the Linework shell.");
  return s;
}
