# CodeLines TS — attribution

This migration preserves the CodeLines name, icon, SVG asset, domain rules, and public test fixtures from the user's CodeLines repository at commit `09e711258a8b713c76a80bb9e1bb58b041465264` (audited 2026-10-21).

The AI usage parsing, aggregation, pricing behavior, and report feature set derive from CodeLines' C# port of **ccstats**. The original `AiUsage/Templates/UPSTREAM.md` identifies `src/render.mjs`, `src/agents/render.mjs`, and `src/agents/dashboard.mjs` in the user's ccstats project, extracted on 2026-09-23. The replacement reimplements those reports in typed React components and shared selectors. It does not ship the legacy HTML templates or require ccstats. The inspected ccstats package is private and supplies no license declaration; no additional license grant is asserted here.

Frozen price data is copied from CodeLines' `ClaudePricing.cs` and `Agents/AgentPricing.cs`, with version `codelines-2026-10-05-v1`. Rates are preserved for calculation parity and are not represented as current provider prices. The original source attributes them to provider list rates. Future changes must use a new version with sources and tests.

Runtime dependencies include Electron (MIT), React/React DOM (MIT), js-tiktoken (MIT), Zod (MIT), Recharts (MIT), and Lucide React (ISC). Full installed production dependency license texts are generated in `docs/THIRD-PARTY-LICENSES.txt` and included in the packaged application's `dist` directory. Electron's distribution also carries its own Chromium and other third-party license notices.

The copied golden fixtures were generated from synthetic transcripts by CodeLines' fixture generator. They contain no live user transcripts. Test execution does not depend on a separate ccstats checkout.
