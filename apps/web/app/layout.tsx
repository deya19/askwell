import { APP_NAME } from "@askwell/shared";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const description = `Add your product info, paste one script tag, and ${APP_NAME} answers visitor questions on your website.`;

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description,
  applicationName: APP_NAME,
  openGraph: { title: APP_NAME, description, siteName: APP_NAME, type: "website" },
  twitter: { card: "summary", title: APP_NAME, description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Without JS the scroll reveal never runs, so show everything. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
