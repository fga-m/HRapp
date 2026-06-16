// Safely evaluate a basic arithmetic expression entered in an amount field,
// e.g. "12.50 + 8.30 + 5" or "(10 + 2) * 3". Supports + - * / and parentheses
// with normal precedence, plus a leading unary +/-.
//
// Implemented as a small recursive-descent parser (NOT eval / new Function) so
// nothing arbitrary can run. Returns the numeric result, or null when the input
// is empty, malformed, or not finite (e.g. divide-by-zero).
export function evaluateAmount(input: string): number | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  // Only digits, the four operators, parentheses, dot and whitespace are allowed.
  if (!/^[0-9+\-*/().\s]+$/.test(s)) return null;

  // --- Tokenize into numbers and operator/paren symbols ---
  const tokens: Array<number | string> = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if ("+-*/()".includes(c)) {
      tokens.push(c);
      i++;
      continue;
    }
    // Parse a number (optionally with a single decimal point).
    let j = i;
    let dotSeen = false;
    while (j < s.length && (/[0-9]/.test(s[j]) || (s[j] === "." && !dotSeen))) {
      if (s[j] === ".") dotSeen = true;
      j++;
    }
    if (j === i) return null;
    const num = Number(s.slice(i, j));
    if (Number.isNaN(num)) return null;
    tokens.push(num);
    i = j;
  }
  if (tokens.length === 0) return null;

  // --- Recursive-descent evaluation ---
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = take();
      const right = parseFactor();
      if (right === null) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number | null {
    const t = peek();
    if (t === "+") {
      take();
      return parseFactor();
    }
    if (t === "-") {
      take();
      const f = parseFactor();
      return f === null ? null : -f;
    }
    if (t === "(") {
      take();
      const inner = parseExpr();
      if (inner === null) return null;
      if (take() !== ")") return null;
      return inner;
    }
    if (typeof t === "number") {
      take();
      return t;
    }
    return null;
  }

  const result = parseExpr();
  if (result === null) return null;
  if (pos !== tokens.length) return null; // trailing/unconsumed tokens → invalid
  if (!Number.isFinite(result)) return null;
  return result;
}

// True when the text looks like an arithmetic expression rather than a plain
// number (used to decide whether to show the "= $X.XX" live result).
export function looksLikeExpression(input: string): boolean {
  return /[+*/()]/.test(input) || /\S\s*-/.test(input);
}
