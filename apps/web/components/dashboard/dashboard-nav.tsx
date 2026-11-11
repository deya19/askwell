"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/components/ui/cn";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";

/**
 * Account-level navigation. Inline from `sm` up; below that it collapses
 * into a menu button that opens a glass panel under the header.
 */
export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // Close the mobile menu on Escape (links close it on click).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav aria-label="Dashboard" className="flex items-center">
      <ul className="hidden items-center gap-1 sm:flex">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink href={item.href} label={item.label} active={isNavItemActive(pathname, item.href)} />
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="grid size-9 place-items-center rounded-pill border border-border bg-glass text-fg backdrop-blur-glass transition hover:bg-glass-strong sm:hidden"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
        </svg>
      </button>

      <div
        id={menuId}
        hidden={!open}
        // Opaque: the header's own backdrop-filter stops a nested blur from
        // reaching the page, so a glass panel here would let the content show through.
        className="absolute inset-x-0 top-full border-b border-border bg-bg-raised px-4 py-3 shadow-panel sm:hidden"
      >
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink
                href={item.href}
                label={item.label}
                active={isNavItemActive(pathname, item.href)}
                className="flex h-11 w-full items-center px-4"
                onClick={() => setOpen(false)}
              />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  active,
  className,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-pill px-3.5 text-sm font-medium transition-colors",
        active ? "bg-accent text-accent-fg" : "text-muted hover:bg-glass-strong hover:text-fg",
        className,
      )}
    >
      {label}
    </Link>
  );
}
