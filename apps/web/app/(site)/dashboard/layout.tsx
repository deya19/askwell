import { auth } from "@clerk/nextjs/server";
import type { ReactNode } from "react";
import { DashboardBackdrop } from "@/components/dashboard/backdrop";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardThemeRoot } from "@/components/dashboard/theme";
import { AlertIcon, StatePanel } from "@/components/dashboard/states";
import { buttonClasses } from "@/components/ui/button";
import { ensureAccount } from "@/lib/accounts";

/**
 * The glass dashboard shell (project.md §13), light or dark by the owner's
 * choice. The theme is applied here, so every page under /dashboard gets it.
 *
 * Every dashboard page renders inside `<main>`. Project pages will add their own
 * nested layout under `app/(site)/dashboard/[projectId]/` with a project-level nav
 * (knowledge, conversations, customize, install) above their content.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // The proxy redirects signed-out visits too; the layout still checks for itself.
  await auth.protect();
  const accountReady = await ensureAccountSafely();

  return (
    <DashboardThemeRoot className="relative isolate flex min-h-dvh flex-col overflow-x-clip bg-bg text-fg">
      <DashboardBackdrop />
      <DashboardHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {accountReady ? children : <AccountError />}
      </main>
    </DashboardThemeRoot>
  );
}

/**
 * error.tsx can't catch errors thrown by its own layout, so a failed account
 * insert is handled here: log it and show an error state inside the shell.
 */
async function ensureAccountSafely(): Promise<boolean> {
  try {
    await ensureAccount();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function AccountError() {
  return (
    <StatePanel
      role="alert"
      icon={<AlertIcon />}
      title="We couldn't set up your account"
      action={
        // A full reload re-runs the layout, which retries the insert.
        <a href="/dashboard" className={buttonClasses({ variant: "secondary" })}>
          Try again
        </a>
      }
    >
      Something went wrong on our side. Please try again in a moment.
    </StatePanel>
  );
}
