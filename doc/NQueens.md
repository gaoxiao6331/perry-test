# N-Queens Solver Benchmark

The `NQueensSolver` explores the backtracking search space for the classic N-Queens problem using backtracking with array-based occupancy tracking. The CLI mirrors the JSON parser layout so both Node.js and Perry native binaries can be compared with identical arguments and outputs.

## How to run

```bash
node ./test-script/TestNQueens.js [mode]
```

- `node`: build the TypeScript bundles and execute the Node.js variant only
- `native`: compile and execute the Perry native binary only
- `go`: compile and execute the Go implementation only
- `all` (default): run every target and compare their JSON outputs

Example:

```bash
BOARD_SIZE=12 MAX_SOLUTIONS=20 node ./test-script/TestNQueens.js all
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `BOARD_SIZE` | `8` | Size of the chessboard (also sets the number of queens) |
| `MAX_SOLUTIONS` | unset | Upper bound for the number of solutions to enumerate; leave unset to enumerate every solution |
| `OUTPUT_ROOT` | `.test-output` | Root directory for generated outputs (per target) |
| `NATIVE_BINARY` | `./native/NQueens` | Output path for the Perry-compiled binary |
| `GO_BINARY` | `./n-queens/bin/nqueens` | Output path for the Go binary |
| `NODE_DISABLE_JIT` | unset | When set to `1`, adds `--jitless` to the Node.js invocation to disable the V8 JIT |

## Output

Each run writes a JSON summary that includes:

- `enumeratedSolutions`: number of solutions found during the enumerating pass (bounded by `MAX_SOLUTIONS`)
- `limitReached`: whether the enumeration stopped early due to the configured limit
- `maxSolutions`: the applied limit (if any)
- `totalSolutions`: number of solutions found during the separate counting pass
- `exploredStates`: total nodes explored while enumerating solutions
- `solveDurationMs` / `countDurationMs`: timing information for enumeration and counting

Running with `mode=all` diffs the Node.js, Perry native, and Go JSON outputs, surfacing any discrepancies in the solver implementation or runtime behavior.
