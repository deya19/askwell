/** Account-level dashboard navigation (project.md §6.3, §6.10). */
export type NavItem = { href: string; label: string };

/** The dashboard root. It redirects to the projects list. */
export const DASHBOARD_PATH = "/dashboard";
export const PROJECTS_PATH = "/dashboard/projects";
export const BILLING_PATH = "/dashboard/billing";

export const NAV_ITEMS: readonly NavItem[] = [
  { href: PROJECTS_PATH, label: "Projects" },
  { href: BILLING_PATH, label: "Billing" },
];

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Whether a nav item is the current section: its page and everything under it.
 * "Projects" also covers the bare /dashboard, which redirects to it.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === PROJECTS_PATH && pathname === DASHBOARD_PATH) return true;
  return isUnder(pathname, href);
}
