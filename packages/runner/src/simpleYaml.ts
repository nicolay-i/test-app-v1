type Scalar = string | number | boolean | null | string[];
type ParsedYaml = Record<string, unknown>;

type Line = {
  indent: number;
  text: string;
};

export function parseSimpleYaml(source: string): ParsedYaml {
  const lines = source
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.trim().length > 0)
    .map<Line>((line) => ({
      indent: line.match(/^ */)?.[0].length ?? 0,
      text: line.trim()
    }));

  const [value, nextIndex] = parseBlock(lines, 0, 0);

  if (nextIndex < lines.length) {
    throw new Error(`Unexpected YAML content near line ${nextIndex + 1}`);
  }

  if (!isRecord(value)) {
    throw new Error("YAML root must be an object");
  }

  return value;
}

function parseBlock(lines: Line[], index: number, indent: number): [unknown, number] {
  const line = lines[index];
  if (!line) {
    return [{}, index];
  }

  if (line.indent < indent) {
    return [{}, index];
  }

  if (line.text.startsWith("- ")) {
    return parseArray(lines, index, indent);
  }

  return parseObject(lines, index, indent);
}

function parseObject(lines: Line[], index: number, indent: number): [ParsedYaml, number] {
  const result: ParsedYaml = {};
  let current = index;

  while (current < lines.length) {
    const line = lines[current];
    if (!line || line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      throw new Error(`Unexpected indentation near line ${current + 1}`);
    }
    if (line.text.startsWith("- ")) {
      break;
    }

    const separatorIndex = line.text.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Expected key/value pair near line ${current + 1}`);
    }

    const key = line.text.slice(0, separatorIndex).trim();
    const rawValue = line.text.slice(separatorIndex + 1).trim();

    if (rawValue.length > 0) {
      result[key] = parseScalar(rawValue);
      current += 1;
      continue;
    }

    const nextLine = lines[current + 1];
    if (!nextLine || nextLine.indent <= indent) {
      result[key] = {};
      current += 1;
      continue;
    }

    const [nested, nextIndex] = parseBlock(lines, current + 1, nextLine.indent);
    result[key] = nested;
    current = nextIndex;
  }

  return [result, current];
}

function parseArray(lines: Line[], index: number, indent: number): [unknown[], number] {
  const result: unknown[] = [];
  let current = index;

  while (current < lines.length) {
    const line = lines[current];
    if (!line || line.indent < indent || !line.text.startsWith("- ")) {
      break;
    }
    if (line.indent > indent) {
      throw new Error(`Unexpected array indentation near line ${current + 1}`);
    }

    const itemText = line.text.slice(2).trim();

    if (itemText.length === 0) {
      const nextLine = lines[current + 1];
      if (!nextLine || nextLine.indent <= indent) {
        result.push(null);
        current += 1;
        continue;
      }
      const [nested, nextIndex] = parseBlock(lines, current + 1, nextLine.indent);
      result.push(nested);
      current = nextIndex;
      continue;
    }

    if (looksLikeInlineObjectStart(itemText)) {
      const [item, nextIndex] = parseArrayObjectItem(lines, current, indent, itemText);
      result.push(item);
      current = nextIndex;
      continue;
    }

    result.push(parseScalar(itemText));
    current += 1;
  }

  return [result, current];
}

function parseArrayObjectItem(
  lines: Line[],
  index: number,
  indent: number,
  itemText: string
): [ParsedYaml, number] {
  const result: ParsedYaml = {};
  addKeyValue(result, itemText, index);

  let current = index + 1;
  const childIndent = indent + 2;

  while (current < lines.length) {
    const line = lines[current];
    if (!line || line.indent <= indent) {
      break;
    }
    if (line.indent !== childIndent) {
      throw new Error(`Unexpected nested object indentation near line ${current + 1}`);
    }

    const separatorIndex = line.text.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Expected nested key/value near line ${current + 1}`);
    }

    const key = line.text.slice(0, separatorIndex).trim();
    const rawValue = line.text.slice(separatorIndex + 1).trim();

    if (rawValue.length > 0) {
      result[key] = parseScalar(rawValue);
      current += 1;
      continue;
    }

    const nextLine = lines[current + 1];
    if (!nextLine || nextLine.indent <= childIndent) {
      result[key] = {};
      current += 1;
      continue;
    }

    const [nested, nextIndex] = parseBlock(lines, current + 1, nextLine.indent);
    result[key] = nested;
    current = nextIndex;
  }

  return [result, current];
}

function addKeyValue(target: ParsedYaml, text: string, lineIndex: number): void {
  const separatorIndex = text.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error(`Expected array object item near line ${lineIndex + 1}`);
  }

  const key = text.slice(0, separatorIndex).trim();
  const rawValue = text.slice(separatorIndex + 1).trim();
  target[key] = rawValue.length > 0 ? parseScalar(rawValue) : {};
}

function parseScalar(value: string): Scalar {
  if (value === "[]") {
    return [];
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => {
        if (
          (item.startsWith('"') && item.endsWith('"')) ||
          (item.startsWith("'") && item.endsWith("'"))
        ) {
          return item.slice(1, -1);
        }
        return item;
      });
  }
  if (value === "null" || value === "~") {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function stripComment(line: string): string {
  let quoted: "'" | '"' | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === "'" || char === '"') && !quoted) {
      quoted = char;
      continue;
    }
    if (char === quoted) {
      quoted = null;
      continue;
    }
    if (char === "#" && !quoted) {
      return line.slice(0, index).trimEnd();
    }
  }

  return line.trimEnd();
}

function looksLikeInlineObjectStart(text: string): boolean {
  return /^[A-Za-z0-9_-]+:/.test(text);
}

function isRecord(value: unknown): value is ParsedYaml {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
