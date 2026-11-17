"use client";

import { APP_NAME, type WidgetConfig } from "@askwell/shared";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/components/ui/cn";
import { cornerSides, textColorOn } from "./copy";

/** Gaps in the preview frame, in px: a scaled-down copy of the loader's 20 / 52 / 12. */
const EDGE = 16;
const BUTTON_HEIGHT = 44;
const PANEL_OFFSET = EDGE + BUTTON_HEIGHT + 10;
/** How long the panel takes to close before a replay opens it again, in ms. */
const REPLAY_DELAY = 260;

/**
 * The widget panel is always light (the /embed page has no dark theme), so the preview pins
 * the light tokens even when the dashboard is dark.
 */
const LIGHT_TOKENS = {
  "--bg": "var(--color-ink-50)",
  "--bg-raised": "var(--color-ink-0)",
  "--fg": "var(--color-ink-950)",
  "--muted": "var(--color-ink-500)",
  "--border": "rgb(0 0 0 / 0.08)",
  "--glass": "rgb(255 255 255 / 0.6)",
  "--glass-strong": "rgb(255 255 255 / 0.8)",
  "--accent": "var(--color-ink-950)",
  "--accent-fg": "var(--color-ink-0)",
  colorScheme: "light",
} as CSSProperties;

const CHAT_ICON = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

/**
 * A stand-in for the widget on a page: the button in its corner, and the panel with its
 * header and badge. Same look as the loader and /embed, without loading the real script.
 * Every config value goes in as text or a validated style value, never as HTML.
 */
export function WidgetPreview({ config }: { config: WidgetConfig }) {
  const [open, setOpen] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [shownAnimation, setShownAnimation] = useState(config.animation);

  // A new animation: close the panel, then open it again so the owner sees it play.
  if (shownAnimation !== config.animation) {
    setShownAnimation(config.animation);
    setOpen(false);
    setReplaying(true);
  }

  useEffect(() => {
    if (!replaying) return;
    const timer = setTimeout(() => {
      setReplaying(false);
      setOpen(true);
    }, REPLAY_DELAY);
    return () => clearTimeout(timer);
  }, [replaying]);

  const { vertical, horizontal } = cornerSides(config.position);
  const closedTransform =
    config.animation === "slide"
      ? `translateY(${vertical === "bottom" ? 16 : -16}px)`
      : config.animation === "scale"
        ? "scale(0.92)"
        : "none";

  const panelStyle: CSSProperties = {
    ...LIGHT_TOKENS,
    [vertical]: PANEL_OFFSET,
    [horizontal]: EDGE,
    height: `min(380px, calc(100% - ${PANEL_OFFSET + EDGE}px))`,
    width: `min(300px, calc(100% - ${EDGE * 2}px))`,
    transformOrigin: `${vertical} ${horizontal}`,
    opacity: open ? 1 : 0,
    transform: open ? "none" : closedTransform,
  };

  const buttonStyle: CSSProperties = {
    [vertical]: EDGE,
    [horizontal]: EDGE,
    height: BUTTON_HEIGHT,
    maxWidth: `calc(100% - ${EDGE * 2}px)`,
    backgroundColor: config.buttonColor,
    color: textColorOn(config.buttonColor),
    outlineColor: config.buttonColor,
  };

  return (
    <div className="relative h-[440px] overflow-hidden rounded-lg border border-border bg-bg-raised shadow-panel sm:h-[520px]">
      <FakePage />

      <div
        aria-hidden={!open}
        className="absolute flex flex-col overflow-hidden rounded-lg bg-bg text-fg shadow-[0_24px_64px_rgb(0_0_0/0.24),0_4px_12px_rgb(0_0_0/0.1)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        style={panelStyle}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-glass-strong px-4">
          <p className="truncate text-sm font-semibold tracking-tight">{config.headerText}</p>
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 p-3 text-[13px]">
          <p className="max-w-[85%] self-end rounded-lg rounded-br-sm bg-accent px-3 py-2 text-accent-fg">
            Do you ship to Canada?
          </p>
          <p className="max-w-[85%] self-start rounded-lg rounded-bl-sm border border-border bg-bg-raised px-3 py-2">
            Yes. Orders to Canada arrive in 3 to 5 business days.
          </p>
        </div>
        <div className="shrink-0 border-t border-border bg-glass-strong px-3 pt-2.5 pb-1.5">
          <div className="flex h-9 items-center rounded-lg border border-border bg-bg-raised px-3 text-[13px] text-muted">
            Type your question…
          </div>
          <p className={cn("flex h-5 items-center px-1 text-[11px] text-muted", !config.showBadge && "invisible")}>
            <span>
              Powered by <span className="font-semibold">{APP_NAME}</span>
            </span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setReplaying(false);
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-label={`${config.label} (preview: ${open ? "close" : "open"} the panel)`}
        className="absolute inline-flex items-center gap-2 rounded-pill pr-4 pl-3.5 text-sm font-semibold shadow-[0_8px_24px_rgb(0_0_0/0.18),0_2px_6px_rgb(0_0_0/0.12)] transition-transform hover:-translate-y-px focus-visible:outline-3 focus-visible:outline-offset-3 motion-reduce:transition-none"
        style={buttonStyle}
      >
        {CHAT_ICON}
        <span className="truncate">{config.label}</span>
      </button>
    </div>
  );
}

/** Grey blocks standing in for the customer's page behind the widget. */
function FakePage() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="ml-3 h-5 flex-1 rounded-pill bg-fg/[0.06]" />
      </div>
      <div className="mt-8 h-6 w-2/3 rounded-md bg-fg/10" />
      <div className="mt-3 h-3 w-full rounded bg-fg/[0.06]" />
      <div className="mt-2 h-3 w-5/6 rounded bg-fg/[0.06]" />
      <div className="mt-2 h-3 w-4/6 rounded bg-fg/[0.06]" />
      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="h-20 rounded-md bg-fg/[0.06]" />
        <div className="h-20 rounded-md bg-fg/[0.06]" />
        <div className="h-20 rounded-md bg-fg/[0.06]" />
      </div>
    </div>
  );
}
