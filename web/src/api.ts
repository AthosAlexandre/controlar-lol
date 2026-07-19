// O app foi carregado pelo IP/host do PC; o servidor é o mesmo host na porta 3000.
const baseUrl = `http://${window.location.hostname}:3000`;

export interface Summoner {
  name: string;
  tagLine: string;
  level: number;
}

export async function getSummoner(): Promise<Summoner> {
  const res = await fetch(`${baseUrl}/api/summoner`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function accept(): Promise<void> {
  const res = await fetch(`${baseUrl}/api/accept`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
}

export async function getAutoAccept(): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/auto-accept`);
  const body = await res.json();
  return Boolean(body.enabled);
}

export async function setAutoAccept(enabled: boolean): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/auto-accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const body = await res.json();
  return Boolean(body.enabled);
}
