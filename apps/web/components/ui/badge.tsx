import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

/** A small pill label. */
export function Badge({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-border bg-glass px-3 py-1 text-xs font-medium text-muted backdrop-blur-glass",
        className,
      )}
      {...props}
    />
  );
}
