import fs from "fs";
import path from "path";
import { JSONParser } from "./JsonParse";

const fileArg = process.argv[2];
process.stderr.write(`[Main] argv=${JSON.stringify(process.argv)}\n`);

// 从命令行参数获取文件路径

if (!fileArg) {
  console.error("Usage: node test.js <json-file-path>");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileArg);
process.stderr.write(`[Main] loading file ${filePath}\n`);

// 读取文件
const jsonParser = new JSONParser(true);
process.stderr.write(`[Main] parser created\n`);
const jsonText = fs.readFileSync(filePath, "utf-8");
process.stderr.write(`[Main] file loaded, length=${jsonText.length}\n`);

// 解析
const obj = jsonParser.parse(jsonText);
process.stderr.write(`[Main] parse complete\n`);

const output = JSON.stringify(obj, null, 2);
process.stderr.write(`[Main] output length=${output.length}\n`);
process.stdout.write(output + "\n");