import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopApi,
  Progress,
  IpcResponse,
  WindowState,
} from "../shared/contracts";
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const response = (await ipcRenderer.invoke(
    channel,
    ...args,
  )) as IpcResponse<T>;
  if (!response.ok)
    throw Object.assign(new Error(response.error.message), response.error);
  return response.value;
}
const api: DesktopApi = {
  getWindowState: () => invoke("codelines:windowState"),
  windowAction: (action) => invoke("codelines:windowAction", action),
  onWindowState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, value: WindowState) =>
      callback(value);
    ipcRenderer.on("codelines:windowState", listener);
    return () => ipcRenderer.removeListener("codelines:windowState", listener);
  },
  load: () => invoke("codelines:load"),
  save: (settings) => invoke("codelines:save", settings),
  addProject: () => invoke("codelines:add"),
  importProjects: () => invoke("codelines:import"),
  migrate: () => invoke("codelines:migrate"),
  run: (request) => invoke("codelines:run", request),
  cancel: (id) => invoke("codelines:cancel", id),
  export: (request) => invoke("codelines:export", request),
  openReport: () => invoke("codelines:openReport"),
  onProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, value: Progress) =>
      callback(value);
    ipcRenderer.on("codelines:progress", listener);
    return () => ipcRenderer.removeListener("codelines:progress", listener);
  },
};
contextBridge.exposeInMainWorld("codelines", api);
