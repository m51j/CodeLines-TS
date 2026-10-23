import { defineConfig } from "vite";
export default defineConfig({
  root: "src/renderer",
  base: "./",
  build: { outDir: "../../dist/renderer", emptyOutDir: true },
  plugins: [
    {
      // The dev server's hot-reload socket is not needed in production builds.
      name: "production-csp",
      apply: "build",
      transformIndexHtml: (html) => html.replace(" ws://127.0.0.1:5173", ""),
    },
  ],
});
