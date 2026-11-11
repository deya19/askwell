import "server-only";
import { isHttpOrigin, parseEmbedParams, type WidgetConfig } from "@askwell/shared";
import { getWidgetConfigByKey } from "../../lib/widget/config";

export type EmbedSearchParams = Record<string, string | string[] | undefined>;

export type EmbedState =
  | { status: "ready"; key: string; host: string; config: WidgetConfig }
  /** `host` is set when it was valid, so the panel can still post `close`. */
  | { status: "unavailable"; host: string | null };

/**
 * What /embed shows for its query. Bad params, an unknown key or a failed lookup all give
 * "unavailable"; the page never says which, and never throws.
 */
export async function loadEmbed(searchParams: EmbedSearchParams): Promise<EmbedState> {
  const params = parseEmbedParams(searchParams);
  if (!params) {
    const host = searchParams.host;
    return { status: "unavailable", host: isHttpOrigin(host) ? host : null };
  }
  try {
    const config = await getWidgetConfigByKey(params.key);
    if (!config) return { status: "unavailable", host: params.host };
    return { status: "ready", key: params.key, host: params.host, config };
  } catch (cause) {
    console.error(cause);
    return { status: "unavailable", host: params.host };
  }
}
