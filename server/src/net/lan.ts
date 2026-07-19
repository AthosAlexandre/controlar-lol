import os from "node:os";

function isPrivateIpv4(ip: string): boolean {
  return (
    /^192\.168\./.test(ip) ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

export function pickLanIp(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>
): string | null {
  for (const infos of Object.values(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family === "IPv4" && !info.internal && isPrivateIpv4(info.address)) {
        return info.address;
      }
    }
  }
  return null;
}

export function getLanUrl(port: number): string {
  const ip = pickLanIp(os.networkInterfaces());
  return `http://${ip ?? "localhost"}:${port}`;
}
