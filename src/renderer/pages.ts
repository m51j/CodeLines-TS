import {
  LayoutDashboard,
  FolderOpen,
  ChartNoAxesCombined,
  GitBranch,
  CalendarDays,
  Sparkles,
  Settings as SettingsIcon,
} from "lucide-react";
import type { Settings } from "../shared/contracts";
/** The pages every skin offers, in navigation order. */
export type Page =
  | "Dashboard"
  | "Projects"
  | "Analysis"
  | "Code changes"
  | "Daily log"
  | "AI usage"
  | "Settings";
export interface PageDef {
  name: Page;
  icon: typeof LayoutDashboard;
  hint: string;
  /** Pages whose numbers come from a source scan show the scan controls. */
  scan?: boolean;
  /** Pages that Settings can turn off. */
  optional?: boolean;
}
export const pageDefs: PageDef[] = [
  { name: "Dashboard", icon: LayoutDashboard, hint: "Your workspace at a glance", scan: true },
  { name: "Projects", icon: FolderOpen, hint: "The source of your numbers", scan: true },
  { name: "Analysis", icon: ChartNoAxesCombined, hint: "Explore every line and token", scan: true },
  { name: "Code changes", icon: GitBranch, hint: "Committed activity, captured locally", optional: true },
  { name: "Daily log", icon: CalendarDays, hint: "The shape of your work over time" },
  { name: "AI usage", icon: Sparkles, hint: "Local agents, one clear picture", optional: true },
  { name: "Settings", icon: SettingsIcon, hint: "Make CodeLines work your way" },
];
export const pageEnabled = (name: Page, s: Settings) =>
  (name !== "Code changes" || s.gitHistory.enabled) &&
  (name !== "AI usage" || s.aiUsage.enabled);
export const visiblePages = (s: Settings) =>
  pageDefs.filter((p) => pageEnabled(p.name, s));
/** What a skin's shell receives: the page to show and how to change it. */
export interface ShellProps {
  page: PageDef;
  visible: PageDef[];
  setPage: (page: Page) => void;
}
