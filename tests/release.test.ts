import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  releaseFileNames,
  verifyReleaseChecksums,
  writeReleaseChecksums,
} from "../scripts/release-artifacts";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codelines-checksums-"));
  roots.push(root);
  const files = releaseFileNames("CodeLines TS", "2.3.4");
  await fs.writeFile(path.join(root, files[0]), "abc");
  await fs.writeFile(path.join(root, files[1]), "hello");
  return { root, files, manifest: path.join(root, "SHA256SUMS.txt") };
}
describe("release checksum integrity", () => {
  it("uses the release version and filenames with spaces, and matches known SHA256 vectors", async () => {
    const { root, files, manifest } = await fixture();
    await writeReleaseChecksums(root, files);
    expect(await fs.readFile(manifest, "utf8")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  CodeLines TS Setup 2.3.4.exe\n" +
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  CodeLines TS 2.3.4.exe\n",
    );
    await verifyReleaseChecksums(root, files);
  });
  it("rejects altered binaries and leaves the recorded manifest intact for verification", async () => {
    const { root, files, manifest } = await fixture();
    await writeReleaseChecksums(root, files);
    const before = await fs.readFile(manifest, "utf8");
    await fs.appendFile(path.join(root, files[1]), "changed");
    await expect(verifyReleaseChecksums(root, files)).rejects.toThrow(
      "does not match",
    );
    expect(await fs.readFile(manifest, "utf8")).toBe(before);
  });
  it("removes a stale manifest and fails without publishing partial checksums when an executable is missing", async () => {
    const { root, files, manifest } = await fixture();
    await writeReleaseChecksums(root, files);
    await fs.rm(path.join(root, files[1]));
    await expect(writeReleaseChecksums(root, files)).rejects.toThrow();
    await expect(fs.stat(manifest)).rejects.toThrow();
  });
  it("rejects an empty executable", async () => {
    const { root, files, manifest } = await fixture();
    await fs.writeFile(path.join(root, files[0]), "");
    await expect(writeReleaseChecksums(root, files)).rejects.toThrow(
      "nonempty file",
    );
    await expect(fs.stat(manifest)).rejects.toThrow();
  });
});
