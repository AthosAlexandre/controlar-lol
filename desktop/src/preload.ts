import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("banheiro", {
  enable: (): Promise<{ url: string; qr: string }> =>
    ipcRenderer.invoke("remote:enable"),
  disable: (): Promise<void> => ipcRenderer.invoke("remote:disable"),
  lolStatus: (): Promise<boolean> => ipcRenderer.invoke("lol:status"),
});
