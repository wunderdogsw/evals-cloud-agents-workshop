/**
 * Simplified cost-code catalogue for a construction project.
 * Loosely inspired by Finnish building classification practice — not an official standard.
 */
export const COST_CODES = {
  "1100": "Site preparation and earthworks (excavation, fill, ground works)",
  "1200": "Foundations and concrete works (formwork, rebar, ready-mix concrete)",
  "1300": "Structural steel",
  "1400": "Timber framing and carpentry",
  "1500": "Roofing",
  "1600": "Windows and doors",
  "1700": "Interior finishes (plasterboard, paint, flooring, tiling)",
  "2100": "HVAC — heating, ventilation, air conditioning",
  "2200": "Plumbing — water, sewer, sanitary fixtures",
  "2300": "Electrical — cabling, lighting, switchboards",
  "3100": "Scaffolding and site equipment rental (lifts, cranes, machines)",
  "3200": "Site facilities (site cabins, toilets, fencing, temporary power and water)",
  "3300": "Waste management and recycling",
  "4100": "Design, consulting and inspections",
  "9000": "Other / needs human review",
} as const;

export type CostCode = keyof typeof COST_CODES;

export const isCostCode = (v: unknown): v is CostCode => typeof v === "string" && v in COST_CODES;
