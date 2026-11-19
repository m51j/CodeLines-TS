/**
 * Builds assets/CodeLines.ico from the SVG artwork. Each size is drawn by Chromium
 * through Playwright (already a dev dependency) and stored as a PNG entry.
 * Small sizes use pixel-aligned artwork (CodeLines-16.svg, CodeLines-24.svg for 20 and 24);
 * every other size uses CodeLines.svg.
 *   npm run icon                  writes the .ico
 *   npm run icon -- --preview D   also writes each size as D/CodeLines-<n>.png
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const svg = async (file: string) =>
  "data:image/svg+xml;base64," + (await readFile(path.join("assets", file))).toString("base64");
const art = {
  16: await svg("CodeLines-16.svg"),
  24: await svg("CodeLines-24.svg"),
  large: await svg("CodeLines.svg"),
};
const artFor = (size: number) => (size <= 16 ? art[16] : size <= 24 ? art[24] : art.large);

// Playwright's own Chromium when it is downloaded, otherwise the Edge every Windows install has.
const browser = await chromium.launch().catch(() => chromium.launch({ channel: "msedge" }));
const pngs: Buffer[] = [];
try {
  const page = await browser.newPage();
  for (const size of sizes) {
    const src = artFor(size);
    const url = await page.evaluate(
      async ({ src, size }) => {
        const img = new Image(size, size);
        img.src = src;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL("image/png");
      },
      { src, size },
    );
    pngs.push(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
  }
} finally {
  await browser.close();
}

// ICONDIR, one ICONDIRENTRY per size, then the PNG images.
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(size >= 256 ? 0 : size, at);
  header.writeUInt8(size >= 256 ? 0 : size, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(pngs[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += pngs[i].length;
});
await writeFile("assets/CodeLines.ico", Buffer.concat([header, ...pngs]));
console.log(`Wrote assets/CodeLines.ico (${sizes.join(", ")} px, ${offset} bytes).`);

const at = process.argv.indexOf("--preview");
if (at > 0 && process.argv[at + 1]) {
  const dir = path.resolve(process.argv[at + 1]);
  await mkdir(dir, { recursive: true });
  await Promise.all(sizes.map((s, i) => writeFile(path.join(dir, `CodeLines-${s}.png`), pngs[i])));
  console.log(`Wrote previews to ${dir}.`);
}
