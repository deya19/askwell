import "server-only";
import { slidingWindow } from "@arcjet/next";
import { getArcjet } from "./client";
import { failOpen, type ProtectResult } from "./decision";

/** Config loads per client IP per minute. Looser than chat: the loader asks once per page view. */
export const CONFIG_RATE_LIMIT_PER_MINUTE = 60;

type ConfigArcjet = ReturnType<typeof createConfigArcjet>;

function createConfigArcjet() {
  return getArcjet().withRule(
    slidingWindow({ mode: "LIVE", characteristics: ["ip.src"], interval: 60, max: CONFIG_RATE_LIMIT_PER_MINUTE }),
  );
}

let configArcjet: ConfigArcjet | undefined;

/** Rate limit for `GET /api/widget/config`, per client IP. Fails open. */
export async function protectWidgetConfig(request: Request): Promise<ProtectResult> {
  return failOpen(() => {
    configArcjet ??= createConfigArcjet();
    return configArcjet.protect(request);
  });
}
