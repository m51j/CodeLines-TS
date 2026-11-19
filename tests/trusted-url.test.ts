import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { isTrustedUrl } from "../src/main/trusted-url";

const win = process.platform === "win32";
// The portable app unpacked into an 8.3 short %TEMP%, as on GitHub runners (RUNNER~1).
const entry = win
  ? String.raw`C:\Users\RUNNER~1\AppData\Local\Temp\2abc\resources\app.asar\dist\renderer\index.html`
  : "/tmp/RUNNER~1/2abc/resources/app.asar/dist/renderer/index.html";
const trusted = pathToFileURL(entry).href;
const chromium = trusted.replaceAll("%7E", "~");

describe("trusted page URLs", () => {
  it("accept the page Chromium reports for a short-path install, which Node encodes differently", () => {
    expect(trusted).toContain("%7E");
    expect(chromium).not.toBe(trusted);
    expect(isTrustedUrl(chromium, trusted)).toBe(true);
    expect(isTrustedUrl(trusted, trusted)).toBe(true);
  });
  it("refuse other files, queries, fragments, encoded separators and other schemes", () => {
    expect(isTrustedUrl(undefined, trusted)).toBe(false);
    expect(isTrustedUrl(chromium.replace("index.html", "widget.html"), trusted)).toBe(false);
    expect(isTrustedUrl(chromium + "?x=1", trusted)).toBe(false);
    expect(isTrustedUrl(chromium + "#x", trusted)).toBe(false);
    expect(isTrustedUrl(chromium.replace("/dist/", "/dist%2F"), trusted)).toBe(false);
    expect(isTrustedUrl("https://example.com/index.html", trusted)).toBe(false);
    expect(isTrustedUrl(chromium.replace("file:///", "file://evil/"), trusted)).toBe(false);
  });
  it("match the development server exactly", () => {
    const dev = "http://127.0.0.1:5173/";
    expect(isTrustedUrl(dev, dev)).toBe(true);
    expect(isTrustedUrl("http://127.0.0.1:5173/other", dev)).toBe(false);
  });
});
