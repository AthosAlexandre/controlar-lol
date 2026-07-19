import { test, expect } from "vitest";
import { isLolRunning } from "./status";

test("isLolRunning é false quando o lockfile não existe no caminho dado", () => {
  expect(isLolRunning("C:\\caminho\\que\\nao\\existe\\lockfile")).toBe(false);
});
