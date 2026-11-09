import { z } from "zod";
import { MAX_CHAT_MESSAGE_LENGTH } from "../limits";
import { widgetConfigSchema } from "../widget-config";
import { idSchema, publicKeySchema } from "./common";

// Public routes: called by the widget from any origin, rate limited.

/** `GET /api/widget/config?key=pk_...` query. */
export const widgetConfigQuerySchema = z.object({ key: publicKeySchema });
export type WidgetConfigQuery = z.infer<typeof widgetConfigQuerySchema>;

/** `GET /api/widget/config` response: the plan-applied config. */
export const widgetConfigResponseSchema = z.object({ config: widgetConfigSchema });
export type WidgetConfigResponse = z.infer<typeof widgetConfigResponseSchema>;

/** The visitor's random ID, kept in the iframe's localStorage. */
export const visitorIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/, "Invalid visitor ID");

/** `POST /api/widget/chat` body. */
export const chatRequestSchema = z.object({
  key: publicKeySchema,
  visitorId: visitorIdSchema,
  conversationId: idSchema.optional(),
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** `POST /api/widget/chat` response. */
export const chatResponseSchema = z.object({
  conversationId: idSchema,
  reply: z.string(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;
