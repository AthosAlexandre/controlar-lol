import { AxiosInstance } from "axios";

export interface RunePage {
  id: number;
  name: string;
  current: boolean;
}

export async function getRunePages(client: AxiosInstance): Promise<RunePage[]> {
  const { data } = await client.get("/lol-perks/v1/pages");
  return (data as { id: number; name: string; current: boolean }[]).map((p) => ({
    id: p.id,
    name: p.name,
    current: p.current,
  }));
}

/** Deixa a página de runas com esse id como a página ativa. */
export async function setCurrentRunePage(
  client: AxiosInstance,
  id: number
): Promise<void> {
  await client.put("/lol-perks/v1/currentpage", id);
}
