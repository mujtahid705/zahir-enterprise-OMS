import { z } from "zod";

// Text fields shared by the master data schemas (SPEC §4).

export const required = (message: string) => z.string().trim().min(1, message);

// Blank optional fields are stored as null.
export const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null);

// A page's URL query, as Next passes it.
export type SearchParams = Record<string, string | string[] | undefined>;

// One URL query value read with `schema`; undefined if it doesn't fit.
export const param = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
};
