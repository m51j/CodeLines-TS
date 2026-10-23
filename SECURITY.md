# Security reporting

## Supported versions

Security fixes target the latest source on the default branch and the latest published stable release. Version 1.0.0 is the initial release line. Older builds should be updated before reproducing a problem. Check GitHub Releases for published binaries; a local build is not evidence that a release has been published.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/m51j/CodeLines-TS/security/advisories/new) when it is enabled. Include the affected version, reproduction steps using synthetic data, impact, and a minimal sanitized proof of concept. Do not include credentials, live conversations, or private project files.

If private reporting is unavailable, open an issue titled **Private security reporting request**, containing only a request to enable a private reporting channel. Do not disclose the vulnerability in that issue. The maintainer can then enable private vulnerability reporting before receiving the details. No response-time guarantee is currently offered.

## Local data and exports

The application reads selected local projects and supported agent stores. Data remains on the computer during normal offline analysis, but exported JSON, CSV, HTML, application data, and screenshots can contain project paths and usage information. Review them before sharing. Unsigned Windows binaries should be downloaded from a maintainer-published release or built from source; check the accompanying SHA256 manifest to detect altered or incomplete downloads.
