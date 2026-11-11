"use client";

import { PanelHeader, PanelShell } from "./panel-shell";
import { useHostBridge } from "./use-host-bridge";

/** Bad params or unknown key. Says nothing about why. Close works when `host` was valid. */
export function ChatUnavailable({ host }: { host: string | null }) {
  const bridge = useHostBridge(host);
  return (
    <PanelShell>
      <PanelHeader title="Chat" onClose={host ? bridge.close : undefined} />
      <div className="grid flex-1 place-items-center px-8 text-center">
        <div>
          <p className="text-sm font-medium">This chat isn&apos;t available</p>
          <p className="mt-1 text-sm text-muted">Please try again later.</p>
        </div>
      </div>
    </PanelShell>
  );
}
