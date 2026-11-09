import { APP_NAME } from "@askwell/shared";
import Link from "next/link";
import { LogoMark } from "./site-header";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#install", label: "Install" },
  { href: "/sign-up", label: "Start free" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark />
          {APP_NAME}
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-muted">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
    </footer>
  );
}
