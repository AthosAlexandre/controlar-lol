import { describe, it, expect } from "vitest";
import { connectToLcu } from "./connect";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("connectToLcu", () => {
  it("retorna null quando o LoL está fechado (lockfile ausente)", () => {
    expect(connectToLcu(join(tmpdir(), "lockfile-inexistente-abc"))).toBeNull();
  });

  it("retorna um cliente axios com a baseURL da LCU quando há lockfile", () => {
    const caminho = join(tmpdir(), "lockfile-connect-teste");
    writeFileSync(caminho, "LeagueClient:1:54321:tok:https");
    try {
      const client = connectToLcu(caminho);
      expect(client?.defaults.baseURL).toBe("https://127.0.0.1:54321");
    } finally {
      rmSync(caminho, { force: true });
    }
  });
});
