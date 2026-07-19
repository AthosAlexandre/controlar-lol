import { describe, it, expect } from "vitest";
import { buildCredentials } from "./credentials";

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
