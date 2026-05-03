#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";

const mode = process.argv[2] ?? "all"; // 支持 node/native/all 三种模式
const inputFile = process.env.INPUT_FILE ?? "./test-case/JsonParse.json"; // 测试输入
const outputRoot = process.env.OUTPUT_ROOT ?? ".test-output"; // 输出根目录
const nodeOutputArg = path.join(outputRoot, "nodejs");
const nativeOutputArg = path.join(outputRoot, "native");
const nodeOutputDir = path.resolve(nodeOutputArg);
const nativeOutputDir = path.resolve(nativeOutputArg);
const nativeBinary = path.resolve(process.env.NATIVE_BINARY ?? "./native/Main");

const customSuffix = `${inputFile}_custom.json`;
const builtinSuffix = `${inputFile}_native.json`;

const run = (cmd, args, options) =>
  execFileSync(cmd, args, { stdio: "inherit", ...options }); // 调用外部命令

const resetDir = (dir) => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}; // 清理再创建目录

const diffPair = (left, right) => {
  const diffArgs = ["diff", "--no-index", "--color=always", left, right];
  const env = { ...process.env, GIT_PAGER: "cat" };
  try {
    run("git", diffArgs, { env });
  } catch (error) {
    if (error.status === 1) {
      return; // 有差异时 git diff 已输出颜色内容
    }
    throw error;
  }
  // 无差异时手动输出绿色提示
  console.log(`\x1b[32mFiles match:\x1b[0m ${left} == ${right}`);
}; // 颜色差异输出，无差异也提示

const nodeMain = path.resolve("nodejs/json-parse/Main.js");

const buildNode = () => run("pnpm", ["build"]); // 构建 Node 版本

const runNode = () => {
  resetDir(nodeOutputDir);
  run("node", [nodeMain, inputFile, nodeOutputArg]); // 运行 Node 主程序
  diffPair(
    path.join(nodeOutputDir, customSuffix),
    path.join(nodeOutputDir, builtinSuffix)
  );
};

const buildNative = () => {
  mkdirSync(path.dirname(nativeBinary), { recursive: true });
  run("perry", ["compile", "./json-parse/Main.ts", "-o", nativeBinary]);
}; // 编译 Native 可执行文件

const runNative = () => {
  resetDir(nativeOutputDir);
  run(nativeBinary, [inputFile, nativeOutputArg]); // 运行 Native 程序
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
