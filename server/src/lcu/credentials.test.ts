import { describe, it, expect } from "vitest";
import { buildCredentials } from "./credentials";
import { createLcuClient } from "./client";

describe("buildCredentials", () => {
  const data = {
    process: "LeagueClient",
    pid: 1,
    port: 54321,
    token: "segredo",
    protocol: "https",
  };

  it("monta a baseUrl com protocolo, 127.0.0.1 e porta", () => {
    expect(buildCredentials(data).baseUrl).toBe("https://127.0.0.1:54321");
  });

  it("monta o header Basic com base64 de 'riot:TOKEN'", () => {
    const esperado = "Basic " + Buffer.from("riot:segredo").toString("base64");
    expect(buildCredentials(data).authHeader).toBe(esperado);
  });
});

describe("createLcuClient", () => {
  it("cria uma instância axios com baseURL e header de auth", () => {
    const creds = { baseUrl: "https://127.0.0.1:1234", authHeader: "Basic xyz" };
    const client = createLcuClient(creds);
    expect(client.defaults.baseURL).toBe("https://127.0.0.1:1234");
    expect(client.defaults.headers.Authorization).toBe("Basic xyz");
    expect(client.defaults.httpsAgent).toBeDefined();
  });
});
