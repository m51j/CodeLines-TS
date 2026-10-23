# Publication checklist

The repository preparation and local packaging commands do not push commits, change GitHub visibility, or publish a Release. Version 1.0.0 targets Windows x64 and remains unsigned. Current README screenshots are intentionally retained with their existing usage statistics and anonymized project names.

## Prepare the source

1. Review the final diff and staged file list. Confirm that LICENSE, attribution, and generated dependency notices are included. The maintainer has confirmed rights to the original CodeLines/ccstats material and derived assets.
2. Check tracked files and Git history for credentials, private transcripts, personal data, or unintended build outputs. Ignore rules prevent future accidental additions; they do not remove already committed material.
3. Run `npm ci`, `npm audit`, `npm audit --omit=dev`, `npm run verify`, and `npm run test:desktop`. Update verification notes with actual results and their limits.
4. When ready to publish, commit and push the reviewed changes and check GitHub Actions results. These remote actions are separate from local preparation.
5. Change repository visibility when ready, then enable private vulnerability reporting for the public repository under **Settings → Advanced Security**. See [GitHub's configuration instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository). Configure default-branch protection to require the **Windows checks** job.

## Prepare and publish binaries

1. Build from the intended reviewed source revision using `npm run package`. The command disables publishing and generates a fresh SHA256 manifest after creating both executables.
2. Run `npm run test:desktop -- --packaged`, `npm run test:portable`, and `npm run checksums:verify` sequentially. The same checks are available in the manually dispatched **Build release artifacts** workflow. Downloaded workflow artifacts are not a published Release.
3. Confirm that `release/SHA256SUMS.txt` matches both local executables. GitHub normalizes spaces in uploaded filenames to periods, so stage the download names and a matching checksum manifest before uploading. From the repository root, run:

   ```powershell
   $metadata = Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json
   $output = $metadata.build.directories.output
   $staging = Join-Path $output 'github'
   New-Item -ItemType Directory -Path $staging -Force | Out-Null
   $manifest = Join-Path $staging 'SHA256SUMS.txt'
   Remove-Item -LiteralPath $manifest -Force -ErrorAction SilentlyContinue
   $names = @(
     "$($metadata.build.productName) Setup $($metadata.version).exe"
     "$($metadata.build.productName) $($metadata.version).exe"
   )
   $lines = foreach ($name in $names) {
     $downloadName = $name.Replace(' ', '.')
     $destination = Join-Path $staging $downloadName
     Copy-Item -LiteralPath (Join-Path $output $name) -Destination $destination -Force -ErrorAction Stop
     $hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
     "$hash  $downloadName"
   }
   [System.IO.File]::WriteAllText((Join-Path $PWD $manifest), ($lines -join "`n") + "`n")
   ```

   Attach only the two executables and `SHA256SUMS.txt` from `release/github/` to a GitHub Release for the same source commit, using tag `v1.0.0` and the changelog notes. Version 1.0.0 downloads are **CodeLines.TS.Setup.1.0.0.exe** and **CodeLines.TS.1.0.0.exe**; their contents are identical to the tested local executables. Disclose unsigned publisher status. Do not upload builder debug/config files or local application data.
4. Publish only after the artifact checks pass. If either executable is rebuilt, regenerate and verify the manifest before uploading. When the version changes, update the package version, lockfile, changelog, and documented example names together.

The complete MIT license and third-party notices are bundled inside `resources/app.asar` under `dist/`; Electron also includes its own distribution notices.
