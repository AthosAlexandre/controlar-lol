import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import QRCode from "qrcode";
import { autoUpdater } from "electron-updater";
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

/**
 * Checa por atualizações nas Releases do GitHub (repo público) e PERGUNTA antes
 * de baixar/instalar. Só roda no app empacotado — no dev não há update para checar.
 * Fluxo: "Nova versão, deseja atualizar?" → baixa → "Baixado, reiniciar agora?".
 */
function setupAutoUpdate() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false; // não baixa sem o usuário aceitar

  autoUpdater.on("update-available", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Atualização disponível",
      message: `Nova versão ${info.version} disponível.`,
      detail: "Deseja baixar e atualizar agora?",
      buttons: ["Atualizar", "Agora não"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      autoUpdater.downloadUpdate().catch(() => {
        // falha ao baixar (rede) — ignora, o app segue na versão atual
      });
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Atualização pronta",
      message: `Versão ${info.version} baixada.`,
      detail: "Reiniciar agora para instalar?",
      buttons: ["Reiniciar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", () => {
    // sem internet / sem release / erro: ignora, o app abre normal
  });

  autoUpdater.checkForUpdates().catch(() => {
    // falha de update nunca deve quebrar o app
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate();
});

app.on("window-all-closed", async () => {
  // Sem system tray: fechar a janela para o server e encerra o app.
  try {
    await backend().stopServer();
  } catch {
    // se o server nunca subiu, ignora
  }
  app.quit();
});
