import { describe, expect, it } from "vitest";
import { BILLING_PATH, DASHBOARD_PATH, isNavItemActive } from "./nav-items";

describe("isNavItemActive", () => {
  it("marks Projects active on /dashboard and on project pages", () => {
    expect(isNavItemActive("/dashboard", DASHBOARD_PATH)).toBe(true);
    expect(isNavItemActive("/dashboard/6f1c2b9e/knowledge", DASHBOARD_PATH)).toBe(true);
  });

  it("marks only Billing active on billing pages", () => {
    expect(isNavItemActive("/dashboard/billing", BILLING_PATH)).toBe(true);
    expect(isNavItemActive("/dashboard/billing", DASHBOARD_PATH)).toBe(false);
    expect(isNavItemActive("/dashboard/billing/invoices", DASHBOARD_PATH)).toBe(false);
  });

  it("doesn't match look-alike paths", () => {
    expect(isNavItemActive("/dashboard/billingx", BILLING_PATH)).toBe(false);
    expect(isNavItemActive("/dashboardx", DASHBOARD_PATH)).toBe(false);
    expect(isNavItemActive("/", DASHBOARD_PATH)).toBe(false);
  });
});
