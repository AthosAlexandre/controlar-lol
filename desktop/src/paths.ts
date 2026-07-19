import path from "node:path";
import { app } from "electron";

/**
 * Em dev: recursos ficam nas pastas irmãs (../server, ../web).
 * Empacotado (electron-builder extraResources): ficam em process.resourcesPath.
 */
export function resourcePath(...parts: string[]): string {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.resolve(__dirname, "..", "..");
  return path.join(base, ...parts);
}

export const SERVER_BUNDLE = () => resourcePath("server", "dist", "server.bundle.js");
export const WEB_DIST = () => resourcePath("web", "dist");
