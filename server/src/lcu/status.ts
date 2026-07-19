import { readLockfile, DEFAULT_LOCKFILE_PATH } from "./lockfile-reader";

/** true se o cliente do LoL está aberto (lockfile presente). */
export function isLolRunning(path: string = DEFAULT_LOCKFILE_PATH): boolean {
  return readLockfile(path) !== null;
}
