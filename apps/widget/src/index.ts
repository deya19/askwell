import { startWidget } from "./loader";

// Entry point of widget.js (an IIFE: nothing lands on `window`).
// `document.currentScript` is only set while this runs synchronously, so read it first.
try {
  const script = document.currentScript;
  void startWidget(script instanceof HTMLScriptElement ? script : null, {
    window,
    fetch: (input, init) => window.fetch(input, init),
    warn: (message) => console.warn(message),
    shadowMode: "closed",
  });
} catch {
  // Never throw into the host page.
}
