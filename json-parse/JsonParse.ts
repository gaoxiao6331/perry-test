type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;

interface JSONObject {
  [key: string]: JSONValue;
}

interface JSONArray extends Array<JSONValue> {}

class JSONParseError extends Error {
  constructor(message: string, public index: number) {
    super(`${message} at position ${index}`);
  }
}

export class JSONParser {
  private i = 0;
  private str = "";
  constructor(private debugEnabled = false) {}

  parse(input: string): JSONValue {
    this.str = input;
    this.i = 0;
    this.debug("parse: start", { length: this.str.length });

    const value = this.parseValue();
    this.skipWhitespace();

    if (this.i < this.str.length) {
      throw new JSONParseError("Unexpected trailing characters", this.i);
    }
    this.debug("parse: finished", { index: this.i });
    return value;
  }

  private parseValue(): JSONValue {
    this.skipWhitespace();
    if (this.i >= this.str.length) {
      throw new JSONParseError("Unexpected end of input", this.i);
    }

    const ch = this.peek();
    this.debug("parseValue", { index: this.i, char: ch });

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
    this.debug("parseObject: start", { index: this.i });
    this.expect('{');
    const obj: JSONObject = {};

    this.skipWhitespace();
    if (this.i >= this.str.length) {
      throw new JSONParseError("Unterminated object", this.i);
    }

    if (this.peek() === '}') {
      this.i++;
      this.debug("parseObject: empty object", { index: this.i });
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
      this.debug("parseObject: key parsed", { key, index: this.i });

      this.skipWhitespace();
      this.expect(':');

      const value = this.parseValue();
      obj[key] = value;
      this.debug("parseObject: value parsed", { key, index: this.i });

      this.skipWhitespace();
      if (this.i >= this.str.length) {
        throw new JSONParseError("Unterminated object", this.i);
      }

      const ch = this.peek();

      if (ch === '}') {
        this.i++;
        this.debug("parseObject: end", { index: this.i });
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
    this.debug("parseArray: start", { index: this.i });
    this.expect('[');
    const arr: JSONArray = [];

    this.skipWhitespace();
    if (this.i >= this.str.length) {
      throw new JSONParseError("Unterminated array", this.i);
    }

    if (this.peek() === ']') {
      this.i++;
      this.debug("parseArray: empty array", { index: this.i });
      return arr;
    }

    while (true) {
      arr.push(this.parseValue());
      this.debug("parseArray: element parsed", { length: arr.length, index: this.i });

      this.skipWhitespace();
      if (this.i >= this.str.length) {
        throw new JSONParseError("Unterminated array", this.i);
      }

      const ch = this.peek();

      if (ch === ']') {
        this.i++;
        this.debug("parseArray: end", { length: arr.length, index: this.i });
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
    this.debug("parseString: start", { index: this.i });
    this.expect('"');

    let result = "";

    while (this.i < this.str.length) {
      const ch = this.str[this.i++];

      if (ch === '"') {
        this.debug("parseString: end", { index: this.i });
        return result;
      }

      if (ch === '\\') {
        if (this.i >= this.str.length) {
          throw new JSONParseError("Unterminated escape sequence", this.i);
        }
        const esc = this.str[this.i++];
        switch (esc) {
          case '"': result += '"'; break;
          case '\\': result += '\\'; break;
          case '/': result += '/'; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case 'n': result += '\n'; break;
          case 'r': result += '\r'; break;
          case 't': result += '\t'; break;
          case 'u':
            if (this.i + 4 > this.str.length) {
              throw new JSONParseError("Incomplete unicode escape", this.i);
            }
            const hex = this.str.slice(this.i, this.i + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              throw new JSONParseError("Invalid unicode escape", this.i);
            }
            result += String.fromCharCode(parseInt(hex, 16));
            this.i += 4;
            break;
          default:
            throw new JSONParseError(`Invalid escape \\${esc}`, this.i);
        }
      } else {
        result += ch;
      }
    }

    throw new JSONParseError("Unterminated string", this.i);
  }

  private parseNumber(): number {
    const start = this.i;

    if (this.i < this.str.length && this.str[this.i] === '-') {
      this.i++;
      if (this.i >= this.str.length) {
        throw new JSONParseError("Expected digit", this.i);
      }
    }

    this.consumeDigits();

    if (this.i < this.str.length && this.str[this.i] === '.') {
      this.i++;
      this.consumeDigits();
    }

    if (this.i < this.str.length && (this.str[this.i] === 'e' || this.str[this.i] === 'E')) {
      this.i++;
      if (this.i < this.str.length && (this.str[this.i] === '+' || this.str[this.i] === '-')) {
        this.i++;
      }
      this.consumeDigits();
    }

    const numStr = this.str.slice(start, this.i);
    const num = Number(numStr);

    if (Number.isNaN(num)) {
      throw new JSONParseError("Invalid number", start);
    }

    this.debug("parseNumber", { value: num, span: [start, this.i] });
    return num;
  }

  private parseLiteral(expected: string, value: any): any {
    if (this.str.startsWith(expected, this.i)) {
      this.i += expected.length;
      this.debug("parseLiteral", { expected, index: this.i });
      return value;
    }
    throw new JSONParseError(`Expected ${expected}`, this.i);
  }

  private consumeDigits() {
    const start = this.i;
    while (this.i < this.str.length && this.isDigit(this.str[this.i])) {
      this.i++;
    }
    if (start === this.i) {
      throw new JSONParseError("Expected digit", this.i);
    }
  }

  private skipWhitespace() {
    while (this.i < this.str.length && /\s/.test(this.str[this.i])) {
      this.i++;
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
    this.debug("expect", { expected: ch, index: this.i });
    this.i++;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private debug(...args: unknown[]) {
    if (this.debugEnabled) {
      console.log("[JSONParser]", ...args);
    }
  }
}