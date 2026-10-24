// Record numbers and codes (SPEC §7, §4).

// Master data code: prefix and a four-digit, zero-padded counter (C-0001).
export function formatCode(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(4, "0")}`;
}
