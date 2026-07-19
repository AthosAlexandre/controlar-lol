import { AxiosInstance } from "axios";
import { readLockfile } from "./lockfile-reader";
import { buildCredentials } from "./credentials";
import { createLcuClient } from "./client";

/**
 * Monta um cliente HTTP pronto para falar com a LCU, a partir do lockfile.
 * Retorna null se o LoL estiver fechado (lockfile ausente).
 */
export function connectToLcu(path?: string): AxiosInstance | null {
  const lockfile = readLockfile(path);
  if (!lockfile) return null;
  return createLcuClient(buildCredentials(lockfile));
}
