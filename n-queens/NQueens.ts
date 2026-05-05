type LogFunction = (message: string) => void;

export interface NQueensSolution {
  /** Zero-based column indexes for each queen, indexed by row. */
  columns: number[];
  /** Board rendered as human-readable strings. */
  board: string[];
}

export interface NQueensSolveSummary {
  size: number;
  enumeratedSolutions: number;
  limitReached: boolean;
  maxSolutions?: number;
  solutions: NQueensSolution[];
  exploredStates: number;
}

export interface NQueensSolverOptions {
  debug?: boolean;
  logInterval?: number;
  log?: LogFunction;
}

export interface NQueensSolveOptions {
  maxSolutions?: number;
  onSolution?: (solution: NQueensSolution, index: number, totalExplored: number) => void;
  collectSolutions?: boolean;
}

interface SearchState {
  enumerated: number;
  limitReached: boolean;
}

export class NQueensSolver {
  private readonly debugEnabled: boolean;
  private readonly logInterval: number;
  private readonly logFn: LogFunction | null;
  private exploredStates = 0;
  private lastLoggedState = -1;

  constructor(options: NQueensSolverOptions = {}) {
    this.debugEnabled = !!options.debug;
    this.logInterval = Math.max(1, options.logInterval ?? 100_000);
    this.logFn = this.debugEnabled
      ? options.log ?? ((message) => console.error(message))
      : null;
  }

  solve(size: number, options: NQueensSolveOptions = {}): NQueensSolveSummary {
    this.validateSize(size);

    const limit = options.maxSolutions ?? Number.POSITIVE_INFINITY;
    if (limit <= 0) {
      return {
        size,
        enumeratedSolutions: 0,
        limitReached: false,
        maxSolutions: options.maxSolutions,
        solutions: [],
        exploredStates: 0
      };
    }

    const collectSolutions = options.collectSolutions ?? true;
    const placements: number[] = [];
    const solutions: NQueensSolution[] = [];
    const state: SearchState = { enumerated: 0, limitReached: false };
    const columns = new Uint8Array(size);
    const diagLeft = new Uint8Array(2 * size - 1);
    const diagRight = new Uint8Array(2 * size - 1);
    this.exploredStates = 0;
    this.lastLoggedState = -1;

    this.search(
      size,
      0,
      columns,
      diagLeft,
      diagRight,
      placements,
      solutions,
      limit,
      collectSolutions,
      state,
      options
    );

    return {
      size,
      enumeratedSolutions: state.enumerated,
      limitReached: state.limitReached,
      maxSolutions: Number.isFinite(limit) ? options.maxSolutions : undefined,
      solutions: collectSolutions ? solutions : [],
      exploredStates: this.exploredStates,
    };
  }

  count(size: number): number {
    this.validateSize(size);

    const columns = new Uint8Array(size);
    const diagLeft = new Uint8Array(2 * size - 1);
    const diagRight = new Uint8Array(2 * size - 1);
    this.exploredStates = 0;
    this.lastLoggedState = -1;

    return this.countSearch(size, 0, columns, diagLeft, diagRight);
  }

  private search(
    size: number,
    row: number,
    columns: Uint8Array,
    diagLeft: Uint8Array,
    diagRight: Uint8Array,
    placements: number[],
    solutions: NQueensSolution[],
    limit: number,
    collectSolutions: boolean,
    state: SearchState,
    options: NQueensSolveOptions
  ) {
    if (state.limitReached) {
      return;
    }

    if (row === size) {
      if (state.enumerated >= limit) {
        state.limitReached = true;
        return;
      }

      const solutionIndex = state.enumerated;
      state.enumerated += 1;

      const withinLimit = solutionIndex < limit;
      const shouldEmit = withinLimit && (collectSolutions || typeof options.onSolution === "function");

      if (shouldEmit) {
        const solution: NQueensSolution = {
          columns: [...placements],
          board: this.renderBoard(size, placements),
        };

        if (collectSolutions) {
          solutions.push(solution);
          options.onSolution?.(solution, solutions.length - 1, this.exploredStates);
        } else {
          options.onSolution?.(solution, solutionIndex, this.exploredStates);
        }
      }

      this.log(`solution:found:${state.enumerated}`);

      if (state.enumerated >= limit && Number.isFinite(limit)) {
        state.limitReached = true;
      }

      return;
    }

    for (let column = 0; column < size; column++) {
      const diagLeftIndex = row - column + size - 1;
      const diagRightIndex = row + column;
      if (columns[column] || diagLeft[diagLeftIndex] || diagRight[diagRightIndex]) {
        continue;
      }

      placements.push(column);
      columns[column] = 1;
      diagLeft[diagLeftIndex] = 1;
      diagRight[diagRightIndex] = 1;
      this.exploredStates++;
      this.maybeLog(row, column);

      this.search(
        size,
        row + 1,
        columns,
        diagLeft,
        diagRight,
        placements,
        solutions,
        limit,
        collectSolutions,
        state,
        options
      );

      placements.pop();
      columns[column] = 0;
      diagLeft[diagLeftIndex] = 0;
      diagRight[diagRightIndex] = 0;

      if (state.limitReached) {
        return;
      }
    }
  }

  private countSearch(
    size: number,
    row: number,
    columns: Uint8Array,
    diagLeft: Uint8Array,
    diagRight: Uint8Array
  ): number {
    if (row === size) {
      return 1;
    }

    let total = 0;

    for (let column = 0; column < size; column++) {
      const diagLeftIndex = row - column + size - 1;
      const diagRightIndex = row + column;
      if (columns[column] || diagLeft[diagLeftIndex] || diagRight[diagRightIndex]) {
        continue;
      }

      columns[column] = 1;
      diagLeft[diagLeftIndex] = 1;
      diagRight[diagRightIndex] = 1;
      this.exploredStates++;

      total += this.countSearch(size, row + 1, columns, diagLeft, diagRight);

      columns[column] = 0;
      diagLeft[diagLeftIndex] = 0;
      diagRight[diagRightIndex] = 0;
    }

    return total;
  }

  private renderBoard(size: number, placements: number[]): string[] {
    return placements.map((column) => {
      let row = "";
      for (let c = 0; c < size; c++) {
        row += c === column ? "Q" : ".";
      }
      return row;
    });
  }

  private maybeLog(row: number, column: number) {
    if (!this.debugEnabled) return;
    if (this.exploredStates - this.lastLoggedState < this.logInterval) {
      return;
    }
    this.lastLoggedState = this.exploredStates;
    this.log(`search:row=${row}:column=${column}:explored=${this.exploredStates}`);
  }

  private log(message: string) {
    if (!this.debugEnabled) return;
    this.logFn?.(message);
  }

  private validateSize(size: number) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error(`Board size must be a positive integer. Received: ${size}`);
    }
    if (size > 32) {
      throw new Error(
        `Board sizes above 32 are not supported due to JavaScript bitset limitations (received ${size}).`
      );
    }
  }
}
