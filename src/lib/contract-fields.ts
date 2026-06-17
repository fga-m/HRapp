// Per-field UI metadata for contract-template merge fields, shared by the
// template config editor, the generate grid, and the API. Server- and
// client-safe (no imports).

export type ContractFieldType = "text" | "date" | "select";

export type ContractFieldSetting = {
  label?: string;
  type: ContractFieldType;
  options?: string[];
};

// Keyed by the {{field}} name detected in the template.
export type ContractFieldConfig = Record<string, ContractFieldSetting>;

/** The setting for a field, defaulting to a plain text box. */
export function fieldSetting(config: ContractFieldConfig | null | undefined, key: string): ContractFieldSetting {
  const s = config?.[key];
  if (s && (s.type === "text" || s.type === "date" || s.type === "select")) return s;
  return { type: "text" };
}

/** Friendly column label for a field (falls back to the raw key). */
export function fieldLabel(config: ContractFieldConfig | null | undefined, key: string): string {
  return config?.[key]?.label?.trim() || key;
}

/**
 * Turn a grid value into what gets merged into the Doc. A `date` field holds a
 * native `yyyy-mm-dd` value, which we render as `DD/MM/YYYY` to match the
 * template. Everything else passes through unchanged.
 */
export function formatFieldValue(value: string, type: ContractFieldType): string {
  if (type === "date" && value) {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return value;
}

/**
 * Keep a field config in sync with the fields actually present in the doc:
 * drop settings for fields that no longer exist, leave the rest untouched.
 * (New fields simply default to text via `fieldSetting`.)
 */
export function reconcileFieldConfig(
  config: ContractFieldConfig | null | undefined,
  fields: string[]
): ContractFieldConfig {
  const next: ContractFieldConfig = {};
  const present = new Set(fields);
  for (const [key, setting] of Object.entries(config ?? {})) {
    if (present.has(key)) next[key] = setting;
  }
  return next;
}

/** Sanitise an incoming field config from the client before storing. */
export function normaliseFieldConfig(raw: unknown): ContractFieldConfig {
  if (!raw || typeof raw !== "object") return {};
  const out: ContractFieldConfig = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as Partial<ContractFieldSetting>;
    const type: ContractFieldType =
      v?.type === "date" || v?.type === "select" ? v.type : "text";
    const setting: ContractFieldSetting = { type };
    if (typeof v?.label === "string" && v.label.trim()) setting.label = v.label.trim();
    if (type === "select" && Array.isArray(v?.options)) {
      const options = v.options.map((o) => String(o).trim()).filter(Boolean);
      if (options.length) setting.options = options;
    }
    out[key] = setting;
  }
  return out;
}

// Map a detected field name to a known staff column so the grid can pre-fill it.
// (Case/seperator-insensitive, e.g. "Employee Name" → full_name.)
export function prefillKeyFor(field: string): "full_name" | "position" | "department" | "email" | null {
  const n = field.toLowerCase().replace(/[\s-]+/g, "_");
  if (["employee_name", "name", "full_name", "staff_name"].includes(n)) return "full_name";
  if (["position", "title", "role", "job_title"].includes(n)) return "position";
  if (["department", "dept", "team"].includes(n)) return "department";
  if (["email", "email_address"].includes(n)) return "email";
  return null;
}
