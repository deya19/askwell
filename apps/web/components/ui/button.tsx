import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize };

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap transition duration-200 ease-out-soft disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-85 active:scale-[0.98]",
  secondary:
    "border border-border bg-glass text-fg backdrop-blur-glass hover:bg-glass-strong active:scale-[0.98]",
  ghost: "text-muted hover:text-fg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

/** The classes for a button. Use it to style other elements as buttons. */
export function buttonClasses({ variant = "primary", size = "md" }: ButtonStyle = {}, className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonStyle & ComponentPropsWithoutRef<"button">;

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size }, className)} {...props} />;
}

type ButtonLinkProps = ButtonStyle & ComponentPropsWithoutRef<typeof Link>;

/** A link that looks like a button. */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size }, className)} {...props} />;
}
