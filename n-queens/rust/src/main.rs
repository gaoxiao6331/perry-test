use serde::Serialize;
use std::env;
use std::error::Error;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;

#[derive(Serialize)]
struct ResultPayload {
    size: usize,
    enumeratedSolutions: usize,
    limitReached: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    maxSolutions: Option<usize>,
    exploredStates: usize,
    totalSolutions: usize,
    solveDurationMs: f64,
    countDurationMs: f64,
}

struct SolveSummary {
    enumerated: usize,
    limit_reached: bool,
    explored_states: usize,
}

struct SearchState {
    enumerated: usize,
    limit: Option<usize>,
    limit_reached: bool,
}

struct Solver {
    explored_states: usize,
}

impl Solver {
    fn solve(&mut self, size: usize, max_solutions: Option<usize>) -> SolveSummary {
        let mut state = SearchState {
            enumerated: 0,
            limit: max_solutions,
            limit_reached: false,
        };
        let mut columns = vec![false; size];
        let mut diag_left = vec![false; 2 * size - 1];
        let mut diag_right = vec![false; 2 * size - 1];
        self.explored_states = 0;

        self.search(size, 0, &mut columns, &mut diag_left, &mut diag_right, &mut state);

        SolveSummary {
            enumerated: state.enumerated,
            limit_reached: state.limit_reached,
            explored_states: self.explored_states,
        }
    }

    fn count(&self, size: usize) -> usize {
        let mut columns = vec![false; size];
        let mut diag_left = vec![false; 2 * size - 1];
        let mut diag_right = vec![false; 2 * size - 1];
        Self::count_search(size, 0, &mut columns, &mut diag_left, &mut diag_right)
    }

    fn search(
        &mut self,
        size: usize,
        row: usize,
        columns: &mut [bool],
        diag_left: &mut [bool],
        diag_right: &mut [bool],
        state: &mut SearchState,
    ) {
        if state.limit_reached {
            return;
        }

        if row == size {
            if let Some(limit) = state.limit {
                if state.enumerated >= limit {
                    state.limit_reached = true;
                    return;
                }
            }
            state.enumerated += 1;
            if let Some(limit) = state.limit {
                if state.enumerated >= limit {
                    state.limit_reached = true;
                }
            }
            return;
        }

        for column in 0..size {
            let dl = row as isize - column as isize + size as isize - 1;
            let dr = row + column;
            let (dl_idx, dr_idx) = (dl as usize, dr);

            if columns[column] || diag_left[dl_idx] || diag_right[dr_idx] {
                continue;
            }

            columns[column] = true;
            diag_left[dl_idx] = true;
            diag_right[dr_idx] = true;
            self.explored_states += 1;

            self.search(size, row + 1, columns, diag_left, diag_right, state);

            columns[column] = false;
            diag_left[dl_idx] = false;
            diag_right[dr_idx] = false;

            if state.limit_reached {
                return;
            }
        }
    }

    fn count_search(
        size: usize,
        row: usize,
        columns: &mut [bool],
        diag_left: &mut [bool],
        diag_right: &mut [bool],
    ) -> usize {
        if row == size {
            return 1;
        }

        let mut total = 0;
        for column in 0..size {
            let dl = row as isize - column as isize + size as isize - 1;
            let dr = row + column;
            let (dl_idx, dr_idx) = (dl as usize, dr);

            if columns[column] || diag_left[dl_idx] || diag_right[dr_idx] {
                continue;
            }

            columns[column] = true;
            diag_left[dl_idx] = true;
            diag_right[dr_idx] = true;
            total += Self::count_search(size, row + 1, columns, diag_left, diag_right);
            columns[column] = false;
            diag_left[dl_idx] = false;
            diag_right[dr_idx] = false;
        }

        total
    }
}

struct ParsedArguments {
    board_size: usize,
    max_solutions: Option<usize>,
    output_dir: Option<PathBuf>,
    json_output: bool,
}

fn parse_arguments<I, T>(args: I) -> Result<ParsedArguments, Box<dyn Error>>
where
    I: IntoIterator<Item = T>,
    T: Into<String>,
{
    let mut json_output = false;
    let mut positional = Vec::new();

    for arg in args.into_iter().skip(1) {
        let arg_str = arg.into();
        if arg_str == "--json" {
            json_output = true;
        } else {
            positional.push(arg_str);
        }
    }

    if positional.is_empty() {
        return Err("Usage: n-queens [--json] <board-size> [max-solutions] [output-dir]".into());
    }

    let board_size: usize = positional[0]
        .parse()
        .map_err(|_| "Board size must be a positive integer.")?;
    if board_size == 0 {
        return Err("Board size must be a positive integer.".into());
    }
    if board_size > 32 {
        return Err("Board sizes above 32 are not supported.".into());
    }

    let mut max_solutions = None;
    let mut output_dir: Option<PathBuf> = None;

    if positional.len() >= 2 {
        let candidate = &positional[1];
        if let Ok(parsed) = candidate.parse::<usize>() {
            if parsed == 0 {
                return Err("Max solutions must be a positive integer.".into());
            }
            max_solutions = Some(parsed);
        } else {
            output_dir = Some(PathBuf::from(candidate));
        }
    }

    if positional.len() >= 3 {
        output_dir = Some(PathBuf::from(&positional[2]));
    }

    Ok(ParsedArguments {
        board_size,
        max_solutions,
        output_dir,
        json_output,
    })
}

fn ensure_output_directory(path: &Path) -> Result<PathBuf, Box<dyn Error>> {
    let abs = fs::canonicalize(path).or_else(|_| {
        fs::create_dir_all(path)?;
        fs::canonicalize(path)
    })?;

    if abs.read_dir()?.next().is_some() {
        return Err("Output directory is not empty.".into());
    }

    Ok(abs)
}

fn write_json_file(dir: &Path, size: usize, payload: &ResultPayload) -> Result<(), Box<dyn Error>> {
    let filename = format!("n-queens_{}.json", size);
    let path = dir.join(filename);
    let mut file = fs::File::create(&path)?;
    serde_json::to_writer_pretty(&mut file, payload)?;
    writeln!(io::stdout(), "\u{1b}[1;36mWrote summary to {}\u{1b}[0m", path.display())?;
    Ok(())
}

fn render_cli_output(payload: &ResultPayload) {
    let esc = "\u{1b}";
    println!("{esc}[1;35mBoard size: {}{esc}[0m", payload.size);
    println!("{esc}[1;32mEnumerated solutions: {}{esc}[0m", payload.enumeratedSolutions);
    println!("{esc}[1;32mTotal solutions: {}{esc}[0m", payload.totalSolutions);
    println!(
        "{esc}[1;34mSolve time: {}{esc}[0m",
        format_duration(payload.solveDurationMs)
    );
    println!(
        "{esc}[1;34mCount time: {}{esc}[0m",
        format_duration(payload.countDurationMs)
    );
}

fn format_duration(duration_ms: f64) -> String {
    if duration_ms >= 10_000.0 {
        return format!("{} s", format_with_thousands(duration_ms / 1000.0));
    }
    format!("{} ms", format_with_thousands(duration_ms))
}

fn format_with_thousands(value: f64) -> String {
    let formatted = format!("{:.3}", value);
    match formatted.split_once('.') {
        Some((int_part, frac_part)) => format!("{}.{frac_part}", insert_thousands(int_part)),
        None => insert_thousands(&formatted),
    }
}

fn insert_thousands(value: &str) -> String {
    let mut result = String::with_capacity(value.len() + value.len() / 3);
    let mut chars = value.chars().filter(|c| *c != ',').collect::<Vec<_>>();
    if chars.first() == Some(&'-') {
        result.push('-');
        chars.remove(0);
    }
    let len = chars.len();
    if len <= 3 {
        result.extend(chars);
        return result;
    }
    let rem = len % 3;
    let mut index = 0;
    if rem != 0 {
        result.extend(&chars[index..index + rem]);
        index += rem;
        if index < len {
            result.push(',');
        }
    }
    while index < len {
        if index > rem {
            result.push(',');
        }
        result.extend(&chars[index..index + 3]);
        index += 3;
    }
    result
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut solver = Solver { explored_states: 0 };
    let mut args = parse_arguments(env::args())?;

    if let Some(ref dir) = args.output_dir {
        if !args.json_output {
            let normalized = ensure_output_directory(dir)?;
            args.output_dir = Some(normalized);
        }
    }

    let solve_start = Instant::now();
    let summary = solver.solve(args.board_size, args.max_solutions);
    let solve_duration = solve_start.elapsed();

    let count_start = Instant::now();
    let total_solutions = solver.count(args.board_size);
    let count_duration = count_start.elapsed();

    let payload = ResultPayload {
        size: args.board_size,
        enumeratedSolutions: summary.enumerated,
        limitReached: summary.limit_reached,
        maxSolutions: args.max_solutions,
        exploredStates: summary.explored_states,
        totalSolutions: total_solutions,
        solveDurationMs: solve_duration.as_secs_f64() * 1000.0,
        countDurationMs: count_duration.as_secs_f64() * 1000.0,
    };

    if args.json_output {
        serde_json::to_writer(io::stdout(), &payload)?;
        println!();
    } else {
        render_cli_output(&payload);
        if let Some(dir) = args.output_dir {
            write_json_file(&dir, args.board_size, &payload)?;
        }
    }

    Ok(())
}
