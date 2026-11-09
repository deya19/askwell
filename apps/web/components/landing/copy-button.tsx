"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

const labels: Record<CopyState, string> = { idle: "Copy", copied: "Copied", failed: "Copy failed" };

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {labels[state]}
    </Button>
  );
}
