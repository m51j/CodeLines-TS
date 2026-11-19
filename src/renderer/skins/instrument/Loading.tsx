/**
 * The boot loader (the prototype's showLoader): the plate tilts in, three code lines draw, the cursor
 * dot blinks, the wordmark rises letter by letter and a thin bar fills; then the shell slides in.
 * It is built on <body>, outside React, so it keeps playing while the loading screen hands over to
 * the shell; the shell calls finishBoot() when it is on screen.
 */
import { useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { reduced } from "../../motion/core";
import { useWindowControls } from "../../window";
import { h } from "./dom";
import { Icon, iconEl, logoMarkup } from "./icons";
interface Boot {
  el: HTMLElement;
  msg: HTMLElement;
  started: number;
  ready: boolean;
  done: boolean;
  finish?: () => void;
}
let boot: Boot | null = null;
function ensureLoader(): Boot {
  if (boot && boot.el.isConnected) return boot;
  const logo = document.createElement("template");
  logo.innerHTML = logoMarkup(92, "logo-big");
  const msg = h("p.loader-msg", { role: "status" }, "Opening your local workspace…");
  const el = h(
    "div.loader.is-boot",
    { "aria-label": "CodeLines is starting" },
    h(
      "div.loader-box",
      logo.content.firstChild,
      h(
        "h1",
        { "aria-label": "CodeLines" },
        "CodeLines".split("").map((c, i) => h("span", { style: { "--i": String(i) }, "aria-hidden": "true" }, c)),
      ),
      h("p.loader-tag", "Project intelligence"),
      h("div.loader-bar", h("i")),
      msg,
      h("p.loader-priv", iconEl("shield", 14), "Local by design · your source and usage stay on this computer"),
    ),
  );
  document.body.appendChild(el);
  void el.offsetWidth;
  el.classList.add("is-in");
  const b: Boot = { el, msg, started: performance.now(), ready: false, done: false };
  // A press skips the rest of the animation once the workspace is there.
  el.addEventListener("pointerdown", () => {
    if (b.ready) b.finish?.();
  });
  boot = b;
  return b;
}
/** True while the boot loader is on screen. */
export const booting = () => !!boot && !boot.done;
/**
 * Called by the shell once it is rendered: waits for the loader's minimum time, fades it out and
 * runs `entrance` (title bar drops, status bar rises, page rises). Returns a cancel function.
 */
export function finishBoot(entrance: () => void): () => void {
  const b = boot;
  if (!b || b.done) return () => {};
  let live = true;
  b.ready = true;
  const run = () => {
    if (b.done) return;
    b.done = true;
    clearTimeout(timer);
    b.el.classList.add("is-out");
    if (live) entrance();
    setTimeout(() => b.el.remove(), reduced() ? 0 : 460);
  };
  b.finish = run;
  const min = reduced() ? 450 : 1650;
  const timer = setTimeout(run, Math.max(0, min - (performance.now() - b.started)));
  return () => {
    live = false;
  };
}
/** Shown while the workspace loads. The window controls stay reachable above the loader. */
export function Loading({ error }: { error: string }) {
  const { state, control } = useWindowControls();
  useLayoutEffect(() => {
    ensureLoader();
  }, []);
  useEffect(() => {
    const b = ensureLoader();
    b.msg.textContent = error || "Opening your local workspace…";
    b.msg.classList.toggle("is-error", !!error);
  }, [error]);
  return createPortal(
    <header className="titlebar loader-winctl" aria-label="Application title bar">
      <div className="winctl" role="group" aria-label="Window controls">
        <button type="button" className="win-btn" aria-label="Minimize window" onClick={() => void control("minimize")}>
          <Icon name="min" size={16} />
        </button>
        <button type="button" className="win-btn" aria-label={state.maximized ? "Restore window" : "Maximize window"} onClick={() => void control("toggleMaximize")}>
          <Icon name={state.maximized ? "restore" : "max"} size={14} />
        </button>
        <button type="button" className="win-btn win-close" aria-label="Close window" onClick={() => void control("close")}>
          <Icon name="x" size={16} />
        </button>
      </div>
    </header>,
    document.body,
  );
}
