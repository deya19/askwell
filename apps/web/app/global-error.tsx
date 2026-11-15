"use client";

import { APP_NAME } from "@askwell/shared";
import { useEffect } from "react";
import { buttonClasses } from "@/components/ui/button";
import { getLoadedPostHog } from "@/lib/analytics/client";
import "./globals.css";

/**
 * Last-resort error page, shown when a root layout itself fails. It replaces the whole
 * document. Sends the error to PostHog when the page had loaded it (never on /embed).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const posthog = getLoadedPostHog();
    // Not console.error when PostHog is loaded: it captures console errors too, so it would count twice.
    if (posthog) posthog.captureException(error, { source: "global-error", digest: error.digest });
    else console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center text-fg"
        >
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted">
            {APP_NAME} couldn&apos;t load this page. Try again, and if it keeps happening, reload the page.
          </p>
          {error.digest && <p className="font-mono text-xs text-muted">Error ID: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className={buttonClasses({ variant: "secondary" })}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
