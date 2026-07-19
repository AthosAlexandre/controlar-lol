import { LockfileData } from "./lockfile";

/** Credenciais prontas para falar com a LCU API local. */
export interface LcuCredentials {
  baseUrl: string;
  authHeader: string;
}

/**
 * Constrói baseUrl e header de autenticação a partir dos dados do lockfile.
 * A LCU usa HTTP Basic com usuário fixo "riot" e o token como senha.
 */
export function buildCredentials(data: LockfileData): LcuCredentials {
  const token = Buffer.from(`riot:${data.token}`).toString("base64");
  return {
    baseUrl: `${data.protocol}://127.0.0.1:${data.port}`,
    authHeader: `Basic ${token}`,
  };
}
