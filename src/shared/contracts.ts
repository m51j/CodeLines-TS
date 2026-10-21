import { z } from "zod";
export const scopes = [
  "SourceOnly",
  "SourceAndConfiguration",
  "AllText",
] as const;
export type Scope = (typeof scopes)[number];
export type Category = "SourceCode" | "Configuration" | "DocumentationText";
export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(500),
  rootPath: z.string().trim().min(1).max(32760),
  isEnabled: z.boolean(),
  excludePatterns: z.array(z.string().max(4096)).max(10000),
});
export type Project = z.infer<typeof projectSchema>;
export const scanOptionsSchema = z.object({
  countingScope: z.preprocess(
    (v) => (typeof v === "number" ? scopes[v] : v),
    z.enum(scopes),
  ),
  tokenizerEncoding: z.enum(["o200k_base", "cl100k_base"]),
  maxFileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(1024 ** 3),
  maxDegreeOfParallelism: z.number().int().min(1).max(128),
  globalExcludePatterns: z.array(z.string().max(4096)).max(10000),
  defaultExclusionsRevision: z.number().int().min(0),
});
export type ScanOptions = z.infer<typeof scanOptionsSchema>;
export const historyOptionsSchema = z.object({
  enabled: z.boolean(),
  days: z.number().int().min(1).max(36500),
  mode: z.preprocess(
    (v) => (typeof v === "number" ? ["Activity", "NetChange"][v] : v),
    z.enum(["Activity", "NetChange"]),
  ),
});
export type HistoryOptions = z.infer<typeof historyOptionsSchema>;
export const aiOptionsSchema = z.object({
  enabled: z.boolean(),
  useUtc: z.boolean(),
  deduplicate: z.boolean(),
  autoRefreshOnOpen: z.boolean(),
  disabledAgents: z.array(z.string().max(100)),
  extraClaudeRoots: z.array(z.string().max(32760)),
});
export type AiOptions = z.infer<typeof aiOptionsSchema>;
export interface Lines {
  physicalLines: number;
  blankLines: number;
  codeLines: number;
  commentLines: number;
  mixedLines: number;
  contentLines: number;
}
export interface FileMetric {
  projectName: string;
  relativePath: string;
  extension: string;
  language: string;
  category: Category;
  bytes: number;
  tokens: number;
  lines: Lines;
}
export interface LanguageMetric extends Lines {
  language: string;
  category: Category;
  files: number;
  bytes: number;
  tokens: number;
}
export interface CategoryMetric {
  category: Category;
  files: number;
  tokens: number;
  physicalLines: number;
  codeOrContentLines: number;
}
export interface ProjectMetric {
  projectId: string;
  projectName: string;
  rootPath: string;
  files: FileMetric[];
  languages: LanguageMetric[];
  categories: CategoryMetric[];
  warnings: string[];
  duration: number;
  fileCount: number;
  totalBytes: number;
  totalTokens: number;
  physicalLines: number;
  blankLines: number;
  codeLines: number;
  commentLines: number;
  mixedLines: number;
  contentLines: number;
}
export interface Snapshot {
  scannedAt: string;
  countingScope: Scope;
  tokenizerEncoding: string;
  projects: ProjectMetric[];
  fileCount: number;
  totalTokens: number;
  physicalLines: number;
  codeLines: number;
  contentLines: number;
}
export interface GitFile {
  path: string;
  added: number;
  deleted: number;
  modifiedEstimate: number;
  binary: boolean;
  net: number;
}
export interface GitProject {
  projectId: string;
  projectName: string;
  branch: string;
  head: string;
  status: string;
  isIncomplete: boolean;
  commits: number | null;
  files: GitFile[];
  added: number;
  deleted: number;
  modifiedEstimate: number;
  net: number;
  changedFiles: number;
  binaryFiles: number;
}
export interface GitTotals {
  added: number;
  deleted: number;
  modifiedEstimate: number;
  net: number;
  changedFiles: number;
  binaryFiles: number;
  commits: number | null;
  projects: number;
  incompleteProjects: number;
}
export interface HistorySnapshot {
  end: string;
  start: string;
  mode: HistoryOptions["mode"];
  scope: Scope;
  projects: GitProject[];
  totals: GitTotals;
}
export interface Settings {
  schemaVersion: 1;
  projects: Project[];
  scanOptions: ScanOptions;
  theme: "System" | "Light" | "Dark";
  lastSnapshot: Snapshot | null;
  gitHistory: HistoryOptions;
  lastGitHistory: HistorySnapshot | null;
  aiUsage: AiOptions;
  dailyLog: { refreshAiAfterScan: boolean };
}
export interface DailyEntry extends Omit<Lines, "mixedLines"> {
  projectId: string;
  name: string;
  rootPath: string;
  scannedAt: string;
  scope: Scope;
  tokenizer: string;
  files: number;
  bytes: number;
  tokens: number;
  languages: Omit<LanguageMetric, "bytes" | "blankLines" | "mixedLines">[];
}
export interface AiAmount {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  requests: number;
  cost: number;
  costPartial: boolean;
  tokens: number;
}
export interface DailyDay {
  date: string;
  lines: DailyEntry[];
  ai: {
    updatedAt: string;
    tz: string;
    total: AiAmount;
    byAgent: Record<string, AiAmount>;
    projects: ProjectUsage[];
  } | null;
}
export interface DailyLog {
  version: 1;
  days: DailyDay[];
}
export type Vector = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type ClaudeVector = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type Hours<V> = Record<string, Record<string, Record<string, V>>>;
export type AgentSession = [
  string,
  string,
  number,
  number,
  string,
  string,
  ...Vector,
];
export type ClaudeSession = [
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  string,
  string,
];
export interface AgentPayload {
  meta: {
    title: string;
    generatedAt: number;
    tz: string;
    tzLabel: string;
    countedRecords: number;
    droppedDuplicates: number;
    firstTs: number | null;
    lastTs: number | null;
    sessions: number;
  };
  agents: Record<string, { label: string; note: string }>;
  keys: string[];
  hours: Hours<Vector>;
  sessions: AgentSession[];
}
export interface Rate {
  input: number;
  output: number;
  cacheRead: number;
  write5m: number;
  write1h: number;
  known: boolean;
  label: string;
}
export interface ClaudePayload {
  meta: {
    generatedAt: number;
    tz: string;
    tzLabel: string;
    dedupe: boolean;
    rawRecords: number;
    countedRecords: number;
    duplicateRecords: number;
    partialRecords: number;
    inflation: number;
    firstTs: number | null;
    lastTs: number | null;
    sessions: number;
    unknownModels: string[];
  };
  rates: Record<string, Rate>;
  models: string[];
  hours: Hours<ClaudeVector>;
  sessions: ClaudeSession[];
  appBasis: Record<string, ClaudeVector>;
}
export interface AgentStatus {
  id: string;
  label: string;
  state: "NotFound" | "Disabled" | "Empty" | "Loaded" | "Failed";
  records: number;
  error?: string;
  elapsed: number;
}
export interface AiResult {
  generatedAt: string;
  combined: AgentPayload | null;
  claude: ClaudePayload | null;
  agents: AgentStatus[];
}
export interface ProjectUsage {
  projectId: string;
  sessions: number;
  tokens: number;
  cost: number;
  costPartial: boolean;
}
export type OperationKind = "scan" | "history" | "ai";
export interface Progress {
  id: string;
  kind: OperationKind;
  stage: string;
  project?: string;
  path?: string;
  completed: number;
  total: number | null;
  completedFiles?: number;
  totalFiles?: number;
  projectIndex?: number;
  projectCount?: number;
  elapsed: number;
  projectElapsed?: number;
  eta?: number;
  partial?: GitProject[];
}
export interface AppState {
  settings: Settings;
  daily: DailyLog;
  ai: AiResult | null;
  warnings: string[];
  dataDirectory: string;
}
export interface OperationResult {
  id: string;
  status: "completed" | "cancelled" | "failed";
  state: AppState;
  error?: string;
  failure?: DesktopFailure;
  partial?: GitProject[];
}
export interface DesktopFailure {
  code: "INVALID_INPUT" | "REQUEST_FAILED" | "OPERATION_FAILED";
  message: string;
  recoverable: boolean;
}
export type IpcResponse<T> =
  { ok: true; value: T } | { ok: false; error: DesktopFailure };
export type ExportKind = "projects" | "analysis" | "history" | "daily" | "ai";
export interface DesktopApi {
  load(): Promise<AppState>;
  save(settings: Settings): Promise<AppState>;
  addProject(): Promise<AppState>;
  importProjects(): Promise<AppState>;
  migrate(): Promise<AppState>;
  run(request: {
    id: string;
    kind: OperationKind;
    projectId?: string;
    rescan?: boolean;
    settings: Settings;
  }): Promise<OperationResult>;
  cancel(id: string): Promise<void>;
  export(request: {
    kind: ExportKind;
    format: "json" | "csv" | "html";
    projectIds?: string[];
    allAgents?: boolean;
  }): Promise<string | null>;
  openReport(): Promise<void>;
  onProgress(callback: (event: Progress) => void): () => void;
}
declare global {
  interface Window {
    codelines: DesktopApi;
    CODELINES_REPORT?: AiResult;
  }
}
