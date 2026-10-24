import { z } from "zod";

// Text fields shared by the master data schemas (SPEC §4).

export const required = (message: string) => z.string().trim().min(1, message);

// Blank optional fields are stored as null.
export const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null);
