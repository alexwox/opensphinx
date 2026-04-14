import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "react/index": "src/react/index.ts",
    "engine/index": "src/engine/index.ts",
    "schemas/index": "src/schemas/index.ts"
  },
  clean: true,
  dts: true,
  format: ["esm"],
  outDir: "dist",
  platform: "neutral",
  sourcemap: true,
  splitting: false,
  target: "es2022",
  treeshake: true,
  external: ["ai", "react", "react-dom", "zod"]
});
