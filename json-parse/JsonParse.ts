export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export interface JSONArray extends Array<JSONValue> {}

type LogFunction = (message: string) => void;

export interface JSONParserOptions {
  debug?: boolean;
  logInterval?: number;
  log?: LogFunction;
}

class JSONParseError extends Error {
  constructor(message: string, public index: number) {
    super(`${message} at position ${index}`);
  }
}

export class JSONParser {
  private i = 0;
  private str = "";
  private lastLoggedIndex = -1;
  private readonly debugEnabled: boolean;
  private readonly logInterval: number;
  private readonly logFn: LogFunction | null;

  constructor(options: JSONParserOptions = {}) {
    this.debugEnabled = !!options.debug;
    this.logInterval = Math.max(1, options.logInterval ?? 5000);
    this.logFn = this.debugEnabled
      ? options.log ?? ((message) => console.error(message))
      : null;
  }

  parse<TParsed = JSONValue>(input: string): TParsed {
    this.str = input;
    this.i = 0;
    this.lastLoggedIndex = -1;

    this.log("parse:start");

    const value = this.parseValue() as TParsed;
    this.skipWhitespace();

    if (this.i < this.str.length) {
      throw new JSONParseError("Unexpected trailing characters", this.i);
    }

    this.log("parse:complete");
    return value;
  }

  private parseValue(): JSONValue {
    this.skipWhitespace();
    if (this.i >= this.str.length) {
      throw new JSONParseError("Unexpected end of input", this.i);
    }

    const ch = this.peek();

    if (ch === '"') return this.parseString();
    if (ch === '{') return this.parseObject();
    if (ch === '[') return this.parseArray();
    if (ch === 't') return this.parseLiteral("true", true);
    if (ch === 'f') return this.parseLiteral("false", false);
    if (ch === 'n') return this.parseLiteral("null", null);
    if (ch === '-' || this.isDigit(ch)) return this.parseNumber();

    throw new JSONParseError(`Unexpected token '${ch}'`, this.i);
  }

  private parseObject(): JSONObject {
    this.expect('{');
    const obj: JSONObject = {};

    this.skipWhitespace();
    if (this.i >= this.str.length) {
      throw new JSONParseError("Unterminated object", this.i);
    }

    if (this.peek() === '}') {
      this.i++;
      return obj;
    }

    while (true) {
      this.skipWhitespace();

      if (this.i >= this.str.length) {
        throw new JSONParseError("Unterminated object", this.i);
      }

      if (this.peek() !== '"') {
        throw new JSONParseError("Expected string key", this.i);
      }

      const key = this.parseString();

      this.skipWhitespace();
      this.expect(':');

      const value = this.parseValue();
      obj[key] = value;

      this.skipWhitespace();
      if (this.i >= this.str.length) {
        throw new JSONParseError("Unterminated object", this.i);
      }

      const ch = this.peek();

      if (ch === '}') {
        this.i++;
        break;
      }

      if (ch !== ',') {
        throw new JSONParseError("Expected ',' or '}'", this.i);
      }

      this.i++;
    }

    return obj;
  }

  private parseArray(): JSONArray {
    this.expect('[');
    const arr: JSONArray = [];

    this.skipWhitespace();
    if (this.i >= this.str.length) {
      throw new JSONParseError("Unterminated array", this.i);
    }

    if (this.peek() === ']') {
      this.i++;
      return arr;
    }

    while (true) {
      arr.push(this.parseValue());

      this.skipWhitespace();
      if (this.i >= this.str.length) {
        throw new JSONParseError("Unterminated array", this.i);
      }

      const ch = this.peek();

      if (ch === ']') {
        this.i++;
        break;
      }

      if (ch !== ',') {
        throw new JSONParseError("Expected ',' or ']'", this.i);
      }

      this.i++;
    }

    return arr;
  }

  private parseString(): string {
    this.expect('"');

    const chars: string[] = [];

    while (this.i < this.str.length) {
      const code = this.str.charCodeAt(this.i++);

      if (code === 0x22) {
        return chars.join("");
      }

      if (code === 0x5c) {
        if (this.i >= this.str.length) {
          throw new JSONParseError("Unterminated escape sequence", this.i);
        }

        const escCode = this.str.charCodeAt(this.i++);
        switch (escCode) {
          case 0x22: chars.push('"'); break;
          case 0x5c: chars.push('\\'); break;
          case 0x2f: chars.push('/'); break;
          case 0x62: chars.push('\b'); break;
          case 0x66: chars.push('\f'); break;
          case 0x6e: chars.push('\n'); break;
          case 0x72: chars.push('\r'); break;
          case 0x74: chars.push('\t'); break;
          case 0x75: {
            if (this.i + 4 > this.str.length) {
              throw new JSONParseError("Incomplete unicode escape", this.i);
            }
            const hex = this.str.slice(this.i, this.i + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              throw new JSONParseError("Invalid unicode escape", this.i);
            }
            chars.push(String.fromCharCode(parseInt(hex, 16)));
            this.i += 4;
            break;
          }
          default:
            throw new JSONParseError(`Invalid escape \\${String.fromCharCode(escCode)}`, this.i);
        }
      } else {
        chars.push(String.fromCharCode(code));
      }
    }

    throw new JSONParseError("Unterminated string", this.i);
  }

  private parseNumber(): number {
    const startIndex = this.i;

    if (this.i < this.str.length && this.str.charCodeAt(this.i) === 0x2d) {
      this.i++;
      if (this.i >= this.str.length) {
        throw new JSONParseError("Expected digit", this.i);
      }
    }

    if (this.i >= this.str.length || !this.isDigit(this.str[this.i])) {
      throw new JSONParseError("Expected digit", this.i);
    }

    // integer part
    if (this.str.charCodeAt(this.i) === 0x30) {
      this.i++;
      while (this.i < this.str.length && this.isDigit(this.str[this.i])) {
        this.i++;
      }
    } else {
      while (this.i < this.str.length && this.isDigit(this.str[this.i])) {
        this.i++;
      }
    }

    // fraction
    if (this.i < this.str.length && this.str.charCodeAt(this.i) === 0x2e) {
      this.i++;
      if (this.i >= this.str.length || !this.isDigit(this.str[this.i])) {
        throw new JSONParseError("Expected digit", this.i);
      }
      while (this.i < this.str.length && this.isDigit(this.str[this.i])) {
        this.i++;
      }
    }

    // exponent
    if (this.i < this.str.length) {
      const code = this.str.charCodeAt(this.i);
      if (code === 0x65 || code === 0x45) {
        this.i++;
        if (this.i < this.str.length) {
          const signCode = this.str.charCodeAt(this.i);
          if (signCode === 0x2b || signCode === 0x2d) {
            this.i++;
          }
        }

        if (this.i >= this.str.length || !this.isDigit(this.str[this.i])) {
          throw new JSONParseError("Expected digit", this.i);
        }

        while (this.i < this.str.length && this.isDigit(this.str[this.i])) {
          this.i++;
        }
      }
    }

    const numStr = this.str.slice(startIndex, this.i);
    const num = Number(numStr);

    if (!Number.isFinite(num)) {
      throw new JSONParseError("Invalid number", startIndex);
    }

    return num;
  }

  private parseLiteral<TLiteral extends JSONValue>(expected: string, value: TLiteral): TLiteral {
    if (this.str.startsWith(expected, this.i)) {
      this.i += expected.length;
      return value;
    }
    throw new JSONParseError(`Expected ${expected}`, this.i);
  }

  private skipWhitespace() {
    while (this.i < this.str.length) {
      const code = this.str.charCodeAt(this.i);
      if (
        code === 0x20 || // space
        code === 0x0a || // line feed
        code === 0x0d || // carriage return
        code === 0x09 // horizontal tab
      ) {
        this.i++;
        continue;
      }
      break;
    }
  }

  private peek(): string {
    if (this.i >= this.str.length) {
      throw new JSONParseError("Unexpected end of input", this.i);
    }
    return this.str[this.i];
  }

  private expect(ch: string) {
    if (this.i >= this.str.length || this.str[this.i] !== ch) {
      throw new JSONParseError(`Expected '${ch}'`, this.i);
    }
    this.i++;
  }

  private isDigit(ch: string): boolean {
    const code = ch.charCodeAt(0);
    return code >= 0x30 && code <= 0x39;
  }

  private log(message: string) {
    if (!this.debugEnabled) return;
    this.logFn?.(message);
  }
}