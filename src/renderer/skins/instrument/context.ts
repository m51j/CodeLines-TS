/** What the Instrument shell offers its pages, and the selections pages keep between visits. */
import { createContext, useContext } from "react";
import type { Page } from "../../pages";
export interface SkinApi {
  go: (page: Page) => void;
  /** The AI usage report's agent tab ("all" or an agent id); the palette can open one. */
  aiAgent: string;
  setAiAgent: (id: string) => void;
  openPalette: () => void;
}
export const SkinContext = createContext<SkinApi | null>(null);
export function useSkin(): SkinApi {
  const api = useContext(SkinContext);
  if (!api) throw new Error("useSkin must be used inside the Instrument shell.");
  return api;
}
export interface AiSelection {
  tab: "Overview" | "Models" | "Time" | "Tables" | "Projects";
  range: number;
  group: "agent" | "model";
  since: string;
  until: string;
}
/** Page selections remembered for this session (the prototype kept them on its app object). */
export const memo = {
  aiSel: {} as Record<string, AiSelection>,
  analysisTab: "Languages" as "Languages" | "Categories" | "Files" | "Warnings",
  projectId: "",
  dashMetric: "physicalLines" as "physicalLines" | "codeLines" | "totalTokens" | "fileCount",
  daily: { project: "enabled", allAgents: true, dateA: "", dateB: "", metric: "physicalLines" },
  aiSourcesOpen: false,
};
