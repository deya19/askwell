import { describe, expect, it } from "vitest";
import { BILLING_PATH, isNavItemActive, NAV_ITEMS, PROJECTS_PATH } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("links Projects to the projects list", () => {
    expect(NAV_ITEMS.find((item) => item.label === "Projects")?.href).toBe("/dashboard/projects");
  });
});

describe("isNavItemActive", () => {
  it("marks Projects active on the list, every project page, and /dashboard", () => {
    expect(isNavItemActive("/dashboard/projects", PROJECTS_PATH)).toBe(true);
    expect(isNavItemActive("/dashboard/projects/6f1c2b9e/install", PROJECTS_PATH)).toBe(true);
    expect(isNavItemActive("/dashboard", PROJECTS_PATH)).toBe(true);
  });

  it("marks only Billing active on billing pages", () => {
    expect(isNavItemActive("/dashboard/billing", BILLING_PATH)).toBe(true);
    expect(isNavItemActive("/dashboard/billing/invoices", BILLING_PATH)).toBe(true);
    expect(isNavItemActive("/dashboard/billing", PROJECTS_PATH)).toBe(false);
    expect(isNavItemActive("/dashboard/projects", BILLING_PATH)).toBe(false);
  });

  it("doesn't match look-alike paths", () => {
    expect(isNavItemActive("/dashboard/billingx", BILLING_PATH)).toBe(false);
    expect(isNavItemActive("/dashboard/projectsx", PROJECTS_PATH)).toBe(false);
    expect(isNavItemActive("/dashboardx", PROJECTS_PATH)).toBe(false);
    expect(isNavItemActive("/", PROJECTS_PATH)).toBe(false);
  });
});
