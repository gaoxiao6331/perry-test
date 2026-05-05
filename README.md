# Perry TypeScript Native Experiments

This repository experiments with compiling TypeScript directly into native binaries using [Perry](https://www.perryts.com/en/blog/).

Current test cases:

- JSON parser: custom JsonParser benchmarked against Node.js (V8 JIT enabled) and the Perry native binary – see [`doc/json-parse.md`](./doc/json-parse.md).
- N-Queens solver: bitset-based backtracking with diff tooling to compare Node.js, Perry native, and Go outputs – see [`doc/NQueens.md`](./doc/NQueens.md).