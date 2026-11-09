import { expect, test } from "vitest";
import { APP_NAME } from "./index";

test("APP_NAME is the product name", () => {
  expect(APP_NAME).toBe("Askwell");
});
