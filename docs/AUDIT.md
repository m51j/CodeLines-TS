# Source audit and resolutions

Source: `D:\Work\_Core\CodeLines`, commit `09e711258a8b713c76a80bb9e1bb58b041465264`, clean at the start of the audit. The original repository is kept unchanged. `source-inventory.json` records hashes and sizes for source, fixtures, tests, themes, and build configuration.

## Specification evidence

- `MainWindow.xaml`, code-behind, App resources, themes and assets define seven pages, native dialogs, optional page visibility, export actions, scrolling, selected-row details and the local blue CodeLines identity.
- All MainViewModel partials and ProjectItem/AiUsageAgent view models define scan merging, explicit persistence, exclusions, history invalidation, cancellation, coalesced progress/ETA, daily selection, AI refresh and attribution.
- Core Models define metric semantics, default settings, enum values, stored snapshots/history, per-project daily lines, day/agent/project AI amounts, and default-exclusion revisions.
- Every Core Services implementation was examined for calculation and filesystem behavior: LanguageRegistry, FileClassifier, LineMetricsAnalyzer, TokenCounter, SourceScanner, GitIgnoreRuleProvider, JSON repositories, ProjectListFile, exports, GitHistoryAnalyzer, DailyLogRecorder and DailyLogComparer.
- AI scanner/aggregators, file cache, clock, project matching, rates, payload writer, report builder, every registered adapter and variant, read-only SQLite and protobuf helpers establish source discovery and aggregation behavior.
- The three templates and UPSTREAM notice establish all report tabs, range/group filters, summaries, activity and time charts, tables, project/session details, Claude card comparisons and sticky/selectable path behavior.
- Both test projects establish behavior beyond README claims. Synthetic Claude transcripts and all three golden payloads are reused without regeneration. Temporary repository and adapter cases were ported into TypeScript tests.

## Resolved differences

1. README says seven projects are seeded. Current `AppSettings` and `New_settings_start_with_no_projects` prove the implemented behavior is an empty project list. The replacement starts empty.
2. Mixed lines overlap code lines, while CommentLines counts comment-only lines. Documentation uses ContentLines, with zero code/comment totals. Tests take precedence over ambiguous prose.
3. A single-project scan merges prior results only when scope and tokenizer match. Daily recording always replaces only that project's daily record. These are different persistence rules and are retained separately.
4. Daily timelines use last-known values for unscanned projects and only emit days with a selected scan or positive relevant AI usage. Historical AI values remain when logs disappear; today can shrink. Dates missing from a new AI payload remain untouched, matching the original.
5. The original combined Claude payload always deduplicates even if its own detailed page is in raw mode. This intentional difference is preserved and documented.
6. Claude unknown models retain legacy fallback rates; unknown models in other adapters remain unpriced. Cost precedence, cache-TTL treatment, and greatest-output deduplication are validated by full golden payload comparisons. No current-pricing assumptions replace the original tables.
7. Git NetChange uses captured HEAD and the first earlier commit on the captured first-parent chain, including an empty-tree baseline. Activity commit count includes selected commits even if scope excludes their files. Shallow boundaries never become artificial full-tree additions. The existing overlap between ModifiedEstimate and added/deleted totals is preserved.
8. The legacy line analyzer is deliberately a lightweight per-line string/comment state machine, not a compiler lexer. Its order of marker handling and per-line quote reset are retained for established parity, including known limitations around multiline language strings and specialized comment syntax.
9. Two demonstrated legacy defects are corrected: nonanchored rules in nested `.gitignore` files are confined to that subtree; and Cline's cache includes its companion header modification time, preventing stale model/workspace attribution when only that header changes. Targeted regression tests cover both.
10. Legacy report session date filtering always used machine-local dates even with UTC facts. The shared report selector uses the payload clock for consistent filtering and session dates. This corrects a timezone boundary defect rather than changing the underlying hourly payloads.
11. Legacy general analysis CSV did not protect formula-looking text. All CSV exports now protect such cells, matching the protection already implemented in history/daily exports. JSON metrics and CSV numeric values retain their meanings.
12. Persistence adds explicit schema validation, per-file serialized atomic writes, prior-save backups and recoverable/idempotent migration. Legacy timestamp strings, IDs, enum meanings, numeric metrics and TimeSpan durations are retained. Duplicate roots map imported references to the active project identity. Incompatible pre-existing snapshots/history remain recoverable in migration backups rather than being silently discarded from disk.
13. A separate temporary .NET reference program generated 12 tokenizer samples using the original Microsoft.ML.Tokenizers 2.0.0 versions. Both TypeScript encodings match these Unicode/code/newline/special-token counts. Special-token recognition and BOM-specific decoding fallback follow the old implementation. The reference generator is outside the deliverable; the application and its test suite require no .NET runtime.

Read-only inspection of the actual legacy files confirmed the expected root shapes: settings contains projects, scanOptions, theme, lastSnapshot, gitHistory, lastGitHistory, aiUsage and dailyLog; daily-log contains version 1 and days. Snapshot durations are TimeSpan strings. No live legacy data was imported or used as a test fixture.

## Platform and scope

Windows is the verified target. Domain/report calculations have no Electron dependency. SQLite is supplied by Electron's Node runtime; no native addon rebuild or external database service is required. Git is a read-only local optional dependency. Network requests are blocked in the production Electron session, and exported reports use a `connect-src 'none'` policy.

No private live transcripts or real repositories are used as test fixtures. The legacy .NET tests were inspected as specifications; the replacement's TypeScript and desktop tests exercise the port directly without building or modifying the source repository.
