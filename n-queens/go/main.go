package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type resultPayload struct {
	Size                int     `json:"size"`
	EnumeratedSolutions int     `json:"enumeratedSolutions"`
	LimitReached        bool    `json:"limitReached"`
	MaxSolutions        *int    `json:"maxSolutions,omitempty"`
	ExploredStates      int     `json:"exploredStates"`
	TotalSolutions      int     `json:"totalSolutions"`
	SolveDurationMs     float64 `json:"solveDurationMs"`
	CountDurationMs     float64 `json:"countDurationMs"`
}

type solveSummary struct {
	enumerated     int
	limitReached   bool
	exploredStates int
}

type searchState struct {
	enumerated    int
	limit         int
	limitIsFinite bool
	limitReached  bool
}

type solver struct {
	exploredStates int
}

func main() {
	jsonOutput := false
	var positional []string

	for _, arg := range os.Args[1:] {
		if arg == "--json" {
			jsonOutput = true
		} else {
			positional = append(positional, arg)
		}
	}

	if len(positional) == 0 {
		fmt.Fprintln(os.Stderr, "Usage: n-queens [--json] <board-size> [max-solutions] [output-dir]")
		os.Exit(1)
	}

	boardSize, err := strconv.Atoi(positional[0])
	if err != nil || boardSize <= 0 {
		fmt.Fprintf(os.Stderr, "Board size must be a positive integer. Received '%s'.\n", positional[0])
		os.Exit(1)
	}
	if boardSize > 32 {
		fmt.Fprintf(os.Stderr, "Board sizes above 32 are not supported (received %d).\n", boardSize)
		os.Exit(1)
	}

	var maxSolutions *int
	var outputDir string
	outputDirSet := false

	if len(positional) >= 3 {
		outputDir = positional[2]
		outputDirSet = true
	}

	if len(positional) >= 2 {
		candidate := positional[1]
		if parsed, err := strconv.Atoi(candidate); err == nil && parsed > 0 {
			maxSolutions = &parsed
		} else if !outputDirSet {
			outputDir = candidate
			outputDirSet = true
		} else {
			fmt.Fprintf(os.Stderr, "Max solutions must be a positive integer. Received '%s'.\n", candidate)
			os.Exit(1)
		}
	}

	if outputDirSet && !jsonOutput {
		absOutputDir, err := filepath.Abs(outputDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to resolve output directory: %v\n", err)
			os.Exit(1)
		}
		if err := os.MkdirAll(absOutputDir, 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create output directory: %v\n", err)
			os.Exit(1)
		}
		entries, err := os.ReadDir(absOutputDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to read output directory: %v\n", err)
			os.Exit(1)
		}
		if len(entries) > 0 {
			fmt.Fprintln(os.Stderr, "Output directory is not empty")
			os.Exit(1)
		}
		outputDir = absOutputDir
	}

	s := &solver{}
	maxSolutionsVal := maxSolutions

	solveStart := time.Now()
	summary := s.solve(boardSize, maxSolutions)
	solveDuration := time.Since(solveStart)

	countStart := time.Now()
	totalSolutions := s.count(boardSize)
	countDuration := time.Since(countStart)

	payload := resultPayload{
		Size:                boardSize,
		EnumeratedSolutions: summary.enumerated,
		LimitReached:        summary.limitReached,
		MaxSolutions:        maxSolutionsVal,
		ExploredStates:      summary.exploredStates,
		TotalSolutions:      totalSolutions,
		SolveDurationMs:     float64(solveDuration) / float64(time.Millisecond),
		CountDurationMs:     float64(countDuration) / float64(time.Millisecond),
	}

	if jsonOutput {
		encoded, err := json.Marshal(payload)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to encode JSON: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(string(encoded))
		return
	}

	esc := "\x1b"
	fmt.Printf("%s[1;35mBoard size: %d%s[0m\n", esc, boardSize, esc)
	fmt.Printf("%s[1;32mEnumerated solutions: %d%s[0m\n", esc, summary.enumerated, esc)
	fmt.Printf("%s[1;32mTotal solutions: %d%s[0m\n", esc, totalSolutions, esc)
	fmt.Printf("%s[1;34mSolve time: %.3f ms%s[0m\n", esc, payload.SolveDurationMs, esc)
	fmt.Printf("%s[1;34mCount time: %.3f ms%s[0m\n", esc, payload.CountDurationMs, esc)

	if outputDirSet {
		outputPath := filepath.Join(outputDir, fmt.Sprintf("n-queens_%d.json", boardSize))
		encoded, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to encode JSON: %v\n", err)
			os.Exit(1)
		}
		if err := os.WriteFile(outputPath, encoded, 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write JSON output: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("%s[1;36mWrote summary to %s%s[0m\n", esc, outputPath, esc)
	}
}

func (s *solver) solve(size int, maxSolutions *int) solveSummary {
	if maxSolutions != nil && *maxSolutions <= 0 {
		return solveSummary{}
	}

	limit := int(^uint(0) >> 1) // max int
	limitIsFinite := false
	if maxSolutions != nil {
		limit = *maxSolutions
		limitIsFinite = true
	}

	state := &searchState{limit: limit, limitIsFinite: limitIsFinite}
	columns := make([]bool, size)
	diagLeft := make([]bool, 2*size-1)
	diagRight := make([]bool, 2*size-1)
	s.exploredStates = 0

	s.search(size, 0, columns, diagLeft, diagRight, state)

	return solveSummary{
		enumerated:     state.enumerated,
		limitReached:   state.limitReached,
		exploredStates: s.exploredStates,
	}
}

func (s *solver) count(size int) int {
	columns := make([]bool, size)
	diagLeft := make([]bool, 2*size-1)
	diagRight := make([]bool, 2*size-1)
	return s.countSearch(size, 0, columns, diagLeft, diagRight)
}

func (s *solver) search(size, row int, columns, diagLeft, diagRight []bool, state *searchState) {
	if state.limitReached {
		return
	}

	if row == size {
		if state.limitIsFinite && state.enumerated >= state.limit {
			state.limitReached = true
			return
		}

		state.enumerated++
		if state.limitIsFinite && state.enumerated >= state.limit {
			state.limitReached = true
		}
		return
	}

	for column := 0; column < size; column++ {
		dl := row - column + size - 1
		dr := row + column
		if columns[column] || diagLeft[dl] || diagRight[dr] {
			continue
		}

		columns[column] = true
		diagLeft[dl] = true
		diagRight[dr] = true
		s.exploredStates++

		s.search(size, row+1, columns, diagLeft, diagRight, state)

		columns[column] = false
		diagLeft[dl] = false
		diagRight[dr] = false

		if state.limitReached {
			return
		}
	}
}

func (s *solver) countSearch(size, row int, columns, diagLeft, diagRight []bool) int {
	if row == size {
		return 1
	}

	total := 0
	for column := 0; column < size; column++ {
		dl := row - column + size - 1
		dr := row + column
		if columns[column] || diagLeft[dl] || diagRight[dr] {
			continue
		}

		columns[column] = true
		diagLeft[dl] = true
		diagRight[dr] = true
		total += s.countSearch(size, row+1, columns, diagLeft, diagRight)
		columns[column] = false
		diagLeft[dl] = false
		diagRight[dr] = false
	}

	return total
}
