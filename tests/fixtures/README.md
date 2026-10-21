# Fixture provenance

`claude/` and the three `*-payload*.golden.json` files come from CodeLines' public synthetic AI fixtures at commit `09e711258a8b713c76a80bb9e1bb58b041465264`. The source's fixture generator produced 685 Claude usage records, including streaming duplicates, unknown models, malformed lines and a nested subagent. The expected payload values have not been regenerated from the TypeScript implementation.

`token-counts.golden.json` was generated independently on 2026-10-21 by a temporary .NET program using Microsoft.ML.Tokenizers 2.0.0 and its Cl100kBase/O200kBase 2.0.0 data packages, matching the original project's tokenizer versions. It includes ordinary text, code, Arabic, Japanese, combining/emoji sequences, CRLF and special-token text. The application and normal TypeScript test suite use these checked-in expected values and require no .NET installation.

All remaining adapter, scanner, persistence and Git test data is created in isolated temporary directories by TypeScript tests. No private live transcripts or real repositories are used.
