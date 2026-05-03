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
const obj = jsonParser.parse(jsonText);

const cusPaserOutput = JSON.stringify(obj, null, 2);

const nativePaserOutput = JSON.stringify(JSON.parse(jsonText), null, 2);

// 写数据到文件
if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const customOutputPath = path.join(outputDir, fileArg + "_custom.json");
  fs.mkdirSync(path.dirname(customOutputPath), { recursive: true });
  fs.writeFileSync(customOutputPath, cusPaserOutput);

  // 写原生的数据到文件
  const nativeOutputPath = path.join(outputDir, fileArg + "_native.json");
  fs.mkdirSync(path.dirname(nativeOutputPath), { recursive: true });
  fs.writeFileSync(nativeOutputPath, nativePaserOutput);
}

