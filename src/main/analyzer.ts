import { parentPort } from "node:worker_threads";
import { analyzeFile } from "../services/scanner";
parentPort?.on("message", async ({ file, language, options }) => {
  try {
    parentPort?.postMessage({
      value: await analyzeFile(file, language, options),
    });
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    parentPort?.postMessage({
      error: { name: error.name, message: error.message },
    });
  }
});
