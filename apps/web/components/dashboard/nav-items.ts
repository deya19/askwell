/** Account-level dashboard navigation (project.md §6.3, §6.10). */
export type NavItem = { href: string; label: string };

export const DASHBOARD_PATH = "/dashboard";
export const BILLING_PATH = "/dashboard/billing";

export const NAV_ITEMS: readonly NavItem[] = [
  { href: DASHBOARD_PATH, label: "Projects" },
  { href: BILLING_PATH, label: "Billing" },
];

/** Account-level pages that live directly under /dashboard and aren't projects. */
const ACCOUNT_PAGES = NAV_ITEMS.map((item) => item.href).filter((href) => href !== DASHBOARD_PATH);

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Whether a nav item is the current section.
 * "Projects" covers /dashboard and every project page (/dashboard/<projectId>/…),
 * but not the other account pages such as /dashboard/billing.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href !== DASHBOARD_PATH) return isUnder(pathname, href);
  if (!isUnder(pathname, DASHBOARD_PATH)) return false;
  return !ACCOUNT_PAGES.some((page) => isUnder(pathname, page));
}
