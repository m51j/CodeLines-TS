import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export function releaseFileNames(
  productName: string,
  version: string,
): string[] {
  return [
    `${productName} Setup ${version}.exe`,
    `${productName} ${version}.exe`,
  ];
}

async function checksumContent(
  directory: string,
  files: string[],
): Promise<string> {
  const lines: string[] = [];
  for (const name of files) {
    const file = path.join(directory, name);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size === 0)
      throw new Error(`Release artifact is not a nonempty file: ${name}`);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    lines.push(`${hash.digest("hex")}  ${name}`);
  }
  return lines.join("\n") + "\n";
}

export async function writeReleaseChecksums(
  directory: string,
  files: string[],
): Promise<void> {
  const manifest = path.join(directory, "SHA256SUMS.txt");
  // A failed generation must not leave an older manifest looking current.
  await fs.rm(manifest, { force: true });
  const content = await checksumContent(directory, files);
  await fs.writeFile(manifest, content, "utf8");
}

export async function verifyReleaseChecksums(
  directory: string,
  files: string[],
): Promise<void> {
  const expected = await checksumContent(directory, files);
  const recorded = await fs.readFile(
    path.join(directory, "SHA256SUMS.txt"),
    "utf8",
  );
  if (recorded.replaceAll("\r\n", "\n") !== expected)
    throw new Error(
      "SHA256SUMS.txt does not match the current release artifacts.",
    );
}
