#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";

const mode = process.argv[2] ?? "all"; // Supports node/native/all modes
const inputFile = process.env.INPUT_FILE ?? "./test-case/JsonParse.json"; // Input fixture
const outputRoot = process.env.OUTPUT_ROOT ?? ".test-output"; // Output root directory
const nodeOutputArg = path.join(outputRoot, "nodejs");
const nativeOutputArg = path.join(outputRoot, "native");
const nodeOutputDir = path.resolve(nodeOutputArg);
const nativeOutputDir = path.resolve(nativeOutputArg);
const nativeBinary = path.resolve(process.env.NATIVE_BINARY ?? "./native/Main");
const nodeDisableJit = process.env.NODE_DISABLE_JIT === "1";

const customSuffix = `${inputFile}_custom.json`;
const builtinSuffix = `${inputFile}_builtin.json`;

const run = (cmd, args, options) =>
  execFileSync(cmd, args, { stdio: "inherit", ...options }); // Invoke external command

const resetDir = (dir) => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}; // Recreate the target directory from scratch

const diffPair = (left, right) => {
  const diffArgs = ["diff", "--no-index", "--color=always", left, right];
  const env = { ...process.env, GIT_PAGER: "cat" };
  try {
    run("git", diffArgs, { env });
  } catch (error) {
    if (error.status === 1) {
      return; // git diff already printed colored output when there are changes
    }
    throw error;
  }
  // Emit a green message when the files match
  console.log(`\x1b[32mFiles match:\x1b[0m ${left} == ${right}`);
}; // Provide colored diff and success hints

const nodeMain = path.resolve("nodejs/json-parse/Main.js");

const buildNode = () => run("pnpm", ["build"]); // Build the Node.js artifacts

const runNode = () => {
  resetDir(nodeOutputDir);
  const nodeArgs = [nodeMain, inputFile, nodeOutputArg];
  if (nodeDisableJit) {
    nodeArgs.unshift("--jitless");
    console.log("\x1b[33mNode JIT disabled (--jitless)\x1b[0m");
  }
  run("node", nodeArgs, {
    env: { ...process.env, FORCE_COLOR: "1" }
  }); // Execute the Node.js entry point
  diffPair(
    path.join(nodeOutputDir, customSuffix),
    path.join(nodeOutputDir, builtinSuffix)
  );
};

const buildNative = () => {
  mkdirSync(path.dirname(nativeBinary), { recursive: true });
  run("perry", ["compile", "./json-parse/Main.ts", "-o", nativeBinary]);
}; // Compile the native executable via Perry

const runNative = () => {
  resetDir(nativeOutputDir);
  run(nativeBinary, [inputFile, nativeOutputArg], {
    env: { ...process.env, FORCE_COLOR: "1" }
  }); // Execute the native binary
  diffPair(
    path.join(nativeOutputDir, customSuffix),
    path.join(nativeOutputDir, builtinSuffix)
  );
};

const diffAcrossEnvs = (suffix) =>
  diffPair(
    path.join(nodeOutputDir, suffix),
    path.join(nativeOutputDir, suffix)
  );

switch (mode) {
  case "node":
    buildNode();
    runNode();
    break;
  case "native":
    buildNative();
    runNative();
    break;
  case "all":
    buildNode();
    runNode();
    buildNative();
    runNative();
    diffAcrossEnvs(customSuffix);
    diffAcrossEnvs(builtinSuffix);
    break;
  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
