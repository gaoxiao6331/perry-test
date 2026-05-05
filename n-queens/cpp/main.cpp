#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace fs = std::filesystem;

struct ResultPayload {
  int size;
  int enumeratedSolutions;
  bool limitReached;
  std::optional<int> maxSolutions;
  int exploredStates;
  int totalSolutions;
  double solveDurationMs;
  double countDurationMs;
};

struct SolveSummary {
  int enumeratedSolutions;
  bool limitReached;
  int exploredStates;
};

struct SearchState {
  int enumerated = 0;
  bool limitReached = false;
  std::optional<int> limit;
};

class NQueensSolver {
 public:
  SolveSummary solve(int size, std::optional<int> maxSolutions) {
    validateSize(size);
    SearchState state;
    state.limit = maxSolutions;

    std::vector<uint8_t> columns(size, 0);
    std::vector<uint8_t> diagLeft(2 * size - 1, 0);
    std::vector<uint8_t> diagRight(2 * size - 1, 0);
    exploredStates_ = 0;

    search(size, 0, columns, diagLeft, diagRight, state);

    return SolveSummary{
        .enumeratedSolutions = state.enumerated,
        .limitReached = state.limitReached,
        .exploredStates = exploredStates_,
    };
  }

  int count(int size) {
    validateSize(size);
    std::vector<uint8_t> columns(size, 0);
    std::vector<uint8_t> diagLeft(2 * size - 1, 0);
    std::vector<uint8_t> diagRight(2 * size - 1, 0);
    return countSearch(size, 0, columns, diagLeft, diagRight);
  }

 private:
  void validateSize(int size) {
    if (size <= 0) {
      throw std::invalid_argument("Board size must be a positive integer.");
    }
    if (size > 32) {
      throw std::invalid_argument("Board sizes above 32 are not supported.");
    }
  }

  void search(int size, int row, std::vector<uint8_t>& columns, std::vector<uint8_t>& diagLeft,
              std::vector<uint8_t>& diagRight, SearchState& state) {
    if (state.limitReached) {
      return;
    }

    if (row == size) {
      if (state.limit.has_value() && state.enumerated >= *state.limit) {
        state.limitReached = true;
        return;
      }

      state.enumerated += 1;
      if (state.limit.has_value() && state.enumerated >= *state.limit) {
        state.limitReached = true;
      }
      return;
    }

    for (int column = 0; column < size; ++column) {
      int diagLeftIndex = row - column + size - 1;
      int diagRightIndex = row + column;

      if (columns[column] || diagLeft[diagLeftIndex] || diagRight[diagRightIndex]) {
        continue;
      }

      columns[column] = 1;
      diagLeft[diagLeftIndex] = 1;
      diagRight[diagRightIndex] = 1;
      exploredStates_++;

      search(size, row + 1, columns, diagLeft, diagRight, state);

      columns[column] = 0;
      diagLeft[diagLeftIndex] = 0;
      diagRight[diagRightIndex] = 0;

      if (state.limitReached) {
        return;
      }
    }
  }

  int countSearch(int size, int row, std::vector<uint8_t>& columns, std::vector<uint8_t>& diagLeft,
                  std::vector<uint8_t>& diagRight) {
    if (row == size) {
      return 1;
    }

    int total = 0;
    for (int column = 0; column < size; ++column) {
      int diagLeftIndex = row - column + size - 1;
      int diagRightIndex = row + column;

      if (columns[column] || diagLeft[diagLeftIndex] || diagRight[diagRightIndex]) {
        continue;
      }

      columns[column] = 1;
      diagLeft[diagLeftIndex] = 1;
      diagRight[diagRightIndex] = 1;

      total += countSearch(size, row + 1, columns, diagLeft, diagRight);

      columns[column] = 0;
      diagLeft[diagLeftIndex] = 0;
      diagRight[diagRightIndex] = 0;
    }
    return total;
  }

  int exploredStates_ = 0;
};

struct ParsedArguments {
  int boardSize;
  std::optional<int> maxSolutions;
  std::optional<fs::path> outputDir;
  bool jsonOutput;
};

ParsedArguments parseArguments(int argc, char* argv[]) {
  bool jsonOutput = false;
  std::vector<std::string_view> positional;

  for (int i = 1; i < argc; ++i) {
    std::string_view arg{argv[i]};
    if (arg == "--json") {
      jsonOutput = true;
    } else {
      positional.emplace_back(arg);
    }
  }

  if (positional.empty()) {
    throw std::invalid_argument("Usage: n-queens [--json] <board-size> [max-solutions] [output-dir]");
  }

  const std::string_view sizeArg = positional[0];
  int boardSize = 0;
  try {
    boardSize = std::stoi(std::string(sizeArg));
  } catch (...) {
    throw std::invalid_argument("Board size must be a positive integer.");
  }
  if (boardSize <= 0) {
    throw std::invalid_argument("Board size must be a positive integer.");
  }
  if (boardSize > 32) {
    throw std::invalid_argument("Board sizes above 32 are not supported.");
  }

  std::optional<int> maxSolutions;
  std::optional<fs::path> outputDir;

  if (positional.size() >= 2) {
    const std::string_view second = positional[1];
    bool candidateUsed = false;
    try {
      int parsed = std::stoi(std::string(second));
      if (parsed <= 0) {
        throw std::invalid_argument("Max solutions must be positive.");
      }
      maxSolutions = parsed;
      candidateUsed = true;
    } catch (...) {
      // treat as output dir if not already set later
    }

    if (!candidateUsed) {
      outputDir = fs::path(second);
    }
  }

  if (positional.size() >= 3) {
    outputDir = fs::path(positional[2]);
  }

  return ParsedArguments{boardSize, maxSolutions, outputDir, jsonOutput};
}

std::string renderJson(const ResultPayload& payload) {
  std::ostringstream out;
  out << '{';
  out << "\"size\":" << payload.size << ',';
  out << "\"enumeratedSolutions\":" << payload.enumeratedSolutions << ',';
  out << "\"limitReached\":" << (payload.limitReached ? "true" : "false") << ',';
  out << "\"maxSolutions\":";
  if (payload.maxSolutions.has_value()) {
    out << *payload.maxSolutions;
  } else {
    out << "null";
  }
  out << ',';
  out << "\"exploredStates\":" << payload.exploredStates << ',';
  out << "\"totalSolutions\":" << payload.totalSolutions << ',';
  out << std::fixed << std::setprecision(6);
  out << "\"solveDurationMs\":" << payload.solveDurationMs << ',';
  out << "\"countDurationMs\":" << payload.countDurationMs;
  out << '}';
  return out.str();
}

std::string renderPrettyJson(const ResultPayload& payload) {
  std::ostringstream out;
  out << "{\n";
  out << "  \"size\": " << payload.size << ",\n";
  out << "  \"enumeratedSolutions\": " << payload.enumeratedSolutions << ",\n";
  out << "  \"limitReached\": " << (payload.limitReached ? "true" : "false") << ",\n";
  out << "  \"maxSolutions\": ";
  if (payload.maxSolutions.has_value()) {
    out << *payload.maxSolutions;
  } else {
    out << "null";
  }
  out << ",\n";
  out << "  \"exploredStates\": " << payload.exploredStates << ",\n";
  out << "  \"totalSolutions\": " << payload.totalSolutions << ",\n";
  out << std::fixed << std::setprecision(6);
  out << "  \"solveDurationMs\": " << payload.solveDurationMs << ",\n";
  out << "  \"countDurationMs\": " << payload.countDurationMs << "\n";
  out << "}\n";
  return out.str();
}

std::string insertThousands(const std::string& digits) {
  const std::size_t len = digits.size();
  if (len <= 3) {
    return digits;
  }

  std::string result;
  result.reserve(len + len / 3);
  std::size_t remainder = len % 3;
  std::size_t index = 0;

  if (remainder != 0) {
    result.append(digits, 0, remainder);
    index = remainder;
    if (index < len) {
      result.push_back(',');
    }
  }

  for (; index < len; index += 3) {
    if (index > 0) {
      result.push_back(',');
    }
    result.append(digits, index, 3);
  }

  return result;
}

std::string formatWithThousands(double value) {
  std::ostringstream oss;
  oss << std::fixed << std::setprecision(3) << value;
  std::string str = oss.str();
  const std::size_t dotPos = str.find('.');
  if (dotPos == std::string::npos) {
    return insertThousands(str);
  }

  std::string formattedInteger = insertThousands(str.substr(0, dotPos));
  return formattedInteger + str.substr(dotPos);
}

std::string formatDuration(double durationMs) {
  if (durationMs >= 10'000.0) {
    return formatWithThousands(durationMs / 1000.0) + " s";
  }

  return formatWithThousands(durationMs) + " ms";
}

void ensureOutputDirectory(const fs::path& dir) {
  std::error_code ec;
  fs::create_directories(dir, ec);
  if (ec) {
    throw std::runtime_error("Failed to create output directory: " + ec.message());
  }
  for (auto it = fs::directory_iterator(dir); it != fs::directory_iterator(); ++it) {
    throw std::runtime_error("Output directory is not empty");
  }
}

void writeJsonFile(const fs::path& dir, int size, const ResultPayload& payload) {
  fs::path outputPath = dir / ("n-queens_" + std::to_string(size) + ".json");
  std::ofstream out(outputPath);
  if (!out) {
    throw std::runtime_error("Failed to open output file for writing.");
  }
  out << renderPrettyJson(payload);
  std::cout << "\x1b[1;36mWrote summary to " << outputPath.string() << "\x1b[0m\n";
}

int main(int argc, char* argv[]) {
  try {
    ParsedArguments args = parseArguments(argc, argv);

    if (args.outputDir.has_value() && !args.jsonOutput) {
      fs::path absPath = fs::absolute(*args.outputDir);
      ensureOutputDirectory(absPath);
      args.outputDir = absPath;
    }

    NQueensSolver solver;

    auto solveStart = std::chrono::steady_clock::now();
    SolveSummary summary = solver.solve(args.boardSize, args.maxSolutions);
    auto solveEnd = std::chrono::steady_clock::now();

    auto countStart = std::chrono::steady_clock::now();
    int totalSolutions = solver.count(args.boardSize);
    auto countEnd = std::chrono::steady_clock::now();

    auto solveDurationMs = std::chrono::duration<double, std::milli>(solveEnd - solveStart).count();
    auto countDurationMs = std::chrono::duration<double, std::milli>(countEnd - countStart).count();

    ResultPayload payload{args.boardSize,
                          summary.enumeratedSolutions,
                          summary.limitReached,
                          args.maxSolutions,
                          summary.exploredStates,
                          totalSolutions,
                          solveDurationMs,
                          countDurationMs};

    if (args.jsonOutput) {
      std::cout << renderJson(payload) << std::endl;
      return 0;
    }

    const std::string esc = "\x1b";
    std::cout << esc << "[1;35mBoard size: " << args.boardSize << esc << "[0m\n";
    std::cout << esc << "[1;32mEnumerated solutions: " << summary.enumeratedSolutions << esc
              << "[0m\n";
    std::cout << esc << "[1;32mTotal solutions: " << totalSolutions << esc << "[0m\n";
    std::cout << esc << "[1;34mSolve time: " << formatDuration(solveDurationMs) << esc
              << "[0m\n";
    std::cout << esc << "[1;34mCount time: " << formatDuration(countDurationMs) << esc
              << "[0m\n";

    if (args.outputDir.has_value()) {
      writeJsonFile(*args.outputDir, args.boardSize, payload);
    }

    return 0;
  } catch (const std::exception& ex) {
    std::cerr << ex.what() << std::endl;
    return 1;
  }
}
