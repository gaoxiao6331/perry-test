#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const mode = process.argv[2] ?? "all";
const boardSizeEnv = process.env.BOARD_SIZE ?? "16";
const maxSolutionsEnv = process.env.MAX_SOLUTIONS;
const nativeBinary = path.resolve(process.env.NATIVE_BINARY ?? "./native/NQueens");
const goBinary = path.resolve(process.env.GO_BINARY ?? "./n-queens/bin/nqueens");
const cppBinary = path.resolve(process.env.CPP_BINARY ?? "./n-queens/bin/nqueens_cpp");
const rustBinary = path.resolve(process.env.RUST_BINARY ?? "./n-queens/bin/nqueens_rust");
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

const buildGo = () => {
  mkdirSync(path.dirname(goBinary), { recursive: true });
  execInherit("go", ["build", "-o", goBinary, "./n-queens/go"]);
};

const runGoSolver = () => {
  const args = ["--json", String(boardSize)];
  if (maxSolutions !== undefined) {
    args.push(String(maxSolutions));
  }
  return execJson(goBinary, args);
};

const buildCpp = () => {
  mkdirSync(path.dirname(cppBinary), { recursive: true });
  execInherit("clang++", [
    "-std=c++20",
    "-O3",
    "-DNDEBUG",
    "./n-queens/cpp/main.cpp",
    "-o",
    cppBinary,
  ]);
};

const runCppSolver = () => {
  const args = ["--json", String(boardSize)];
  if (maxSolutions !== undefined) {
    args.push(String(maxSolutions));
  }
  return execJson(cppBinary, args);
};

const buildRust = () => {
  execInherit("cargo", ["build", "--release", "-p", "nqueens"]);
  const builtPath = path.resolve("./target/release/nqueens");
  mkdirSync(path.dirname(rustBinary), { recursive: true });
  copyFileSync(builtPath, rustBinary);
};

const runRustSolver = () => {
  const args = ["--json", String(boardSize)];
  if (maxSolutions !== undefined) {
    args.push(String(maxSolutions));
  }
  return execJson(rustBinary, args);
};

const printResult = (label, result) => {
  console.log(`\n${label} result:`);
  console.log(JSON.stringify(result, null, 2));
};

const compareResults = (results) => {
  if (results.length < 2) return;

  const fields = ["enumeratedSolutions", "totalSolutions", "limitReached", "exploredStates", "maxSolutions"];
  const [baseline, ...others] = results;
  let hasMismatch = false;

  for (const current of others) {
    const mismatchedFields = fields.filter((field) => {
      const baseValue = baseline.result[field] ?? null;
      const currentValue = current.result[field] ?? null;
      return baseValue !== currentValue;
    });

    if (mismatchedFields.length === 0) {
      continue;
    }

    if (!hasMismatch) {
      console.log("\x1b[31m✖ Differences detected:\x1b[0m");
      hasMismatch = true;
    }

    console.log(`  vs ${current.label}:`);
    for (const field of mismatchedFields) {
      console.log(
        `    ${field}: ${baseline.label}=${baseline.result[field]} ${current.label}=${current.result[field]}`
      );
    }
  }

  if (!hasMismatch) {
    const labels = results.map(({ label }) => label).join(", ");
    console.log(`\x1b[32m✔ ${labels} results match for all key fields.\x1b[0m`);
  }

  console.log("\nTiming (ms):");
  for (const { label, result } of results) {
    console.log(
      `  ${label.padEnd(9)} -> solve: ${result.solveDurationMs?.toFixed(3) ?? "n/a"}, count: ${
        result.countDurationMs?.toFixed(3) ?? "n/a"
      }`
    );
  }
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
  case "go": {
    buildGo();
    const goResult = runGoSolver();
    printResult("Go", goResult);
    break;
  }
  case "cpp": {
    buildCpp();
    const cppResult = runCppSolver();
    printResult("C++", cppResult);
    break;
  }
  case "rust": {
    buildRust();
    const rustResult = runRustSolver();
    printResult("Rust", rustResult);
    break;
  }
  case "all": {
    buildNode();
    const nodeResult = runNodeSolver();
    buildNative();
    const nativeResult = runNativeSolver();
    buildGo();
    const goResult = runGoSolver();
    buildCpp();
    const cppResult = runCppSolver();
    buildRust();
    const rustResult = runRustSolver();
    printResult("Node.js", nodeResult);
    printResult("Native", nativeResult);
    printResult("Go", goResult);
    printResult("C++", cppResult);
    printResult("Rust", rustResult);
    compareResults([
      { label: "Node.js", result: nodeResult },
      { label: "Native", result: nativeResult },
      { label: "Go", result: goResult },
      { label: "C++", result: cppResult },
      { label: "Rust", result: rustResult },
    ]);
    break;
  }
  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
