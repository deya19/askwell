"use client";

import { useEffect, useRef } from "react";
import { acceptHostMessage, postToHost, unreadOnReply, unreadOnVisibility, type UnreadState } from "./host-messaging";

/**
 * Wires the panel to the loader on `host`: Escape and the close button post `close`,
 * `opened`/`closed` track visibility, and replies that arrive while hidden post `unread`.
 * `host` is null when the params were bad: then nothing is posted or accepted.
 */
export function useHostBridge(host: string | null, onOpened?: () => void) {
  const unread = useRef<UnreadState>({ visible: true, count: 0 });
  const onOpenedRef = useRef(onOpened);

  useEffect(() => {
    onOpenedRef.current = onOpened;
  }, [onOpened]);

  useEffect(() => {
    if (!host) return;

    const onMessage = (event: MessageEvent) => {
      const message = acceptHostMessage(event, host, window.parent);
      if (!message) return;
      const visible = message.type === "opened";
      const step = unreadOnVisibility(unread.current, visible);
      unread.current = step.state;
      if (step.post !== null) postToHost(window, host, { type: "unread", count: step.post });
      if (visible) onOpenedRef.current?.();
    };

    // The loader can't see keys pressed inside this cross-origin iframe, so Escape is ours.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") postToHost(window, host, { type: "close" });
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [host]);

  return {
    close() {
      if (host) postToHost(window, host, { type: "close" });
    },
    replyArrived() {
      if (!host) return;
      const step = unreadOnReply(unread.current);
      unread.current = step.state;
      if (step.post !== null) postToHost(window, host, { type: "unread", count: step.post });
    },
  };
}
