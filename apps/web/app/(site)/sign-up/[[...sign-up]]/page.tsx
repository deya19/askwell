import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      {/* <SignUp /> reads the URL on a catch-all route, so it sits inside Suspense. */}
      <Suspense>
        <SignUp />
      </Suspense>
    </main>
  );
}
