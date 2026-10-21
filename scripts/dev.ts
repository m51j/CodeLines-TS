import { spawn } from "node:child_process";
import { createServer } from "vite";
import electron from "electron";
await import("./build");
const server = await createServer({
  server: { port: 5173, strictPort: true, host: "127.0.0.1" },
});
await server.listen();
const child = spawn(electron as unknown as string, ["."], {
  stdio: "inherit",
  env: { ...process.env, CODELINES_DEV_URL: "http://127.0.0.1:5173" },
});
child.on("exit", async () => {
  await server.close();
  process.exit(0);
});
