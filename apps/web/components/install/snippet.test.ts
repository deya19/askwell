import { publicKeySchema } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { INSTALL_STEPS, installSnippet } from "./snippet";

describe("installSnippet", () => {
  it("builds the script tag with the app URL and the project's key", () => {
    expect(installSnippet("https://askwell.example.com", "pk_0123456789abcdef")).toBe(
      '<script src="https://askwell.example.com/widget.js" data-key="pk_0123456789abcdef" async></script>',
    );
  });

  it("only takes keys that are safe inside the attribute", () => {
    expect(publicKeySchema.safeParse('pk_abc"><script>').success).toBe(false);
  });
});

describe("INSTALL_STEPS", () => {
  it("has the three steps: copy, paste before </body>, reload", () => {
    expect(INSTALL_STEPS).toHaveLength(3);
    expect(INSTALL_STEPS[1]).toContain("</body>");
  });
});
