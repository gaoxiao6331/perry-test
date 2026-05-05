# JSON Parser Benchmark

手写的 `JSONParser` 用于对比 Node.js (V8) 与 Perry 原生编译的性能与输出一致性。

## 运行

```bash
node ./test-script/DiffJsonOutput.js [mode]
```

- `node`：仅构建并运行 Node.js 版本
- `native`：仅编译并运行 Perry 原生版本
- `all`（默认）：依次执行两者并对比输出

示例：

```bash
node ./test-script/DiffJsonOutput.js all
```

## 环境变量

| 变量名 | 默认值 | 用途 |
| --- | --- | --- |
| `INPUT_FILE` | `./test-case/JsonParse.json` | 指定输入 JSON 文件 |
| `OUTPUT_ROOT` | `.test-output` | 存放输出目录 |
| `NATIVE_BINARY` | `./native/Main` | Perry 编译的可执行文件路径 |
| `NODE_DISABLE_JIT` | 未设置 | 设为 `1` 时 Node.js 运行追加 `--jitless`，禁用 V8 JIT |

示例：

```bash
INPUT_FILE=./test-case/large.json \
OUTPUT_ROOT=.bench-output \
NODE_DISABLE_JIT=1 \
node ./test-script/DiffJsonOutput.js node
```

## 输出

脚本会清理输出目录，并使用 `git diff --no-index` 给出彩色 diff；当输出一致时显示绿色 `Files match`。
