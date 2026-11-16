"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { trackSnippetCopied } from "./track-snippet-copied";

type CopyState = "idle" | "copied" | "failed";

const labels: Record<CopyState, string> = { idle: "Copy", copied: "Copied", failed: "Copy failed" };

/** Copies the install snippet and sends `snippet_copied` with the project ID from the URL. */
export function SnippetCopyButton({ snippet }: { snippet: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const params = useParams<{ id?: string }>();

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      setState("failed");
      return;
    }
    setState("copied");
    trackSnippetCopied(params.id);
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {labels[state]}
    </Button>
  );
}
