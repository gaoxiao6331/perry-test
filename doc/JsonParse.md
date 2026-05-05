# JSON Parser Benchmark

The handcrafted `JSONParser` is used to compare performance and output fidelity between Node.js (V8) and Perry's native compilation.

## How to run

```bash
node ./test-script/DiffJsonOutput.js [mode]
```

- `node`: build and execute the Node.js variant only
- `native`: compile and execute the Perry native binary only
- `all` (default): run both targets and compare their outputs

Example:

```bash
node ./test-script/DiffJsonOutput.js all
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `INPUT_FILE` | `./test-case/JsonParse.json` | Select the input JSON file |
| `OUTPUT_ROOT` | `.test-output` | Root directory for generated outputs |
| `NATIVE_BINARY` | `./native/Main` | Output path for the Perry-compiled binary |
| `NODE_DISABLE_JIT` | unset | When set to `1`, adds `--jitless` to the Node.js invocation to disable the V8 JIT |

Example:

```bash
INPUT_FILE=./test-case/large.json \
OUTPUT_ROOT=.bench-output \
NODE_DISABLE_JIT=1 \
node ./test-script/DiffJsonOutput.js node
```

## Output

The script rebuilds the output directories and uses `git diff --no-index` for colored diffs; when outputs match it prints a green `Files match` message.
