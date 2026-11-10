import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "./cn";

type GlassPanelProps<T extends ElementType> = {
  /** The element to render. Defaults to `div`. */
  as?: T;
  /** A more opaque panel, for content that sits on top of other glass. */
  strong?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

/** A blurred, translucent panel. Works on the light and the dark theme. */
export function GlassPanel<T extends ElementType = "div">({
  as,
  strong = false,
  className,
  ...props
}: GlassPanelProps<T>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cn(
        "rounded-lg border border-border shadow-panel backdrop-blur-glass",
        strong ? "bg-glass-strong" : "bg-glass",
        className,
      )}
      {...props}
    />
  );
}
