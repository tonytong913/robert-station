import { app, BrowserWindow } from "electron";
import { createContentAgentRuntime } from "@robert-station/agent-runtime";
import { SqliteContentLoopRepository } from "@robert-station/local-store";
import path from "node:path";
import { registerContentLoopIpc } from "./content-loop-service";

function createMainWindow(): void {
  const preloadPath = path.join(__dirname, "../preload/preload.js");
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "Robert Station",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.on("preload-error", (_event, failedPreloadPath, error) => {
    console.error("Electron preload failed", { failedPreloadPath, message: error.message, stack: error.stack });
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

async function startApp(): Promise<void> {
  await app.whenReady();

  const agentRuntime = createContentAgentRuntime({
    ...(process.env.ROBERT_STATION_AGENT_RUNTIME ? { runtime: process.env.ROBERT_STATION_AGENT_RUNTIME } : {}),
    ...(process.env.OPENAI_API_KEY ? { providerApiKey: process.env.OPENAI_API_KEY } : {})
  });
  const repository = SqliteContentLoopRepository.open({
    databasePath: path.join(app.getPath("userData"), "robert-station.sqlite"),
    ...(agentRuntime ? { agentRuntime } : {})
  });

  registerContentLoopIpc(repository);
  createMainWindow();

  app.on("before-quit", () => {
    repository.close();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

void startApp().catch((error: unknown) => {
  console.error("Failed to start Electron main process", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
