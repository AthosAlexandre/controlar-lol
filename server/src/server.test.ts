import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { startServer, stopServer } from "./server";

afterEach(async () => {
  await stopServer();
});

describe("servidor controlável", () => {
  test("serve o index.html do web e para de escutar depois do stop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "web-dist-"));
    writeFileSync(join(dir, "index.html"), "<h1>Modo Banheiro</h1>");

    const server = await startServer({ port: 0, webDistPath: dir });
    const port = (server.address() as AddressInfo).port;

    const res = await fetch(`http://127.0.0.1:${port}/`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("Modo Banheiro");

    await stopServer();

    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toBeTruthy();
  });
});
