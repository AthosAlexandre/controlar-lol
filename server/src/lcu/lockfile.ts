/** Dados extraídos do lockfile do cliente do LoL. */
export interface LockfileData {
  process: string;
  pid: number;
  port: number;
  token: string;
  protocol: string;
}

/**
 * Faz o parse do conteúdo do lockfile.
 * Formato: "NomeProcesso:PID:PORTA:TOKEN:PROTOCOLO" (separado por ':').
 */
export function parseLockfile(content: string): LockfileData {
  const parts = content.trim().split(":");
  if (parts.length !== 5) {
    throw new Error(`Lockfile inválido: esperava 5 campos, recebi ${parts.length}`);
  }
  const [process, pid, port, token, protocol] = parts;
  return {
    process,
    pid: Number(pid),
    port: Number(port),
    token,
    protocol,
  };
}
