import fs from "fs";
import path from "path";
import { defineConfig } from "tsup";

const ROOT = __dirname;
const EXCLUDED_DIRS = new Set(["node_modules", "dist", "nodejs"]);
const EXCLUDED_FILE_PATTERNS = [
  /\.d\.ts$/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /^tsup\.config\.ts$/
];

// Collect entry points dynamically so every directory under the repo root becomes a matching
// bundle inside nodejs/, e.g. "json-parse/JsonParse.ts" -> "nodejs/json-parse/JsonParse.js".
const entry = collectEntryPoints();

export default defineConfig({
  entry,
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2020",
  splitting: false,
  treeshake: true,
  outDir: "nodejs",
  ignoreWatch: ["dist", "nodejs", "node_modules", "**/*.d.ts"]
});

// Walk the project tree to build a { "relative/path": "relative/path.ts" } map for tsup.
// The map keys keep the original folder names, which instructs tsup to mirror the structure
// when writing build artifacts.
function collectEntryPoints(startDir: string = ROOT) {
  const entries: Record<string, string> = {};
  const stack = [startDir];

  while (stack.length) {
    const currentDir = stack.pop()!;
    const items = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const item of items) {
      const absPath = path.join(currentDir, item.name);
      const relPath = path.relative(ROOT, absPath);
      const posixRelPath = relPath.split(path.sep).join("/");

      if (item.isDirectory()) {
        if (!EXCLUDED_DIRS.has(item.name)) {
          stack.push(absPath);
        }
        continue;
      }

      if (!posixRelPath.endsWith(".ts")) continue;
      if (EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(posixRelPath))) continue;

      // Use the relative file path (minus extension) as the entry key so the output filename
      // carries the same nested directory structure under nodejs/.
      const entryName = posixRelPath.replace(/\.ts$/, "");
      entries[entryName] = posixRelPath;
    }
  }

  return entries;
}