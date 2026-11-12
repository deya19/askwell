import { APP_NAME } from "@askwell/shared";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout for /embed, the widget's chat panel inside customers' sites.
 * No ClerkProvider: the panel needs no auth, so it shouldn't download clerk-js.
 * The site's own root layout is app/(site)/layout.tsx.
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
