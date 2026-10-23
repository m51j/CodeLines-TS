# Verification — 2026-10-21

The implementation is in the CodeLines TS repository. The original CodeLines repository remained clean at commit `09e711258a8b713c76a80bb9e1bb58b041465264`. Legacy data was inspected for schema shape only; it was not imported, overwritten, or used as test data.

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


## AI usage presentation update — 2026-10-21

The refreshed shared React report was verified from the source-built Electron application with isolated synthetic agent data. Type checking, zero-warning lint, all **60 unit/service tests**, the production build, and the expanded `npm run test:desktop` suite passed. The desktop suite covers agent-specific tab/range/group restoration, date validation and empty ranges, stable model colors, keyboard tab navigation, hover/focus tooltips, refresh without losing selections, collapsible source statuses, and the same interactions in an exported standalone HTML report with Chromium offline.

Native screenshots now wait for a rendered frame before capture. Overview, Time and Projects were checked in light/dark themes at normal size and 950×700. Additional synthetic standalone previews cover labeled activity calendars, weekday/hour axes and failed source details. Screenshots are under `artifacts/desktop/` (`built-ai-*` and `ai-activity-*` / `ai-heatmap-*`). The original golden totals, Claude cost behavior and unknown/partial/known-zero costs remain covered by the tests.

The installer and portable binary were subsequently regenerated with `npm run package` for this UI update. `npm run test:desktop -- --packaged` passed against the newly packaged executable, including the expanded AI report checks and standalone offline HTML. `npm run test:portable` passed against the new portable wrapper itself. The new NSIS installer was generated successfully; it was not installed during this follow-up. SHA256 checksums for both executables are recorded in `release/SHA256SUMS.txt`. The current packaged `resources/app.asar` SHA256 is `f357ffba46c4f1a382024c2e4358d076e71e6cbd90f8d6a455a4c89155fa78d5`; the earlier installed-app record above describes the previous package.

## Custom title bar — 2026-10-21

The source-built desktop now uses a frameless Electron window with a themed React title bar. The bar remains available during startup, defines a native drag region, and provides accessible minimize, maximize/restore, and close controls through the validated preload bridge. Focus and maximize events from the operating system update its appearance and restore icon.

TypeScript, zero-warning lint, all **60 unit/service tests**, the production build, and the full `npm run test:desktop` suite passed. Desktop coverage includes light/dark title-bar colors, drag/control regions, actual OS minimize/maximize/restore/close actions, externally triggered maximize events, inactive styling, invalid-action rejection, and the existing offline reports/navigation/export checks at normal and 950×700 sizes. Window-control checks target the main window explicitly after a separate report window is opened. A focused runtime check also passed System appearance in both emulated color schemes and keyboard activation of maximize.

The new bar was visually checked in `artifacts/desktop/built-dashboard-light.png`, `built-dashboard-dark.png`, and `built-small-window.png`. This follow-up rebuilt `dist/`; the installer and portable executable were not regenerated for the title-bar change.

## Public repository preparation — 2026-10-23

This follow-up prepares version 1.0.0 for public hosting under MIT, following the maintainer's confirmation of rights to CodeLines, ccstats, and their derived assets. Existing README screenshots and independently generated fixtures were retained. The earlier records above describe their respective builds; the following results describe the newly generated binaries.

| Check | Result |
|---|---|
| Clean locked install | `npm ci --no-fund` passed after normally closing a running source-built app that had locked Electron DLLs |
| Dependency security audit | `npm audit --json` and `npm audit --omit=dev --json`: zero reported vulnerabilities |
| Test dependency upgrade | Vitest and @vitest/mocker 4.1.12; the previous tinypool dependency is absent |
| Type checking, lint, tests, production build | `npm run verify` passed: **74 tests in 8 files**, including all 70 existing tests and 4 new release-integrity tests |
| Checksum regression coverage | Known SHA256 vectors and filenames with spaces; altered executable rejection; missing/empty executable rejection; removal of a stale manifest on failed generation |
| Source-built desktop | `npm run test:desktop` passed with isolated data, synthetic agent stores, and Chromium offline |
| Windows x64 packaging | `npm run package` generated NSIS and portable executables with publishing explicitly disabled and fresh checksums |
| Packaged desktop | `npm run test:desktop -- --packaged` passed against the new unpacked application, including all pages, workers, native window controls, themes, small windows, imports, exports, and standalone offline reports |
| Actual portable wrapper | `npm run test:portable` passed launch, local-file/offline startup, real BPE scan worker, and snapshot persistence |
| Checksum verification | `npm run checksums:verify` passed; PowerShell `Get-FileHash` independently matched both manifest entries |
| Packaged contents | MIT license, attribution, and dependency notices match the source files byte-for-byte inside app.asar; main/preload/worker bundles match the current build, and packaged metadata declares MIT / 1.0.0 |
| Workflow validation | Both workflows passed actionlint 1.7.12; workflow, Dependabot, and issue-form YAML parsed successfully; official actions are pinned to full commit SHAs with read-only repository permissions |
| Repository hygiene | No matches in a targeted credential-pattern search of tracked and non-ignored source files; ignore rules exclude local data, credentials, recovery/temp files, and build artifacts without excluding fixtures or environment examples; no whitespace errors |

The first packaged desktop run reached the final native-window checks but failed a timing-sensitive inactive-titlebar assertion after `restore()` followed immediately by `blur()`. The test harness now transfers focus to its real report window, checks OS focus state and inactive styling, then transfers focus back and checks active styling. A focused packaged smoke check and the complete packaged suite passed after this harness-only change. Type checking and lint also passed again. Application behavior was not changed.

The current packaged `resources/app.asar` SHA256 is:

```text
d7cc3ec8ea925f16b50b9bb3c0a61763a7e8f9cb18fe3d2652be3bc07e4d9944
```

The new `release/SHA256SUMS.txt` contains:

```text
eb0bf98bffd9f383f4e51e1f59ac07bb5987059304abb801f42e1c07e65e60e9  CodeLines TS Setup 1.0.0.exe
37f4ad3fa809a637c1a3a328fce93c5057a1ccd8e69b83bbac4b748206955076  CodeLines TS 1.0.0.exe
```

The earlier publication review also searched text blobs reachable from the 17 locally available Git commits without finding obvious credential patterns; this is a targeted hygiene check, not a comprehensive security audit. Build warnings about Zod annotations and renderer bundle size, and npm deprecation/install-script-policy notices, did not prevent installation, building, or runtime checks. The installer was generated but was not installed during this follow-up. Builds remain unsigned. GitHub-hosted workflow execution, repository visibility changes, branch-protection/security settings, pushes, tags, and Release publication were not performed. See [PUBLISHING.md](PUBLISHING.md) for the remaining remote publication steps.

## CodeLines naming and documentation follow-up — 2026-10-23

This section records the local builds after adopting the CodeLines display name. Earlier sections retain the names and hashes of the builds they verified. Published v1.0.0 downloads were not changed.

- `npm run verify` passed type checking, zero-warning lint, all **74 unit/service tests**, and a production build.
- `npm run test:desktop` and `npm run test:desktop -- --packaged` both passed, including the CodeLines page/title-bar text, runtime application name, custom data-directory override, workers, reports, exports, persistence, themes, responsive layouts, and native window controls. The packaged executable was `release/win-unpacked/CodeLines.exe`. Screenshots are under `artifacts/desktop/`; visual inspection confirmed the title bar displays CodeLines without an edition badge.
- A separate startup probe used synthetic existing settings and an existing Chromium profile under isolated local/roaming directories, with `CODELINES_DATA_DIR` unset. The actual built main entry reused `CodeLines-TS` application data and the `CodeLines TS` Chromium profile, loading the existing project and theme and preserving the profile marker.
- `npm run package` built the renamed installer and portable executable. `npm run test:portable` passed actual wrapper launch, the CodeLines title and brand, offline startup, a real packaged scan/BPE worker, and saved scan results.
- `npm run checksums:verify` passed for both new executables. Windows executable metadata reports CodeLines as its product name and description. The packaged npm name is `codelines`; bundled license and attribution files match the build outputs byte-for-byte. The installer identifier, dependency versions, repository links, and attribution content remain unchanged apart from the application name.
- Local links and anchors in README.md and TECHNICAL.md resolve. The README presents features, installation, and everyday use; development, storage, import, analysis, and architecture details are in [TECHNICAL.md](TECHNICAL.md).

The local build manifest contains:

```text
680fbb6ffa4137051d46dc0f1174f3dc3a3bf35dc3d81703f1e867c16a76405c  CodeLines Setup 1.0.0.exe
ce09a4645a445357422ce5f4c74f8754d6ad5fe9d97a8a07387d701c19e451a2  CodeLines 1.0.0.exe
```

The installer was generated but not installed. These builds remain unsigned. No repository rename, push, tag, or Release publication was performed; use a new version before publishing the renamed application, as described in [PUBLISHING.md](PUBLISHING.md).

## v1.0.0 in-place publication preparation — 2026-10-23

The maintainer explicitly authorized refreshing the same v1.0.0 release with the tested CodeLines binaries. This supersedes the earlier recommendation to use a new version for the naming change. Application sources and packaged contents are unchanged from the successful verification recorded above; only publication documentation is updated here.

The original release metadata, both original executables (verified against GitHub asset digests), and the original published checksum manifest are backed up in the ignored `release/publication-backup-v1.0.0/` directory. The upload files in `release/github/` use GitHub download names and retain the tested binary hashes:

```text
680fbb6ffa4137051d46dc0f1174f3dc3a3bf35dc3d81703f1e867c16a76405c  CodeLines.Setup.1.0.0.exe
ce09a4645a445357422ce5f4c74f8754d6ad5fe9d97a8a07387d701c19e451a2  CodeLines.1.0.0.exe
```

The publication update uses the existing release and version, three current assets, a CodeLines release title and description, and a source tag aligned with the refreshed source commit. Previous build records and original hashes above remain historical evidence.
