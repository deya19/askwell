import { APP_NAME } from "@askwell/shared";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { LogoMark } from "@/components/landing/site-header";
import { DashboardNav } from "./dashboard-nav";
import { DASHBOARD_PATH } from "./nav-items";

/** The sticky glass top bar: app name, account navigation, and the Clerk user menu. */
export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/70 backdrop-blur-glass-strong">
      <div className="relative mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={DASHBOARD_PATH} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <LogoMark />
          {APP_NAME}
        </Link>
        <div className="flex items-center gap-3">
          <DashboardNav />
          {/* Fixed size so the header doesn't jump while Clerk loads. */}
          <div className="grid size-8 place-items-center">
            <UserButton />
          </div>
        </div>
      </div>
    </header>
  );
}
