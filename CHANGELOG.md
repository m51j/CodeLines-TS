# Changelog

## Unreleased

### Automatic updates

- Check GitHub Releases for a new version shortly after startup and every six hours. The installed app downloads updates in the background and installs them on **Restart to update**, or the next time it closes. The portable app shows a **Download** button that opens the release page.
- Add an **Updates** block to About in every skin with the status, a download progress bar, **Check for updates**, and a switch to turn off automatic checks. Add **Check for updates** to the command palette and the tray's Help menu, a tray item to restart into a downloaded update, and a corner notice when one is ready.
- Publish releases from a `v<version>` tag: the workflow tests and packages the app, then uploads the executables, `latest.yml`, the installer blockmap and checksums, with notes taken from this changelog.
- Name release files without spaces (`CodeLines-Setup-<version>.exe`, `CodeLines-<version>-portable.exe`) so they match the update feed.
- Versions before this one have no updater; install it by hand once.

### About and help

- Add an About section to Settings in every skin with the version, the developer (NEXTE, nex-te.com) and links to the GitHub repository, issues and release notes. Links open in the default browser; the app window itself stays offline.
- Add Help entries to the command palette (About, GitHub repository, report an issue, release notes, NEXTE website) and a Help submenu to the tray menu.
- Show the version, the developer and a GitHub link in Instrument's title-bar About popover.
- Credit NEXTE in the installer and executable copyright line.

### Documentation

- Replace the README screenshots with the default Linework skin (dark dashboard, light AI usage and the desktop widget) and describe skins and the command palette.
- Add `--scale` and `--widget` options to `scripts/skin-shots.ts` for sharp, reproducible README screenshots.

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
