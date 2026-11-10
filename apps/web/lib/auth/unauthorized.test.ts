import { describe, expect, it } from "vitest";
import { apiErrorSchema } from "@askwell/shared";
import { unauthorizedResponse } from "./unauthorized";

describe("unauthorizedResponse", () => {
  it("is a 401 with the shared error body", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body: unknown = await res.json();
    expect(apiErrorSchema.parse(body).error.code).toBe("unauthorized");
  });
});
