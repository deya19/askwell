import { z } from "zod";
import { messageRoleSchema } from "../domain";
import { idSchema, timestampSchema } from "./common";

// Owner routes: Clerk session required. Bodies render as text, never HTML.

/** One row in a project's conversation list. */
export const conversationSummarySchema = z.object({
  id: idSchema,
  visitorId: z.string(),
  /** The start of the first message, or "" if there is none. */
  preview: z.string(),
  messageCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

/** `GET /api/projects/:id/conversations` response, newest first. */
export const listConversationsResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema),
});
export type ListConversationsResponse = z.infer<typeof listConversationsResponseSchema>;

export const chatMessageSchema = z.object({
  id: idSchema,
  role: messageRoleSchema,
  body: z.string(),
  createdAt: timestampSchema,
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** `GET /api/conversations/:id` response: the thread, oldest message first. */
export const conversationResponseSchema = z.object({
  conversation: z.object({
    id: idSchema,
    projectId: idSchema,
    visitorId: z.string(),
    createdAt: timestampSchema,
  }),
  messages: z.array(chatMessageSchema),
});
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
