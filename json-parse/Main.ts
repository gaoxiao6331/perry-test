import fs from "fs";
import path from "path";
import { JSONParser } from "./JsonParse";

const fileArg = process.argv[2];

const outputDirArg = process.argv[3];

// 解析路径，如果没有这个目录则创建
if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

// 如果这个目录不为空则报错
if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const files = fs.readdirSync(outputDir);
  if (files.length > 0) {
    console.error("Output directory is not empty");
    process.exit(1);
  }
}

// 从命令行参数获取文件路径

if (!fileArg) {
  console.error("Usage: node test.js <json-file-path>");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileArg);

// 读取文件
const jsonParser = new JSONParser();
const jsonText = fs.readFileSync(filePath, "utf-8");

// 解析
const parseStart = process.hrtime.bigint();
const parsedValue = jsonParser.parse(jsonText);
const parseEnd = process.hrtime.bigint();
const parseDurationMs = Number(parseEnd - parseStart) / 1_000_000;

const parseTimeMessage = `Parse time: ${parseDurationMs.toFixed(3)} ms`;
const stdout = process.stdout;
stdout.write(Buffer.from([0x1b, 0x5b, 0x31, 0x3b, 0x33, 0x35, 0x6d])); // ESC[1;35m
stdout.write(Buffer.from(parseTimeMessage));
stdout.write(Buffer.from([0x1b, 0x5b, 0x30, 0x6d, 0x0a])); // ESC[0m + newline

const customOutputJson = JSON.stringify(parsedValue, null, 2);

const builtinOutputJson = JSON.stringify(JSON.parse(jsonText), null, 2);

// 写数据到文件
if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const customOutputPath = path.join(outputDir, fileArg + "_custom.json");
  fs.mkdirSync(path.dirname(customOutputPath), { recursive: true });
  fs.writeFileSync(customOutputPath, customOutputJson);

  // 写原生的数据到文件
  const nativeOutputPath = path.join(outputDir, fileArg + "_builtin.json");
  fs.mkdirSync(path.dirname(nativeOutputPath), { recursive: true });
  fs.writeFileSync(nativeOutputPath, builtinOutputJson);
}

