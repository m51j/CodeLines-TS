# Changelog

## 1.1.0 — 2026-11-03

Downloads are `CodeLines.Setup.1.1.0.exe`, `CodeLines.1.1.0.exe`, and `SHA256SUMS.txt` under [v1.1.0](https://github.com/m51j/CodeLines-TS/releases/tag/v1.1.0).

### Desktop widget and motion

- Add an optional desktop widget, turned on in Settings. It shows tokens, active time and streak for today, 30 days or all time, a heatmap sized to the window, per-project time and tokens, and all-time and code totals.
- Refresh AI usage in the background while the widget is visible. Keep CodeLines in the notification area when the main window closes, with a tray menu and an optional start with Windows.
- Record active time (gaps of up to five minutes between a session's records) in the AI report and the daily log.
- Animate value changes, heatmap entry, usage bars, tab panels, details and tooltips across the app, the widget and the offline report, respecting reduced motion.

## 1.0.0 — 2026-10-23

### Naming and documentation refresh

Version 1.0.0 is refreshed in place with the CodeLines name. Downloads are `CodeLines.Setup.1.0.0.exe`, `CodeLines.1.0.0.exe`, and an updated `SHA256SUMS.txt`.

- Use CodeLines as the application name, including the title bar, launch scripts, and newly built installer and portable executables.
- Present features, installation, and everyday use in the README, with detailed development and analysis documentation in [the technical reference](docs/TECHNICAL.md).
- Preserve the existing application-data directory, Chromium profile, installer identity, and published release links.

### Initial publication

Initial public release. Downloads and release notes are available under [v1.0.0](https://github.com/m51j/CodeLines-TS/releases/tag/v1.0.0).

- Offline Windows x64 desktop application with Dashboard, Projects, Analysis, Code changes, Daily log, AI usage, and Settings.
- Local source metrics, optional Git history, daily comparisons, synthetic-fixture-tested agent usage adapters, and self-contained offline reports.
- JSON and CSV exports, local data recovery and legacy import, custom title bar, light/dark themes, and keyboard-accessible report controls.
- MIT license, bundled dependency notices, Windows installer and portable builds, automatically generated SHA256 checksums, and checksum verification.
- Windows CI, manual release-artifact builds, dependency update proposals, and contribution/security-reporting guidance.

Builds are unsigned. AI costs use frozen API-equivalent rates, not billing statements. See README.md and docs/VERIFICATION.md for limitations and measured validation results.
