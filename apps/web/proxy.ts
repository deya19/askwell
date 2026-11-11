import { clerkMiddleware } from "@clerk/nextjs/server";
import { routeAccess, SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth/routes";
import { unauthorizedResponse } from "@/lib/auth/unauthorized";

/**
 * Clerk reads the session on every matched request. Signed-out requests to owner
 * paths stop here: pages redirect to /sign-in, owner API routes get a 401 JSON.
 * Pages and handlers check again themselves; this is the early check.
 */
export default clerkMiddleware(
  async (auth, req) => {
    const access = routeAccess(req.nextUrl.pathname);
    if (access === "public") return;

    const { isAuthenticated, redirectToSignIn } = await auth();
    if (isAuthenticated) return;

    if (access === "owner-api") return unauthorizedResponse();
    return redirectToSignIn({ returnBackUrl: req.url });
  },
  {
    // Our own pages, not Clerk's hosted Account Portal.
    signInUrl: SIGN_IN_PATH,
    signUpUrl: SIGN_UP_PATH,
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    // Also skip /embed (the widget's chat panel): it needs no auth, and it runs in a
    // cross-site iframe where Clerk's dev-instance handshake redirect can't work
    // (no first-party cookies), so the panel would show an error page instead.
    "/((?!_next|embed(?:/|$)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes, so `auth()` has the session there.
    "/(api|trpc)(.*)",
  ],
};
