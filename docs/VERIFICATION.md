# Verification — 2026-10-21

The implementation is in `D:\Work\_Core\CodeLines-TS`. The original `D:\Work\_Core\CodeLines` repository remained clean at commit `09e711258a8b713c76a80bb9e1bb58b041465264`. Legacy data was inspected for schema shape only; it was not imported, overwritten, or used as test data.

## Environment and reproducibility

- Windows x64, OS build 10.0.26300.
- Development Node.js 24.21.0 and npm 11.19.0.
- Locked versions include Electron 45.0.0, React 19.3.1, TypeScript 5.9.3, Vite 7.3.7, js-tiktoken 1.0.21, Recharts 3.10.1, Zod 4.6.7, and Electron Builder 26.15.3.
- A clean `npm ci --no-audit --no-fund` succeeded from the delivered lockfile.

## Completed checks

| Check | Result |
|---|---|
| Strict TypeScript, including main/preload/worker/domain/renderer/test scripts | Passed: `npm run typecheck` |
| Lint with zero allowed warnings | Passed: `npm run lint` |
| Unit/service tests | **59 passed in 6 files** |
| Tokenizer parity | 12 reference texts × both encodings match Microsoft.ML.Tokenizers 2.0.0, including Unicode, code, newline and special-token handling |
| Claude scanner and aggregate parity | All 685 synthetic source records, deduplicated/raw Claude goldens, and combined-agent golden payload passed |
| All adapter variants | Synthetic JSON/JSONL/SQLite/protobuf fixtures cover every registered adapter and Antigravity variant |
| SQLite safety/concurrent writers | Source DB bytes unchanged; WAL read while a writer transaction is active; exclusive-lock private-copy fallback passed |
| Git semantics | Temporary repositories cover first-parent merges, reverted edits, empty-tree/exact-boundary baselines, working-file exclusion, scope/deleted paths, subfolders, renames, Unicode, binaries, missing Git, shallow history and cancellation |
| Daily log | Same-day replacement, other-project retention, carry-forward, deltas, language comparison, contract warnings, project attribution and historical AI retention passed |
| Persistence | Legacy TimeSpan/snapshot/daily compatibility, exclusion upgrades, duplicate paths/IDs, serialized writes, malformed-file backup recovery and idempotent migration passed |
| Reports and exports | Selector sum invariants, ranges, grouping, Claude cost components/card shares, unknown/partial/zero costs, injection-safe HTML/CSV and export record types passed |
| Production build | Passed: Vite renderer, CJS Electron entries/worker, offline report bundle and vocabularies |
| Windows packaging | Passed: NSIS installer and portable target generated |
| Production dependency audit | `npm audit --omit=dev --json`: zero reported vulnerabilities at validation time |

## Actual installed application

The NSIS installer completed with exit code 0 in an isolated workspace test directory. The installed `resources/app.asar` matched the final unpacked package byte-for-byte:

```text
ceb0608c4af0e7217b29744af5d4d80e3753a313aa62071ae2c56e633aee0493
```

The full desktop suite was then run against that **installed executable**, with separate temporary data, fake agent roots and temporary Git repositories. It passed:

- Context isolation on, Node integration off, sandbox on; renderer `require` unavailable.
- Actual scan worker using the packaged offline BPE vocabularies; resulting snapshot and daily record persisted.
- Actual Git worker and committed-line counts.
- Claude fixture parsing and packaged `node:sqlite` access through the ZCode fixture.
- Cancellation without replacing the previous complete snapshot; conflicting scan/history work rejected.
- Native folder picker and file import handlers with deterministic test dialog selections.
- All seven pages, every report tab, range and group filtering, light/dark themes, and a 950×700 window.
- Long project paths clipped in their scroll region while preserving selectable text and the full tooltip.
- Explicit settings save/reload, automatic first-open AI refresh once per session, and post-scan AI refresh.
- Projects/analysis/history/AI JSON, analysis/history/daily CSV and self-contained HTML export.
- Exported HTML opened directly with no IPC bridge or external script/style URLs, with all report tabs working.
- Chromium forced offline throughout these runtime checks. No development server, .NET runtime, external ccstats directory, account, API key or backend was used.

Screenshots were captured from hidden application windows using Electron's native capture API and visually inspected. The initial CDP screenshot method timed out for hidden packaged windows; changing the test capture method resolved that harness issue. An earlier test was interrupted by the installer's normal process cleanup; the successful final installed-app run was performed sequentially after installation.

## Actual portable executable

`npm run test:portable` launched `release/CodeLines TS 1.0.0.exe` itself, including its extraction/launcher wrapper. The smoke test passed local-file startup, forced-offline Chromium, a real packaged scan worker with BPE, and snapshot persistence. The test closed the application and exited successfully. This complements the broader installed-executable suite above.

## Deliverables and limits

The source archive includes the implementation, lockfile, assets, all tests/public fixtures, README, feature-parity matrix, audit resolutions, source inventory, and third-party notices/licenses. SHA256SUMS.txt accompanies the delivered binaries and archive.

- Builds are unsigned; no signing certificate was available or used.
- Windows x64 is verified. macOS/Linux packaging, other Windows versions/architectures, physical multi-monitor DPI changes and a full screen-reader audit were not performed.
- Native dialog APIs were exercised with deterministic test selections; the operating system's interactive picker UI was not manually tested.
- Third-party agent schema coverage uses isolated fixtures, not private live transcripts or every historical release of every agent. Per-agent failures remain visible and do not suppress other agents.
- Core line parsing intentionally retains the legacy lightweight string/comment analyzer and its language-specific limitations; it is not a compiler parser.
- Vite emitted non-fatal third-party annotation and large-bundle warnings. npm emitted development/transitive deprecation notices. Builds, tests, packaging and runtime checks succeeded.
- The temporary installation was used solely for validation and is removed after testing; the delivered installer/portable executable remain available for normal use.

No core page or agent adapter is intentionally left as a placeholder. See FEATURE-PARITY.md and AUDIT.md for the implementation map and explicitly documented behavior resolutions.

