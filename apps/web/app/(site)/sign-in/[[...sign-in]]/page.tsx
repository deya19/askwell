import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      {/* <SignIn /> reads the URL on a catch-all route, so it sits inside Suspense. */}
      <Suspense>
        <SignIn />
      </Suspense>
    </main>
  );
}
