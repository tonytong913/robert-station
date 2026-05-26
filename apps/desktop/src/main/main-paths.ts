import path from "node:path";
import { fileURLToPath } from "node:url";

export type MainAssetPaths = {
  preloadPath: string;
  rendererHtmlPath: string;
};

export function getMainAssetPaths(moduleUrl: string | URL): MainAssetPaths {
  const mainDirectory = path.dirname(fileURLToPath(moduleUrl));

  return {
    preloadPath: path.join(mainDirectory, "../preload/preload.js"),
    rendererHtmlPath: path.join(mainDirectory, "../renderer/index.html")
  };
}
