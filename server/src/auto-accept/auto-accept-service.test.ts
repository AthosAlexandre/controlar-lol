import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AxiosInstance } from "axios";
import { pollAndAccept, createAutoAcceptService } from "./auto-accept-service";

describe("pollAndAccept", () => {
  it("aceita quando a fase é ReadyCheck", async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    const client = {
      get: vi.fn().mockResolvedValue({ data: "ReadyCheck" }),
      post,
    } as unknown as AxiosInstance;

    await pollAndAccept(() => client);

    expect(post).toHaveBeenCalledWith("/lol-matchmaking/v1/ready-check/accept");
  });

  it("não aceita em outra fase", async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    const client = {
      get: vi.fn().mockResolvedValue({ data: "Lobby" }),
      post,
    } as unknown as AxiosInstance;

    await pollAndAccept(() => client);

    expect(post).not.toHaveBeenCalled();
  });

  it("não quebra quando o LoL está fechado (connect retorna null)", async () => {
    await expect(pollAndAccept(() => null)).resolves.toBeUndefined();
  });
});

describe("createAutoAcceptService", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("começa desligado", () => {
    const service = createAutoAcceptService(vi.fn().mockResolvedValue(undefined));
    expect(service.isEnabled()).toBe(false);
  });

  it("quando ligado, chama o check a cada intervalo; quando desligado, para", () => {
    const check = vi.fn().mockResolvedValue(undefined);
    const service = createAutoAcceptService(check, 1000);

    service.setEnabled(true);
    expect(service.isEnabled()).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(check).toHaveBeenCalledTimes(3);

    service.setEnabled(false);
    vi.advanceTimersByTime(5000);
    expect(check).toHaveBeenCalledTimes(3); // não chamou mais
    expect(service.isEnabled()).toBe(false);
  });
});
