import { describe, expect, test } from "vitest";
import { readPostHogConfig } from "./config";
import { distinctIdFromCookies } from "./distinct-id";
import { ANALYTICS_EVENTS } from "./events";
import { isReplayPath } from "./replay";

describe("readPostHogConfig", () => {
  test("trims values and drops a trailing slash on the host", () => {
    expect(
      readPostHogConfig({ NEXT_PUBLIC_POSTHOG_KEY: " phc_x ", NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com//" }),
    ).toEqual({ key: "phc_x", host: "https://eu.i.posthog.com" });
  });

  test.each([
    [{}],
    [{ NEXT_PUBLIC_POSTHOG_KEY: "phc_x" }],
    [{ NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com" }],
    [{ NEXT_PUBLIC_POSTHOG_KEY: "  ", NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com" }],
    [{ NEXT_PUBLIC_POSTHOG_KEY: "phc_x", NEXT_PUBLIC_POSTHOG_HOST: "us.i.posthog.com" }],
  ])("null when missing or invalid: %j", (env) => {
    expect(readPostHogConfig(env)).toBeNull();
  });
});

describe("distinctIdFromCookies", () => {
  const cookie = (value: unknown) => `ph_phc_x_posthog=${encodeURIComponent(JSON.stringify(value))}`;

  test("reads distinct_id from posthog-js's cookie", () => {
    expect(distinctIdFromCookies(`a=1; ${cookie({ distinct_id: "user_1", $sesid: [] })}; b=2`, "phc_x")).toBe("user_1");
  });

  test("accepts a header array", () => {
    expect(distinctIdFromCookies(["a=1", cookie({ distinct_id: "anon-1" })], "phc_x")).toBe("anon-1");
  });

  test.each([
    ["no header", undefined],
    ["another project's cookie", `ph_phc_other_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: "x" }))}`],
    ["bad JSON", "ph_phc_x_posthog=%7Bnope"],
    ["no distinct_id", cookie({ other: 1 })],
    ["empty distinct_id", cookie({ distinct_id: "" })],
    ["non-object JSON", cookie("user_1")],
  ])("undefined with %s", (_label, header) => {
    expect(distinctIdFromCookies(header, "phc_x")).toBeUndefined();
  });
});

describe("isReplayPath", () => {
  test.each(["/", "/dashboard", "/dashboard/projects/abc/knowledge"])("records %s", (path) => {
    expect(isReplayPath(path)).toBe(true);
  });

  test.each(["/sign-in", "/sign-up/verify", "/embed", "/dashboards", "/pricing"])("skips %s", (path) => {
    expect(isReplayPath(path)).toBe(false);
  });
});

describe("ANALYTICS_EVENTS", () => {
  test("lists the §6.11 events once each", () => {
    expect([...ANALYTICS_EVENTS].sort()).toEqual(
      ["first_chat", "knowledge_added", "message_blocked", "project_created", "signed_up", "snippet_copied", "upgraded"],
    );
  });
});
