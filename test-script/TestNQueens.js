#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const mode = process.argv[2] ?? "all";
const boardSizeEnv = process.env.BOARD_SIZE ?? "14";
const maxSolutionsEnv = process.env.MAX_SOLUTIONS;
const nativeBinary = path.resolve(process.env.NATIVE_BINARY ?? "./native/NQueens");
const nodeDisableJit = process.env.NODE_DISABLE_JIT === "1";

const boardSize = Number(boardSizeEnv);
if (!Number.isInteger(boardSize) || boardSize <= 0) {
  console.error(`BOARD_SIZE must be a positive integer. Received '${boardSizeEnv}'.`);
  process.exit(1);
}

let maxSolutions;
if (maxSolutionsEnv !== undefined) {
  const parsed = Number(maxSolutionsEnv);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`MAX_SOLUTIONS must be a positive integer when provided. Received '${maxSolutionsEnv}'.`);
    process.exit(1);
  }
  maxSolutions = parsed;
}

const nodeMain = path.resolve("nodejs/n-queens/Main.js");

const execInherit = (cmd, args) => {
  execFileSync(cmd, args, { stdio: "inherit" });
};

const execJson = (cmd, args) => {
  const output = execFileSync(cmd, args, { encoding: "utf-8" });
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Expected JSON output from ${cmd}`);
  }
  const jsonSegment = output.slice(start, end + 1);
  return JSON.parse(jsonSegment);
};

const buildNode = () => execInherit("pnpm", ["build"]);

const runNodeSolver = () => {
  const args = [nodeMain, "--json", String(boardSize)];
  if (maxSolutions !== undefined) {
    args.push(String(maxSolutions));
  }
  if (nodeDisableJit) {
    args.unshift("--jitless");
    console.log("\x1b[33mNode JIT disabled (--jitless)\x1b[0m");
  }
  return execJson("node", args);
};

const buildNative = () => {
  mkdirSync(path.dirname(nativeBinary), { recursive: true });
  execInherit("perry", ["compile", "./n-queens/Main.ts", "-o", nativeBinary]);
};

const runNativeSolver = () => {
  const args = [String(boardSize)];
  if (maxSolutions !== undefined) {
    args.push(String(maxSolutions));
  }
  args.push("--json");
  return execJson(nativeBinary, args);
};

const printResult = (label, result) => {
  console.log(`\n${label} result:`);
  console.log(JSON.stringify(result, null, 2));
};

const compareResults = (nodeResult, nativeResult) => {
  const fields = ["enumeratedSolutions", "totalSolutions", "limitReached", "exploredStates", "maxSolutions"];
  const mismatches = fields.filter((field) => {
    const nodeValue = nodeResult[field] ?? null;
    const nativeValue = nativeResult[field] ?? null;
    return nodeValue !== nativeValue;
  });

  if (mismatches.length === 0) {
    console.log("\x1b[32m✔ Node.js and native results match for all key fields.\x1b[0m");
  } else {
    console.log("\x1b[31m✖ Differences detected:\x1b[0m");
    for (const field of mismatches) {
      console.log(`  ${field}: node=${nodeResult[field]} native=${nativeResult[field]}`);
    }
  }

  console.log("\nTiming (ms):");
  console.log(
    `  Node.js   -> solve: ${nodeResult.solveDurationMs?.toFixed(3) ?? "n/a"}, count: ${nodeResult.countDurationMs?.toFixed(3) ?? "n/a"}`
  );
  console.log(
    `  Native    -> solve: ${nativeResult.solveDurationMs?.toFixed(3) ?? "n/a"}, count: ${nativeResult.countDurationMs?.toFixed(3) ?? "n/a"}`
  );
};

switch (mode) {
  case "node": {
    buildNode();
    const nodeResult = runNodeSolver();
    printResult("Node.js", nodeResult);
    break;
  }
  case "native": {
    buildNative();
    const nativeResult = runNativeSolver();
    printResult("Native", nativeResult);
    break;
  }
  case "all": {
    buildNode();
    const nodeResult = runNodeSolver();
    buildNative();
    const nativeResult = runNativeSolver();
    printResult("Node.js", nodeResult);
    printResult("Native", nativeResult);
    compareResults(nodeResult, nativeResult);
    break;
  }
  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
