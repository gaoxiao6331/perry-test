import fs from "fs";
import path from "path";
import { NQueensSolver } from "./NQueens";

const argv = process.argv.slice(2);
let jsonOutput = false;
const positionalArgs: string[] = [];

for (const arg of argv) {
  if (arg === "--json") {
    jsonOutput = true;
  } else {
    positionalArgs.push(arg);
  }
}

const sizeArg = positionalArgs[0];
const maxSolutionsArgRaw = positionalArgs[1];
const outputDirArgRaw = positionalArgs[2];

if (!sizeArg) {
  console.error("Usage: node Main.js [--json] <board-size> [max-solutions] [output-dir]");
  process.exit(1);
}

const boardSize = Number(sizeArg);
if (!Number.isInteger(boardSize) || boardSize <= 0) {
  console.error(`Board size must be a positive integer. Received '${sizeArg}'.`);
  process.exit(1);
}

let maxSolutions: number | undefined;
let outputDirArg = outputDirArgRaw;

if (maxSolutionsArgRaw !== undefined) {
  const parsedMaxSolutions = Number(maxSolutionsArgRaw);
  if (Number.isInteger(parsedMaxSolutions) && parsedMaxSolutions > 0) {
    maxSolutions = parsedMaxSolutions;
  } else if (outputDirArg === undefined) {
    // Treat the third argument as the output directory when it is not a valid maxSolutions value.
    outputDirArg = maxSolutionsArgRaw;
  } else {
    console.error(
      `Max solutions must be a positive integer. Received '${maxSolutionsArgRaw}'.`
    );
    process.exit(1);
  }
}

if (outputDirArg && !jsonOutput) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(outputDir);
  if (files.length > 0) {
    console.error("Output directory is not empty");
    process.exit(1);
  }
}

const solver = new NQueensSolver();

const solveStart = process.hrtime.bigint();
const summary = solver.solve(boardSize, { maxSolutions, collectSolutions: false });
const solveEnd = process.hrtime.bigint();
const solveDurationMs = Number(solveEnd - solveStart) / 1_000_000;

const countStart = process.hrtime.bigint();
const totalSolutions = solver.count(boardSize);
const countEnd = process.hrtime.bigint();
const countDurationMs = Number(countEnd - countStart) / 1_000_000;

const resultPayload = {
  size: boardSize,
  enumeratedSolutions: summary.enumeratedSolutions,
  limitReached: summary.limitReached,
  maxSolutions: summary.maxSolutions,
  exploredStates: summary.exploredStates,
  totalSolutions,
  solveDurationMs,
  countDurationMs
};

function formatDuration(durationMs: number): string {
  if (durationMs >= 10_000) {
    return `${formatWithThousands(durationMs / 1000, 3)} s`;
  }

  return `${formatWithThousands(durationMs, 3)} ms`;
}

function formatWithThousands(value: number, fractionDigits: number): string {
  const fixed = value.toFixed(fractionDigits);
  const dotIndex = fixed.indexOf(".");
  if (dotIndex === -1) {
    return insertThousands(fixed);
  }

  const integerPart = fixed.slice(0, dotIndex);
  const fractionalPart = fixed.slice(dotIndex);
  return `${insertThousands(integerPart)}${fractionalPart}`;
}

function insertThousands(digits: string): string {
  const isNegative = digits.startsWith("-");
  const pureDigits = isNegative ? digits.slice(1) : digits;
  if (pureDigits.length <= 3) {
    return digits;
  }

  const parts: string[] = [];
  for (let i = pureDigits.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    parts.push(pureDigits.slice(start, i));
  }
  const grouped = parts.reverse().join(",");
  return isNegative ? `-${grouped}` : grouped;
}

if (jsonOutput) {
  console.log(JSON.stringify(resultPayload));
  process.exit(0);
}

const ESC = String.fromCharCode(0x1b);
console.log(`${ESC}[1;35mBoard size: ${boardSize}${ESC}[0m`);
console.log(`${ESC}[1;32mEnumerated solutions: ${summary.enumeratedSolutions}${ESC}[0m`);
console.log(`${ESC}[1;32mTotal solutions: ${totalSolutions}${ESC}[0m`);
console.log(`${ESC}[1;34mSolve time: ${formatDuration(solveDurationMs)}${ESC}[0m`);
console.log(`${ESC}[1;34mCount time: ${formatDuration(countDurationMs)}${ESC}[0m`);

if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const outputPath = path.join(outputDir, `n-queens_${boardSize}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(resultPayload, null, 2));
  console.log(`${ESC}[1;36mWrote summary to ${outputPath}${ESC}[0m`);
}
