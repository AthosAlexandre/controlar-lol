import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import QRCode from "qrcode";
import { SERVER_BUNDLE, WEB_DIST } from "./paths";

const PORT = 3000;

type Backend = {
  startServer(opts: { port?: number; webDistPath?: string }): Promise<unknown>;
  stopServer(): Promise<void>;
  getLanUrl(port: number): string;
  isLolRunning(): boolean;
};

function backend(): Backend {
  // require dinâmico: bundle CJS único, sem node_modules externos.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(SERVER_BUNDLE()) as Backend;
}

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: false,
    title: "LoL Modo Banheiro",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  void win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("remote:enable", async () => {
  const b = backend();
  await b.startServer({ port: PORT, webDistPath: WEB_DIST() });
  const url = b.getLanUrl(PORT);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  return { url, qr };
});

ipcMain.handle("remote:disable", async () => {
  await backend().stopServer();
});

ipcMain.handle("lol:status", async () => backend().isLolRunning());

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  // Sem system tray: fechar a janela para o server e encerra o app.
  try {
    await backend().stopServer();
  } catch {
    // se o server nunca subiu, ignora
  }
  app.quit();
});
