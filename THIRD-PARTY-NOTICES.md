# CodeLines — attribution

CodeLines is Copyright (c) 2026 m51j and is released under the [MIT License](LICENSE). The maintainer has confirmed ownership or permission to publish the original CodeLines and ccstats sources and the derived assets described below under this license. Third-party dependencies retain their own copyrights and licenses.

This migration preserves the CodeLines name, icon, SVG asset, domain rules, and synthetic test fixtures from the maintainer's CodeLines repository at commit `09e711258a8b713c76a80bb9e1bb58b041465264` (audited 2026-10-21).

The AI usage parsing, aggregation, pricing behavior, and report feature set derive from CodeLines' C# port of **ccstats**. The original `AiUsage/Templates/UPSTREAM.md` identifies `src/render.mjs`, `src/agents/render.mjs`, and `src/agents/dashboard.mjs` in the maintainer's ccstats project, extracted on 2026-09-23. The replacement reimplements those reports in typed React components and shared selectors. It does not ship the legacy HTML templates or require a separate ccstats checkout. The original ccstats package was private without a license declaration at the time of the initial audit; the MIT grant here covers the maintainer-owned material included in CodeLines, not unrelated third-party material.

Frozen price data is copied from CodeLines' `ClaudePricing.cs` and `Agents/AgentPricing.cs`, with version `codelines-2026-10-05-v1`. Rates are preserved for calculation parity and are not represented as current provider prices. The original source attributes them to provider list rates. Future changes must use a new version with sources and tests.

Runtime dependencies include Electron (MIT), React/React DOM (MIT), js-tiktoken (MIT), Zod (MIT), Recharts (MIT), and Lucide React (ISC). Full installed production dependency license texts are generated in `docs/THIRD-PARTY-LICENSES.txt` and included in the packaged application's `dist` directory. Electron's distribution also carries its own Chromium and other third-party license notices.

The copied golden fixtures were generated from synthetic transcripts by CodeLines' fixture generator. They contain no live user transcripts. Test execution does not depend on a separate ccstats checkout.
