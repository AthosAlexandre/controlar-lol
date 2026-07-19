import { readFileSync } from "node:fs";
import { parseLockfile, LockfileData } from "./lockfile";

/** Caminho padrão do lockfile numa instalação em C:\Riot Games. */
export const DEFAULT_LOCKFILE_PATH =
  "C:\\Riot Games\\League of Legends\\lockfile";

/**
 * Lê o lockfile do disco e faz o parse.
 * Retorna null se o arquivo não existir (LoL fechado); relança outros erros.
 */
export function readLockfile(
  path: string = DEFAULT_LOCKFILE_PATH
): LockfileData | null {
  try {
    const content = readFileSync(path, "utf8");
    return parseLockfile(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // LoL fechado — não é erro
    }
    throw err;
  }
}
