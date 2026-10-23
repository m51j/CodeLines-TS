# Contributing

CodeLines targets Windows x64, Node.js 24, npm, and Git. Install dependencies with `npm ci`, then use `npm run dev`. Use synthetic projects and agent records for development; do not commit real transcripts, credentials, local data, or screenshots showing private paths. If setting `CODELINES_DATA_DIR` manually, use a directory outside the checkout or the ignored `local-data/` folder; avoid using the repository root as a Chromium profile.

Before opening a pull request, run:

```powershell
npm audit
npm run verify
npm run test:desktop
```

For packaging changes, also run `npm run package`, `npm run test:desktop -- --packaged`, `npm run test:portable`, and `npm run checksums:verify` sequentially. Desktop tests use isolated temporary data and synthetic agent roots. Do not run packaging while a desktop test is using its executable.

Keep changes focused and describe the problem, resulting behavior, and checks performed. Include a meaningful regression test for a bug when practical. Preserve independently generated fixtures and frozen pricing data unless the change explicitly updates their documented contract and provenance. Screenshots in contributions should use synthetic data.

Use GitHub Issues for reproducible bugs or feature requests. For a bug, include the application version, Windows and Node versions where relevant, reproduction steps, expected and actual behavior, and sanitized error output. See SECURITY.md for security reports. Never attach your full settings, AI cache, or agent conversations.

Contributions are made under the project's MIT license. Include provenance and any required attribution for new assets or third-party material. Dependency upgrades should update the lockfile and pass the checks above. Changes to parsing, stored schemas, exports, and API-equivalent prices need explicit compatibility notes.
