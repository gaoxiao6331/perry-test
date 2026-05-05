import fs from "fs";
import path from "path";
import { JSONParser } from "./JsonParse";

const fileArg = process.argv[2];

const outputDirArg = process.argv[3];

// Create the output directory when it does not exist
if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

// Abort if the output directory already contains files
if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const files = fs.readdirSync(outputDir);
  if (files.length > 0) {
    console.error("Output directory is not empty");
    process.exit(1);
  }
}

// Parse the input JSON path from CLI arguments

if (!fileArg) {
  console.error("Usage: node test.js <json-file-path>");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileArg);

// Read the input file into memory
const jsonParser = new JSONParser();
const jsonText = fs.readFileSync(filePath, "utf-8");

// Parse with the custom JSON parser
const customParseStart = process.hrtime.bigint();
const customParsedValue = jsonParser.parse(jsonText);
const customParseEnd = process.hrtime.bigint();
const customParseDurationMs = Number(customParseEnd - customParseStart) / 1_000_000;

// Parse with the native JSON.parse implementation
const nativeParseStart = process.hrtime.bigint();
const nativeParsedValue = JSON.parse(jsonText);
const nativeParseEnd = process.hrtime.bigint();
const nativeParseDurationMs = Number(nativeParseEnd - nativeParseStart) / 1_000_000;

const ESC = String.fromCharCode(0x1b);
console.log(`${ESC}[1;35mCustom parse time: ${customParseDurationMs.toFixed(3)} ms${ESC}[0m`);
console.log(`${ESC}[1;34mBuiltin parse time: ${nativeParseDurationMs.toFixed(3)} ms${ESC}[0m`);

const customOutputJson = JSON.stringify(customParsedValue, null, 2);

const builtinOutputJson = JSON.stringify(nativeParsedValue, null, 2);

// Persist parser outputs to disk
if (outputDirArg) {
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const customOutputPath = path.join(outputDir, fileArg + "_custom.json");
  fs.mkdirSync(path.dirname(customOutputPath), { recursive: true });
  fs.writeFileSync(customOutputPath, customOutputJson);

  // Write the native parser output to disk
  const nativeOutputPath = path.join(outputDir, fileArg + "_builtin.json");
  fs.mkdirSync(path.dirname(nativeOutputPath), { recursive: true });
  fs.writeFileSync(nativeOutputPath, builtinOutputJson);
}

