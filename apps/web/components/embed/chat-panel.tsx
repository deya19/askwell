"use client";

import { APP_NAME, MAX_CHAT_MESSAGE_LENGTH } from "@askwell/shared";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getVisitorId } from "@/lib/visitor-id";
import { cn } from "@/components/ui/cn";
import { requestReply } from "./mock-reply";
import { PanelHeader, PanelShell } from "./panel-shell";
import { useHostBridge } from "./use-host-bridge";

type ChatItem = { id: number; role: "visitor" | "bot" | "error"; text: string };

export type ChatPanelProps = {
  publicKey: string;
  host: string;
  headerText: string;
  showBadge: boolean;
};

/** Show the character count once the visitor gets close to the limit. */
const COUNT_FROM = MAX_CHAT_MESSAGE_LENGTH - 100;

/**
 * The chat inside the widget iframe (project.md §6.5). Every message renders as text
 * (React escapes it; no `dangerouslySetInnerHTML`), never as HTML (§9 XSS).
 */
export function ChatPanel({ publicKey, host, headerText, showBadge }: ChatPanelProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const nextId = useRef(0);
  const visitorId = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const bridge = useHostBridge(host, () => input.current?.focus());

  useEffect(() => {
    visitorId.current = getVisitorId();
    // The loader creates this iframe on first open, so the panel is visible now.
    input.current?.focus({ preventScroll: true });
    return () => pending.current?.abort();
  }, []);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [items, waiting]);

  const add = (role: ChatItem["role"], text: string) =>
    setItems((current) => [...current, { id: nextId.current++, role, text }]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || waiting) return;

    add("visitor", message);
    setDraft("");
    setWaiting(true);
    const controller = new AbortController();
    pending.current = controller;
    try {
      const { reply } = await requestReply(
        { key: publicKey, visitorId: visitorId.current ?? getVisitorId(), message },
        { signal: controller.signal },
      );
      add("bot", reply);
      bridge.replyArrived();
    } catch {
      if (controller.signal.aborted) return;
      add("error", "Something went wrong. Try again.");
    } finally {
      if (!controller.signal.aborted) setWaiting(false);
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter is a new line. Not while an IME is composing.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <PanelShell>
      <PanelHeader title={headerText} onClose={bridge.close} />

      <div role="log" aria-live="polite" aria-label="Messages" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 && !waiting ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-medium">Ask us anything</p>
              <p className="mt-1 text-sm text-muted">Type a question below and we&apos;ll answer right here.</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li key={item.id} className={cn("flex", item.role === "visitor" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                    item.role === "visitor" && "rounded-br-sm bg-accent text-accent-fg",
                    item.role === "bot" && "rounded-bl-sm border border-border bg-glass-strong shadow-panel backdrop-blur-glass",
                    item.role === "error" && "rounded-bl-sm border border-border bg-bg-raised text-muted",
                  )}
                >
                  {item.text}
                </p>
              </li>
            ))}
            {waiting && (
              <li className="flex justify-start">
                <div
                  role="status"
                  className="flex items-center gap-1 rounded-lg rounded-bl-sm border border-border bg-glass-strong px-3.5 py-3 shadow-panel backdrop-blur-glass"
                >
                  <span className="sr-only">Typing…</span>
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      aria-hidden
                      className="size-1.5 animate-bounce rounded-full bg-muted"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </li>
            )}
          </ul>
        )}
        <div ref={listEnd} />
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-border bg-glass-strong px-3 pt-3 pb-2 backdrop-blur-glass">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-bg-raised p-1.5 pl-3 focus-within:border-fg/30">
          <label htmlFor="chat-input" className="sr-only">
            Your message
          </label>
          <textarea
            id="chat-input"
            ref={input}
            rows={1}
            value={draft}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type your question…"
            className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none [field-sizing:content] placeholder:text-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={waiting || draft.trim() === ""}
            aria-label="Send"
            className="grid size-8 shrink-0 place-items-center rounded-pill bg-accent text-accent-fg transition hover:opacity-85 disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <div className="flex h-6 items-center justify-between px-1 text-[11px] text-muted">
          {showBadge ? (
            <a href="/" target="_blank" rel="noopener" className="hover:text-fg">
              Powered by <span className="font-semibold">{APP_NAME}</span>
            </a>
          ) : (
            <span />
          )}
          {draft.length >= COUNT_FROM && (
            <span aria-live="polite">
              {draft.length}/{MAX_CHAT_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      </form>
    </PanelShell>
  );
}
