import { APP_NAME } from "@askwell/shared";
import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { InstallSnippet } from "@/components/landing/install-snippet";
import { LiveDemo } from "@/components/landing/live-demo";
import { Pricing } from "@/components/landing/pricing";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: AI support chat for any website` },
};

export default function HomePage() {
  return (
    <div data-theme="dark" className="min-h-dvh overflow-x-clip bg-bg text-fg">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <LiveDemo />
        <Pricing />
        <InstallSnippet />
      </main>
      <SiteFooter />
    </div>
  );
}
