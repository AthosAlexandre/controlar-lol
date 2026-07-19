import { test, expect } from "vitest";
import type { NetworkInterfaceInfo } from "node:os";
import { pickLanIp } from "./lan";

const ipv4 = (address: string, internal: boolean): NetworkInterfaceInfo =>
  ({ address, internal, family: "IPv4", netmask: "", mac: "", cidr: null } as NetworkInterfaceInfo);

test("pega o IPv4 privado da LAN, ignorando loopback", () => {
  const ifaces = {
    Loopback: [ipv4("127.0.0.1", true)],
    "Wi-Fi": [ipv4("192.168.0.15", false)],
  };
  expect(pickLanIp(ifaces)).toBe("192.168.0.15");
});

test("retorna null quando só há loopback", () => {
  expect(pickLanIp({ Loopback: [ipv4("127.0.0.1", true)] })).toBeNull();
});

test("aceita faixas 10.x e 172.16-31.x", () => {
  expect(pickLanIp({ eth: [ipv4("10.0.0.5", false)] })).toBe("10.0.0.5");
  expect(pickLanIp({ eth: [ipv4("172.20.1.2", false)] })).toBe("172.20.1.2");
});
