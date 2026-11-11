import { parseLoaderMessage, WIDGET_MESSAGE_SOURCE, type LoaderMessage, type PanelMessage } from "@askwell/shared";

/**
 * The panel's side of the widget protocol (project.md §6.5, §9). `host` is the embedding
 * page's origin from the validated /embed params: the only origin we post to or listen to.
 */

type IncomingEvent = Pick<MessageEvent, "origin" | "source" | "data">;

/** A loader message, or null unless it came from the parent window on `host`. */
export function acceptHostMessage(event: IncomingEvent, host: string, parent: unknown): LoaderMessage | null {
  if (event.origin !== host || event.source === null || event.source !== parent) return null;
  return parseLoaderMessage(event.data);
}

type PanelMessageBody =
  | { type: "close" }
  | { type: "resize"; height: number }
  | { type: "unread"; count: number };

/** Posts to the parent with `host` as targetOrigin, never `*`. A no-op when not framed. */
export function postToHost(self: Pick<Window, "parent">, host: string, body: PanelMessageBody): void {
  if (self.parent === (self as unknown)) return;
  const message: PanelMessage = { source: WIDGET_MESSAGE_SOURCE, ...body };
  self.parent.postMessage(message, host);
}

/**
 * Unread bot replies (the loader's button badge). Counts only while the panel is hidden;
 * showing it clears the count. Returns the next state and the count to post, if it changed.
 */
export type UnreadState = { visible: boolean; count: number };

export function unreadOnReply(state: UnreadState): { state: UnreadState; post: number | null } {
  if (state.visible) return { state, post: null };
  const count = state.count + 1;
  return { state: { ...state, count }, post: count };
}

export function unreadOnVisibility(state: UnreadState, visible: boolean): { state: UnreadState; post: number | null } {
  if (!visible) return { state: { ...state, visible }, post: null };
  return { state: { visible, count: 0 }, post: state.count === 0 ? null : 0 };
}
