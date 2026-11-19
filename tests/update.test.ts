import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { createUpdater, updateErrorMessage, type UpdaterLike, type UpdaterOptions } from "../src/main/updater";
import { noticeVersion, updateView } from "../src/renderer/update";
import { parseSettings } from "../src/services/persistence";
import { aboutLinks } from "../src/shared/about";
import type { UpdateState } from "../src/shared/contracts";

/** A stand-in for electron-updater: checkForUpdates runs whatever the test scripts next. */
function fakeUpdater() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  const fake = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    forceDevUpdateConfig: false,
    feed: null as null | { provider: "generic"; url: string },
    next: (() => Promise.resolve()) as (emit: (event: string, value?: unknown) => void) => Promise<void>,
    checks: 0,
    installs: [] as [boolean | undefined, boolean | undefined][],
    on(event: string, listener: (...args: never[]) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener as (...args: unknown[]) => void]);
      return fake;
    },
    emit(event: string, value?: unknown) {
      for (const l of listeners.get(event) ?? []) l(value);
    },
    async checkForUpdates() {
      fake.checks++;
      fake.emit("checking-for-update");
      await fake.next((e, v) => fake.emit(e, v));
      return null;
    },
    quitAndInstall(silent?: boolean, run?: boolean) {
      fake.installs.push([silent, run]);
    },
    setFeedURL(options: { provider: "generic"; url: string }) {
      fake.feed = options;
    },
  };
  return fake;
}
function setup(overrides: Partial<UpdaterOptions> = {}) {
  const fake = fakeUpdater();
  const states: UpdateState[] = [];
  const calls = { releases: 0, beforeInstall: 0, loads: 0 };
  let autoCheck = true;
  const updater = createUpdater({
    load: () => {
      calls.loads++;
      return fake as unknown as UpdaterLike;
    },
    disabled: null,
    manual: false,
    autoCheck: () => autoCheck,
    onState: (s) => states.push(s),
    openReleases: () => calls.releases++,
    beforeInstall: () => calls.beforeInstall++,
    startupDelayMs: 1000,
    intervalMs: 5000,
    ...overrides,
  });
  return { fake, states, calls, updater, setAutoCheck: (v: boolean) => (autoCheck = v) };
}

describe("updater controller", () => {
  it("downloads a newer version in the installed app and restarts silently into it", async () => {
    const { fake, updater, calls } = setup();
    fake.next = async (emit) => {
      emit("update-available", { version: "1.3.0" });
      emit("download-progress", { percent: 42.4 });
      expect(updater.state()).toMatchObject({ status: "downloading", version: "1.3.0", percent: 42.4 });
      emit("update-downloaded", { version: "1.3.0" });
    };
    expect(await updater.check()).toEqual({ status: "ready", manual: false, version: "1.3.0" });
    expect(fake.autoDownload).toBe(true);
    expect(fake.autoInstallOnAppQuit).toBe(true);
    updater.install();
    expect(calls.beforeInstall).toBe(1);
    expect(fake.installs).toEqual([[true, true]]);
  });
  it("reports up to date, and keeps a finished download when a later check fails", async () => {
    const { fake, updater } = setup();
    fake.next = async (emit) => emit("update-not-available", { version: "1.2.0" });
    expect((await updater.check()).status).toBe("upToDate");
    fake.next = async (emit) => emit("update-downloaded", { version: "1.3.0" });
    await updater.check();
    // A ready update is not checked again, and errors no longer replace it.
    fake.emit("error", new Error("net::ERR_INTERNET_DISCONNECTED"));
    expect((await updater.check()).status).toBe("ready");
    expect(fake.checks).toBe(2);
  });
  it("offers the release page in the portable build instead of downloading", async () => {
    const { fake, updater, calls } = setup({ manual: true });
    fake.next = async (emit) => {
      emit("update-available", { version: "1.3.0" });
      emit("download-progress", { percent: 10 });
    };
    expect(await updater.check()).toEqual({ status: "available", manual: true, version: "1.3.0" });
    expect(fake.autoDownload).toBe(false);
    expect(fake.autoInstallOnAppQuit).toBe(false);
    updater.install();
    expect(calls.releases).toBe(1);
    expect(fake.installs).toEqual([]);
  });
  it("turns failures into short messages and never loads electron-updater when disabled", async () => {
    const offline = setup();
    offline.fake.next = () => Promise.reject(new Error("net::ERR_NAME_NOT_RESOLVED\n    at stack"));
    expect(await offline.updater.check()).toMatchObject({ status: "error", message: expect.stringContaining("Could not reach GitHub") });
    const disabled = setup({ disabled: "development" });
    expect(await disabled.updater.check()).toEqual({ status: "disabled", reason: "development" });
    disabled.updater.schedule();
    disabled.updater.install();
    expect(disabled.calls.loads).toBe(0);
  });
  it("uses a generic feed when one is given, for local end-to-end tests", async () => {
    const { fake, updater } = setup({ feedUrl: "http://127.0.0.1:8080/" });
    await updater.check();
    expect(fake.feed).toEqual({ provider: "generic", url: "http://127.0.0.1:8080/" });
    expect(fake.forceDevUpdateConfig).toBe(true);
  });
  it("shares one check between overlapping requests", async () => {
    const { fake, updater } = setup();
    let release!: () => void;
    fake.next = () => new Promise<void>((r) => (release = r));
    const a = updater.check(),
      b = updater.check();
    release();
    await Promise.all([a, b]);
    expect(fake.checks).toBe(1);
  });
});
describe("automatic checks", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());
  it("check after the startup delay, repeat on the interval, and stop when turned off", async () => {
    const { fake, updater, setAutoCheck } = setup();
    updater.schedule();
    updater.schedule(); // re-applying the same setting does not restart the timer
    await vi.advanceTimersByTimeAsync(999);
    expect(fake.checks).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.checks).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fake.checks).toBe(2);
    setAutoCheck(false);
    updater.schedule();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fake.checks).toBe(2);
  });
});
describe("update messages", () => {
  it("explain missing update information and trim long errors", () => {
    expect(updateErrorMessage(new Error("Cannot find latest.yml in the latest release artifacts"))).toContain("no update information");
    expect(updateErrorMessage("x".repeat(500)).length).toBe(200);
  });
  it("map each state to what About shows", () => {
    expect(updateView({ status: "disabled", reason: "test" })).toMatchObject({ action: null, canAutoCheck: false });
    expect(updateView({ status: "ready", manual: false, version: "1.3.0" }).action).toMatchObject({ kind: "install", icon: "restart" });
    expect(updateView({ status: "available", manual: true, version: "1.3.0" }).action).toMatchObject({ kind: "install", icon: "download" });
    expect(updateView({ status: "checking", manual: false }).action?.disabled).toBe(true);
    expect(updateView({ status: "downloading", manual: false, version: "1.3.0", percent: 50 }).progress).toBe(50);
    expect(noticeVersion({ status: "available", manual: false, version: "1.3.0" })).toBeNull();
    expect(noticeVersion({ status: "ready", manual: false, version: "1.3.0" })).toBe("1.3.0");
  });
});
describe("update settings and release feed", () => {
  it("turn automatic checks on for settings saved before updates existed", () => {
    expect(parseSettings({ schemaVersion: 1 }).updates).toEqual({ autoCheck: true });
    expect(parseSettings({ schemaVersion: 1, updates: { autoCheck: false } }).updates).toEqual({ autoCheck: false });
  });
  it("publish to the repository the About links point at, with file names GitHub keeps as-is", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      build: { publish: { provider: string; owner: string; repo: string }[]; nsis: { artifactName: string }; portable: { artifactName: string } };
    };
    const [feed] = pkg.build.publish;
    expect(`https://github.com/${feed.owner}/${feed.repo}`).toBe(aboutLinks.repo);
    for (const name of [pkg.build.nsis.artifactName, pkg.build.portable.artifactName]) expect(name).not.toMatch(/\s/);
  });
});
