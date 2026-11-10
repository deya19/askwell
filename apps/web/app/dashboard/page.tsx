import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { APP_NAME } from "@askwell/shared";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

/** Placeholder so sign-in, sign-up and sign-out can be tested. P1F-T07 replaces it. */
export default async function DashboardPage() {
  // The proxy redirects signed-out visits too; the page still checks for itself.
  await auth.protect();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{APP_NAME} dashboard</h1>
        <UserButton />
      </header>
      <p className="text-muted">You&apos;re signed in. Projects come next.</p>
    </main>
  );
}
