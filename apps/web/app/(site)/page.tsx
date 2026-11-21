import { APP_NAME } from "@askwell/shared";
import type { Metadata } from "next";
import Script from "next/script";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { InstallSnippet } from "@/components/landing/install-snippet";
import { getLandingWidget } from "@/components/landing/landing-widget";
import { LiveDemo } from "@/components/landing/live-demo";
import { Pricing } from "@/components/landing/pricing";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: AI support chat for any website` },
};

export default async function HomePage() {
  // Read per request: LANDING_WIDGET_KEY is set per environment, after deploys (§11).
  const widget = await getLandingWidget();

  return (
    <div data-theme="dark" className="min-h-dvh overflow-x-clip bg-bg text-fg">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <LiveDemo live={widget !== null} />
        <Pricing />
        <InstallSnippet />
      </main>
      <SiteFooter />
      {/* The app's own widget, installed exactly like a customer's snippet. */}
      {widget && <Script src={widget.src} data-key={widget.publicKey} strategy="afterInteractive" />}
    </div>
  );
}
