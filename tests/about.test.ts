import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { aboutLinkKeys, aboutLinks } from "../src/shared/about";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  repository: { url: string };
  bugs: { url: string };
};
describe("About links", () => {
  it("are HTTPS pages on the developer site or GitHub only", () => {
    for (const url of Object.values(aboutLinks)) {
      const u = new URL(url);
      expect(u.protocol).toBe("https:");
      expect(["nex-te.com", "github.com"]).toContain(u.hostname);
    }
  });
  it("match the repository recorded in package.json", () => {
    expect(pkg.repository.url).toBe(aboutLinks.repo + ".git");
    expect(pkg.bugs.url).toBe(aboutLinks.issues);
    expect(aboutLinks.releases).toBe(aboutLinks.repo + "/releases");
  });
  it("lists every link as an allowed key", () => {
    expect([...aboutLinkKeys].sort()).toEqual(Object.keys(aboutLinks).sort());
  });
});
