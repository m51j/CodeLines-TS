# Feature-parity checklist

Implementation map for the legacy application. “Verified” refers to the checks named below; it does not imply every possible third-party database version or OS has been tested. The final run record is in VERIFICATION.md.

| Feature | Replacement | Validation |
|---|---|---|
| Seven pages and optional Git/AI navigation | `renderer/App.tsx`, shared controls/styles | Desktop navigation in light/dark |
| Dashboard project/file/physical/code/source/30-day AI totals | App dashboard; domain metrics; AI payload totals | Core/parity/report tests; desktop scan |
| Project selection, language shares, latest scan, empty states | Dashboard and Analysis selection state | Desktop UI and screenshots |
| Native add, name/path edits, enable/remove, per-project excludes | Projects editor + main native folder handler | Import/domain tests, desktop native dialog stubs |
| Individual/all-enabled scans; compatible-result merging | Main orchestrator + scan worker | Scanner tests, desktop IPC and UI scan |
| Portable project JSON, bare arrays/settings imports, path duplicates | `services/persistence.ts` importProjectList | Core persistence/import tests |
| Project attributed all-time/30-day AI tokens/cost | `domain/daily.ts` longest-root matcher | Attribution tests incl. nested/WSL paths |
| Every scan metric, byte/file/token counts | `domain/lines.ts`, `domain/metrics.ts` | Legacy-derived line tests and scanner fixtures |
| Project/language/category/file analysis and warnings | Analysis tabs and filtered tables | Core scan tests; desktop navigation |
| CSV/JSON full analysis exports | `services/exports.ts`, native save dialog | Report/export tests, desktop JSON/CSV |
| SourceOnly/SourceAndConfiguration/AllText | Language classifier and options | Scope fixture tests |
| All 38 languages, extensions, exact names, comment delimiters | `domain/languages.ts` | Classifier tests + audited registry |
| Mixed/string/comment/content/newline semantics | `domain/lines.ts` | Explicit line tests |
| UTF-8/UTF-16 BOM, binary detection and invalid text | `services/scanner.ts` decode/detection | Byte fixtures, BOM fallback cases |
| Real offline o200k_base/cl100k_base BPE | js-tiktoken vocabularies bundled into worker | 12 Microsoft.ML.Tokenizers golden samples × both encodings; packaged scan |
| Maximum file size, bounded parallelism, warnings/cancellation | Scanner + worker cancellation IDs | Scanner size/cancel/progress tests; desktop cancellation |
| Reparse/symlink loops, nested clones/worktrees | Discovery guards | Nested-checkout fixtures; symlink regression |
| NuGet packages content detection; npm packages retained | Scanner discovery | Scanner NuGet/workspace fixture |
| Ordered global/root/nested/project ignores | `services/ignore.ts` | Ignore anchoring/glob/negation/subtree tests |
| Default exclusion upgrades preserve user edits | `domain/defaults.ts` revision upgrade | Persistence upgrade-once test |
| Git optional, presets/custom 1–36500 days, Activity/NetChange | History UI/options and analyzer | Git validation and desktop history |
| Captured HEAD/end, first-parent/merge semantics | `services/history.ts` | Temporary merge/revert/boundary repositories |
| No worktree changes, no remote contact, empty-tree baseline | Read-only argument-array Git commands | Reverted/uncommitted, new-repository tests; command audit |
| Scope, deleted paths, subfolders, rename scope crossings | History Included/Accumulate logic | Temporary subfolder/rename/deletion/binary/Unicode cases |
| Added/deleted/modified-overlap/net/files/binary/commits | Domain history totals and analyzer | Tests and export assertions |
| Missing Git, no commits, unavailable/shallow/incomplete/cancel | Explicit history statuses | Temporary missing/shallow/cancellation tests |
| Progress stages, throttling, partial totals, current-project ETA | Worker 250 ms progress and history progress UI | Git progress assertions; desktop operation test |
| History CSV RecordType and JSON aggregate totals | History exporter | Unit and packaged desktop CSV assertions |
| Latest scan per project/day; retain other projects | `domain/daily.ts` recordLines | Daily replacement tests |
| Carry-forward, notes, daily deltas, enabled/project filters | Timeline/effective entries and Daily log UI | Daily timeline/filter tests |
| Two-date totals and language comparison, scope/tokenizer warning | compareDays + comparison tables | Daily tests and desktop navigation |
| AI by day/agent/project, local/UTC and retention rules | recordAi and dayParts | Daily AI/attribution/bucketing tests |
| Today refresh, historic no-shrink, missing-day retention | Daily recorder | Explicit historical retention test |
| Refresh AI after scan setting | App scan completion flow | Desktop UI post-scan test |
| Claude JSONL discovery/subagents, normalization, dedupe/raw | AI Claude scanner/aggregator | All 685 synthetic records + deduplicated/raw golden payloads |
| Codex active/archived rollouts and re-emits | Codex adapter | Synthetic rollout/archive/cache tests |
| Antigravity IDE, Antigravity and agy SQLite/protobuf | Variant adapters + protobuf decoder | Synthetic DB/blob test for every variant |
| ZCode | Read-only SQLite model_usage mapping | SQLite fixture and packaged node:sqlite test |
| opencode and Kilo Code | Separate SQLite roots, common mapping | Per-variant reasoning/free/recorded-cost fixtures |
| Cline | Header + per-message metrics | Cache subtraction/header invalidation tests |
| Copilot Chat | Patch replay, largest completion, sparse/splice | Synthetic patch-log test incl. unsafe-key rejection |
| Hermes | Per-session usage and actual/estimate cost precedence | SQLite zero/estimate/unknown/call-count fixture |
| LM Studio | Selected-generation steps, fallback time/model, known zero | JSON version selection fixture |
| Malformed records and independently failing sources | Per-record and per-agent isolation/statuses | JSON/SQL tests and builder statuses |
| Incremental/full rescan/cache versions | `ai/io.ts` and builder | Cache reuse/tamper/full-rescan fixtures |
| Agent enable flags, extra Claude roots, UTC, auto-refresh | Settings and builder contracts | Builder/desktop settings tests |
| Cache-inclusive real totals, recorded/list/unknown/partial cost | Typed vectors and frozen rates | Golden payloads + cost tests |
| All/per-agent report navigation and range/group filters | Shared Reports + report selectors | Report selector invariants; desktop tabs/filters |
| Overview summaries/agent comparison/activity/token distribution | Shared React reports | Selectors and desktop screenshots |
| Model daily stacks, full model metrics and shares | Shared report chart/table | Totals invariant and desktop Models tab |
| Hour bars, weekday/hour heat, daily stacks, monthly tables | Shared report Time tab | Selector sum invariants and desktop Time tab |
| Exact breakdown/distribution/cost coverage/components | Shared Tables tab | Cost/coverage/TTL selector tests |
| Claude app-card comparison, raw inflation, unknown fallback detail | Shared selectors + Claude-specific sections | Golden/raw tests, desktop Claude Tables |
| Project/session tables, top 40, shares, sticky/selectable paths | Shared Table and Reports | Long-path clipping/tooltip/scroll desktop checks |
| JSON/self-contained HTML/default-browser report | Shared export model + compiled React bundle | Injection tests; exported HTML opens without IPC/network |
| System/light/dark; explicit settings save/discard | Theme tokens/settings state | Desktop light/dark, save/reload checks |
| Separate main/preload/renderer/worker/domain boundaries | `src/main`, shared contracts, services/domain | Strict typecheck, lint and package startup |
| Context isolation, sandbox, Node off, restricted IPC/permissions/navigation | Main and small named preload bridge | Desktop web-preference checks and renderer require absence |
| Validated requests/persisted data, structured errors, stale IDs | Zod schemas/envelopes, operation guards | Typecheck, persistence corruption, desktop conflicting/cancel checks |
| Read-only agent DBs with locked-store copy fallback | `ai/io.ts` | DB unchanged assertion, active WAL/exclusive-lock test |
| Legacy settings/snapshot/history/daily migration | Store migrate + persisted schemas | Idempotent migration, TimeSpan, corruption/recovery tests |
| Atomic/versioned/serialized saves and backups | Persistence queue and schemas | Ordered concurrent save test and backup recovery |
| Keyboard focus, named scroll regions, large-table pagination | Shared controls/CSS | Desktop accessibility attributes, screenshots; full screen-reader audit not performed |
| Small-window and high-DPI layout | Responsive tokens/layout | 950×700 screenshot; physical multi-monitor DPI not verified |
| Assets, attribution, production licenses | assets + notices/license generation | Source inventory and packaged files |
| Installer/portable build, no dev server/.NET/backend/ccstats | Electron Builder targets + bundled files | Final packaged/installed startup tests in VERIFICATION.md |

No core feature is intentionally replaced with a placeholder. Platform behavior and manual verification limits are listed separately from implemented feature coverage.
