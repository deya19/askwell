import type { PosthogConfigResponse } from "@askwell/shared";
import { NextResponse } from "next/server";
import { readPostHogConfig } from "../../../lib/analytics/config";

// Never prerender at build time: the values must come from the running deployment.
export const dynamic = "force-dynamic";

/**
 * `GET /api/posthog-config`: PostHog's public project key and host (project.md §8).
 * Read from the environment on every request, so each deployment reports its own project.
 * Holds no secret: the key only lets a browser send events.
 */
export function GET(): NextResponse {
  const config = readPostHogConfig(process.env);
  if (!config) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Analytics isn't configured." } },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body: PosthogConfigResponse = config;
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
