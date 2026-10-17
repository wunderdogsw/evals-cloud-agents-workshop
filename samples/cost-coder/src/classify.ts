import { COST_CODES, isCostCode, type CostCode } from "./codes.ts";
import { llm } from "./llm/llm.ts";

export interface InvoiceLine {
  /** Free-text line description as it appears on the supplier invoice (often Finnish, often abbreviated). */
  description: string;
  supplier?: string;
  quantity?: number;
  unit?: string;
  /** Net amount in EUR. Negative for credit notes. */
  amount?: number;
}

export interface Classification {
  costCode: CostCode;
  /** 0..1, the model's own estimate. */
  confidence: number;
  /** One or two sentences a site manager could read. */
  rationale: string;
}

export const MODEL = process.env.COST_CODER_MODEL ?? process.env.EVAL_TASK_MODEL ?? "claude-haiku-5-5";

// v1 prompt — intentionally plain. Phase 4 is about improving it without breaking things.
export const SYSTEM_PROMPT = `You classify construction purchase-invoice lines into cost codes.

Cost codes:
${Object.entries(COST_CODES)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

Pick the single best cost code for the line.`;

const TOOL = {
  name: "classify",
  description: "Return the cost code classification for the invoice line.",
  input_schema: {
    type: "object" as const,
    properties: {
      costCode: { type: "string", enum: Object.keys(COST_CODES) },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rationale: { type: "string" },
    },
    required: ["costCode", "confidence", "rationale"],
  },
};

export function formatLine(line: InvoiceLine): string {
  const parts = [`Description: ${line.description}`];
  if (line.supplier) parts.push(`Supplier: ${line.supplier}`);
  if (line.quantity !== undefined) parts.push(`Quantity: ${line.quantity}${line.unit ? " " + line.unit : ""}`);
  if (line.amount !== undefined) parts.push(`Amount: ${line.amount.toFixed(2)} EUR`);
  return parts.join("\n");
}

/**
 * Calls Claude through whichever provider is available (see src/llm/llm.ts):
 * your Claude Code login (default), the Cursor CLI, or ANTHROPIC_API_KEY.
 */
export async function classifyLine(line: InvoiceLine): Promise<Classification> {
  if (process.env.EVALS_MOCK === "1" || process.env.COST_CODER_MOCK === "1") return mockClassify(line);
  const res = await llm().structured<Classification>({
    model: MODEL,
    system: SYSTEM_PROMPT,
    prompt: formatLine(line),
    schema: TOOL.input_schema,
    toolName: TOOL.name,
    maxTokens: 400,
  });
  return parseClassification(res.data);
}

export function parseClassification(raw: unknown): Classification {
  const r = raw as Partial<Classification>;
  if (!isCostCode(r.costCode)) throw new Error(`invalid cost code: ${JSON.stringify(r.costCode)}`);
  const confidence = Math.max(0, Math.min(1, Number(r.confidence ?? 0)));
  return { costCode: r.costCode, confidence, rationale: String(r.rationale ?? "") };
}

/** Offline keyword heuristic so tests and EVALS_MOCK=1 runs need no API key. Deliberately imperfect. */
export function mockClassify(line: InvoiceLine): Classification {
  const d = `${line.description} ${line.supplier ?? ""}`.toLowerCase();
  const rules: [RegExp, CostCode][] = [
    [/teline|scaffold/, "3100"],
    [/vuokra|rental|nosturi|crane|henkilönostin|lift/, "3100"],
    [/kaivu|excavat|maa-aines|sora|gravel/, "1100"],
    [/betoni|concrete|raudoit|rebar|muotti/, "1200"],
    [/teräs|steel|hea|ipe/, "1300"],
    [/puutavara|timber|lauta|vaneri|plywood/, "1400"],
    [/katto|roof|bitumi/, "1500"],
    [/ikkun|window|ovi|door/, "1600"],
    [/kipsi|plaster|maali|paint|laatta|tile|lattia|floor/, "1700"],
    [/ilmanvaiht|ventilat|lämmit|heat|hvac|iv-/, "2100"],
    [/putki|pipe|viemäri|sewer|wc|hana/, "2200"],
    [/kaapeli|cable|sähkö|electr|valaisin|light/, "2300"],
    [/parakki|cabin|aita|fence|työmaa-wc|toilet/, "3200"],
    [/jäte|waste|lava|container/, "3300"],
    [/suunnittel|design|konsult|tarkast|inspect/, "4100"],
  ];
  const hit = rules.find(([re]) => re.test(d));
  return hit
    ? { costCode: hit[1], confidence: 0.7, rationale: `[mock] matched keyword for ${COST_CODES[hit[1]]}` }
    : { costCode: "9000", confidence: 0.2, rationale: "[mock] no keyword matched" };
}
