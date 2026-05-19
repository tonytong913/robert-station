import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("robertStation", {
  appName: "Robert Station"
});
