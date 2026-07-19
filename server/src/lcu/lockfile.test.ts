import { describe, it, expect } from "vitest";
import { parseLockfile } from "./lockfile";

describe("parseLockfile", () => {
  it("extrai os 5 campos do lockfile", () => {
    const result = parseLockfile("LeagueClient:12345:54321:AbCdEf123456:https");
    expect(result).toEqual({
      process: "LeagueClient",
      pid: 12345,
      port: 54321,
      token: "AbCdEf123456",
      protocol: "https",
    });
  });

  it("ignora espaços/quebras de linha nas pontas", () => {
    const result = parseLockfile("LeagueClient:1:2:tok:https\n");
    expect(result.port).toBe(2);
    expect(result.protocol).toBe("https");
  });

  it("lança erro se o número de campos for diferente de 5", () => {
    expect(() => parseLockfile("so:tres:campos")).toThrow();
  });
});
