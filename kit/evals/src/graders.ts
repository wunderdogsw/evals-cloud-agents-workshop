import type { Grader, GraderContext, GradeResult } from "./types.ts";

/** Read `a.b.c` from an object. Empty path returns the value itself. */
export function get(value: unknown, path: string | undefined): unknown {
  if (!path) return value;
  return path.split(".").reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), value);
}

const norm = (v: unknown, caseSensitive: boolean) => {
  const s = typeof v === "string" ? v.trim() : JSON.stringify(v);
  return caseSensitive ? s : s?.toLowerCase();
};

const result = (name: string, pass: boolean, reason?: string, score = pass ? 1 : 0): GradeResult => ({ name, pass, score, reason });

/** output[field] === expected[expectedField ?? field]. */
export function exactMatch(field?: string, opts: { expectedField?: string; caseSensitive?: boolean; name?: string } = {}): Grader {
  const name = opts.name ?? `exact${field ? ":" + field : ""}`;
  return {
    name,
    grade({ case: c, output }) {
      const got = get(output, field);
      const want = get(c.expected, opts.expectedField ?? field);
      if (want === undefined) return result(name, false, "case has no expected value for this grader");
      const ok = norm(got, opts.caseSensitive ?? false) === norm(want, opts.caseSensitive ?? false);
      return result(name, ok, ok ? undefined : `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    },
  };
}

/** output[field] is one of expected[expectedField] (array) — for cases where several answers are acceptable. */
export function oneOf(field: string, expectedField: string, opts: { name?: string } = {}): Grader {
  const name = opts.name ?? `oneOf:${field}`;
  return {
    name,
    grade({ case: c, output }) {
      const got = norm(get(output, field), false);
      const options = get(c.expected, expectedField);
      if (!Array.isArray(options)) return result(name, false, `expected.${expectedField} must be an array`);
      const ok = options.some((o) => norm(o, false) === got);
      return result(name, ok, ok ? undefined : `got ${JSON.stringify(get(output, field))}, acceptable: ${JSON.stringify(options)}`);
    },
  };
}

/** Text in output[field] contains every needle (case-insensitive). Needles may come from expected via `fromExpected`. */
export function includes(field: string | undefined, needles: string[] | { fromExpected: string }, opts: { name?: string } = {}): Grader {
  const name = opts.name ?? `includes${field ? ":" + field : ""}`;
  return {
    name,
    grade({ case: c, output }) {
      const hay = String(get(output, field) ?? "").toLowerCase();
      const list = Array.isArray(needles) ? needles : (get(c.expected, needles.fromExpected) as string[] | undefined) ?? [];
      const missing = list.filter((n) => !hay.includes(n.toLowerCase()));
      const score = list.length ? (list.length - missing.length) / list.length : 1;
      return result(name, missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : undefined, score);
    },
  };
}

/** Text in output[field] must NOT contain any of the given strings (e.g. leaked prompt, forbidden words). */
export function excludes(field: string | undefined, forbidden: string[], opts: { name?: string } = {}): Grader {
  const name = opts.name ?? `excludes${field ? ":" + field : ""}`;
  return {
    name,
    grade({ output }) {
      const hay = String(get(output, field) ?? "").toLowerCase();
      const hit = forbidden.filter((n) => hay.includes(n.toLowerCase()));
      return result(name, hit.length === 0, hit.length ? `found forbidden: ${hit.join(", ")}` : undefined);
    },
  };
}

export function matches(field: string | undefined, pattern: RegExp, opts: { name?: string } = {}): Grader {
  const name = opts.name ?? `matches${field ? ":" + field : ""}`;
  return {
    name,
    grade({ output }) {
      const v = String(get(output, field) ?? "");
      const ok = pattern.test(v);
      return result(name, ok, ok ? undefined : `${JSON.stringify(v.slice(0, 120))} !~ ${pattern}`);
    },
  };
}

/** |output[field] - expected[field]| <= tolerance. */
export function numericClose(field: string, tolerance: number, opts: { expectedField?: string; name?: string } = {}): Grader {
  const name = opts.name ?? `close:${field}`;
  return {
    name,
    grade({ case: c, output }) {
      const got = Number(get(output, field));
      const want = Number(get(c.expected, opts.expectedField ?? field));
      if (Number.isNaN(got) || Number.isNaN(want)) return result(name, false, `not numeric: got ${got}, want ${want}`);
      const ok = Math.abs(got - want) <= tolerance;
      return result(name, ok, ok ? undefined : `|${got} - ${want}| > ${tolerance}`);
    },
  };
}

/** Output has the required keys with the right primitive types. Cheap structural check — run it first. */
export function hasShape(shape: Record<string, "string" | "number" | "boolean" | "object" | "array">, opts: { name?: string } = {}): Grader {
  const name = opts.name ?? "shape";
  return {
    name,
    grade({ output }) {
      const problems: string[] = [];
      for (const [key, type] of Object.entries(shape)) {
        const v = get(output, key);
        const actual = Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
        if (actual !== type) problems.push(`${key}: want ${type}, got ${actual}`);
      }
      return result(name, problems.length === 0, problems.join("; ") || undefined);
    },
  };
}

/** Escape hatch: write any check as a function. Return boolean, a 0..1 score, or a partial GradeResult. */
export function custom<I = any, E = any, O = any>(
  name: string,
  fn: (ctx: GraderContext<I, E, O>) => boolean | number | Partial<GradeResult> | Promise<boolean | number | Partial<GradeResult>>,
  opts: { passAt?: number } = {},
): Grader<I, E, O> {
  return {
    name,
    async grade(ctx) {
      const r = await fn(ctx);
      if (typeof r === "boolean") return result(name, r);
      if (typeof r === "number") return result(name, r >= (opts.passAt ?? 1), undefined, r);
      const score = r.score ?? (r.pass ? 1 : 0);
      return { name, score, pass: r.pass ?? score >= (opts.passAt ?? 1), reason: r.reason, costUsd: r.costUsd };
    },
  };
}
