import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, type Db, type Tx } from "@/db/client";
import { companySettings } from "@/db/schema";
import { withUser } from "@/db/with-user";
import { checkCompanyImage, type CompanyImageKind } from "@/lib/company-image";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

// The single company record printed on every document (SPEC §12), Admin only.
// Data changes are logged by the company_settings trigger. The logo and
// signature live in the private company-assets bucket, reached through
// AssetStorage, so only the server ever holds them.

export interface AssetStorage {
  upload(
    path: string,
    bytes: Uint8Array<ArrayBuffer>,
    contentType: string,
  ): Promise<void>;
  download(
    path: string,
  ): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string } | null>;
  remove(path: string): Promise<void>;
}

type Deps = { executor?: Db | Tx };
type StorageDeps = Deps & { storage: AssetStorage };

const PATH_COLUMN = {
  logo: "logoPath",
  signature: "signaturePath",
} as const satisfies Record<CompanyImageKind, keyof CompanySettings>;

export type CompanySettings = typeof companySettings.$inferSelect;

function authorize(actor: CurrentUser) {
  if (!can(actor.role, "editCompanySettings")) {
    throw new NotAllowedError("editCompanySettings");
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new UserInputError(result.error.issues[0]!.message);
  return result.data;
}

// Blank optional text is stored as null.
const blankAsNull = z
  .string()
  .trim()
  .transform((value) => value || null);

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Enter the company name."),
  address: blankAsNull,
  phone: blankAsNull,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.union([z.literal(""), z.email("Enter a valid email address.")]))
    .transform((value) => value || null),
  paymentInstructions: blankAsNull,
  defaultWoNote: blankAsNull,
});

export type CompanyDetails = z.input<typeof detailsSchema>;

// Undefined until an Admin first saves.
export async function getCompanySettings(
  actor: CurrentUser,
  { executor = db }: Deps = {},
): Promise<CompanySettings | undefined> {
  authorize(actor);
  return executor.query.companySettings.findFirst();
}

export async function updateCompanyDetails(
  actor: CurrentUser,
  input: CompanyDetails,
  { executor = db }: Deps = {},
): Promise<void> {
  authorize(actor);
  const values = parse(detailsSchema, input);
  await withUser(actor, (tx) => saveSettings(tx, values), executor);
}

// Each upload gets a new path, so the Activity Log shows the swap. The new
// file is stored before the row points at it and removed again if the row
// can't be saved; the old one goes only once the new one is saved.
export async function replaceCompanyImage(
  actor: CurrentUser,
  kind: CompanyImageKind,
  bytes: Uint8Array<ArrayBuffer>,
  { storage, executor = db }: StorageDeps,
): Promise<void> {
  authorize(actor);
  const { contentType, extension } = checkCompanyImage(kind, bytes);
  const path = `${kind}-${randomUUID()}.${extension}`;
  const column = PATH_COLUMN[kind];

  await storage.upload(path, bytes, contentType);
  let previous: string | null | undefined;
  try {
    await withUser(
      actor,
      async (tx) => {
        previous = (await tx.query.companySettings.findFirst())?.[column];
        await saveSettings(tx, { [column]: path });
      },
      executor,
    );
  } catch (error) {
    // Keep the original error even if the clean-up fails too.
    await storage
      .remove(path)
      .catch((cleanup) => console.error(`Orphaned asset ${path}`, cleanup));
    throw error;
  }
  if (previous) {
    await storage
      .remove(previous)
      .catch((cleanup) => console.error(`Orphaned asset ${previous}`, cleanup));
  }
}

// The uploaded image, or null while the default (or none) applies.
export async function readCompanyImage(
  actor: CurrentUser,
  kind: CompanyImageKind,
  { storage, executor = db }: StorageDeps,
) {
  authorize(actor);
  const settings = await executor.query.companySettings.findFirst();
  const path = settings?.[PATH_COLUMN[kind]];
  return path ? storage.download(path) : null;
}

// The row is created on the first save; the singleton index keeps it one.
async function saveSettings(
  tx: Tx,
  values: Partial<typeof companySettings.$inferInsert>,
) {
  const existing = await tx.query.companySettings.findFirst({
    columns: { id: true },
  });
  if (!existing) {
    await tx.insert(companySettings).values(values);
    return;
  }
  await tx
    .update(companySettings)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(companySettings.id, existing.id));
}
