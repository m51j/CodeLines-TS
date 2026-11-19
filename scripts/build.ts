import { build } from "esbuild";
import { build as viteBuild } from "vite";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import "./licenses";
await mkdir("dist", { recursive: true });
await viteBuild();
for (const name of ["main", "preload", "widget-preload", "worker", "analyzer"])
  await build({
    entryPoints: [`src/main/${name}.ts`],
    outfile: `dist/${name}.cjs`,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    sourcemap: true,
  });
const report = await build({
  entryPoints: ["src/renderer/report-entry.tsx"],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  write: false,
  minify: true,
});
await writeFile(
  "dist/report.js",
  report.outputFiles.find((f) => f.path.endsWith(".js"))?.text ??
    report.outputFiles[0].text,
);
// The standalone report uses Classic's styles plus the shared dropdowns.
await writeFile(
  "dist/report.css",
  (await readFile("src/renderer/styles.css", "utf8")) +
    (await readFile("src/renderer/ui/ui.css", "utf8")),
);
await copyFile("assets/CodeLines.ico", "dist/CodeLines.ico");
await copyFile("LICENSE", "dist/LICENSE");
await copyFile("THIRD-PARTY-NOTICES.md", "dist/THIRD-PARTY-NOTICES.md");
await copyFile(
  "docs/THIRD-PARTY-LICENSES.txt",
  "dist/THIRD-PARTY-LICENSES.txt",
);
console.log(
  "Built desktop runtime, workers, renderer, offline report and tokenizer vocabularies.",
);
