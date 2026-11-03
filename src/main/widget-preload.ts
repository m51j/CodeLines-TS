import { contextBridge, ipcRenderer } from "electron";
import type { IpcResponse, WidgetApi, WidgetData } from "../shared/contracts";
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const response = (await ipcRenderer.invoke(
    "codelines:widget:" + channel,
    ...args,
  )) as IpcResponse<T>;
  if (!response.ok)
    throw Object.assign(new Error(response.error.message), response.error);
  return response.value;
}
const api: WidgetApi = {
  load: () => invoke("load"),
  onData: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, value: WidgetData) =>
      callback(value);
    ipcRenderer.on("codelines:widget:data", listener);
    return () => ipcRenderer.removeListener("codelines:widget:data", listener);
  },
  move: (mode) => invoke("move", mode),
  openApp: () => invoke("openApp"),
  menu: () => invoke("menu"),
  setView: (view) => invoke("view", view),
};
contextBridge.exposeInMainWorld("codelinesWidget", api);
