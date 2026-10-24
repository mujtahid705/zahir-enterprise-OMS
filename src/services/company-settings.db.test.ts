import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, companySettings, profiles } from "@/db/schema";
import { asSystem, createUser as seedUser } from "@/db/test/fixtures";
import { dbError, dbTest, inSavepoint } from "@/db/test/rollback";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/auth";
import type { Role } from "@/lib/permissions";
import {
  getCompanySettings,
  readCompanyImage,
  replaceCompanyImage,
  updateCompanyDetails,
  type AssetStorage,
} from "@/services/company-settings";

// Stands in for the company-assets bucket.
function fakeStorage() {
  const files = new Map<
    string,
    { bytes: Uint8Array<ArrayBuffer>; contentType: string }
  >();
  const storage: AssetStorage = {
    async upload(path, bytes, contentType) {
      files.set(path, { bytes, contentType });
    },
    async download(path) {
      return files.get(path) ?? null;
    },
    async remove(path) {
      files.delete(path);
    },
  };
  return { storage, files };
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Signature + IHDR chunk with an RGBA colour type: enough to pass the checks.
const rgbaPng = new Uint8Array([
  ...PNG_HEADER,
  ...[0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52],
  ...[0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0],
]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

async function seedActor(tx: Tx, role: Role) {
  const name = `Test ${role}`;
  const actor = await seedUser(tx, { fullName: name, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name, email: profile!.email, role } as CurrentUser;
}

function latestSettingsLog(tx: Tx, userId: string) {
  return tx
    .select()
    .from(activityLog)
    .where(
      and(
        eq(activityLog.entityType, "company_settings"),
        eq(activityLog.userId, userId),
      ),
    )
    .orderBy(desc(activityLog.id))
    .limit(1)
    .then((rows) => rows[0]);
}

const details = {
  name: "Zahir Enterprise",
  address: "12 Motijheel C/A, Dhaka 1000",
  phone: "+880 1711-000000",
  email: "Accounts@Zahir.example",
  paymentInstructions: "bKash 01711-000000",
  defaultWoNote: "Deliver within 7 days.",
};

describe("updateCompanyDetails", () => {
  dbTest("lets an Admin save the details, logged as that Admin", async (tx) => {
    const admin = await seedActor(tx, "admin");

    await updateCompanyDetails(admin, details, { executor: tx });

    expect(await getCompanySettings(admin, { executor: tx })).toMatchObject({
      ...details,
      email: "accounts@zahir.example",
    });
    expect(await latestSettingsLog(tx, admin.id)).toMatchObject({
      kind: "data",
      entityLabel: "Company settings",
    });
  });

  dbTest("logs only the fields that changed on a second save", async (tx) => {
    const admin = await seedActor(tx, "admin");
    await updateCompanyDetails(admin, details, { executor: tx });

    await updateCompanyDetails(
      admin,
      { ...details, phone: "+880 1811-111111" },
      { executor: tx },
    );

    expect(await latestSettingsLog(tx, admin.id)).toMatchObject({
      action: "update",
      changes: {
        phone: { from: "+880 1711-000000", to: "+880 1811-111111" },
      },
    });
  });

  dbTest("stores blank fields as empty", async (tx) => {
    const admin = await seedActor(tx, "admin");

    await updateCompanyDetails(
      admin,
      { ...details, email: " ", paymentInstructions: "" },
      { executor: tx },
    );

    expect(await getCompanySettings(admin, { executor: tx })).toMatchObject({
      email: null,
      paymentInstructions: null,
    });
  });

  dbTest("rejects an invalid email or a missing name", async (tx) => {
    const admin = await seedActor(tx, "admin");

    await expect(
      updateCompanyDetails(
        admin,
        { ...details, email: "not-an-email" },
        { executor: tx },
      ),
    ).rejects.toThrow(new UserInputError("Enter a valid email address."));
    await expect(
      updateCompanyDetails(admin, { ...details, name: " " }, { executor: tx }),
    ).rejects.toThrow(new UserInputError("Enter the company name."));
  });

  for (const role of ["manager", "staff"] as const) {
    dbTest(`is refused to a ${role}`, async (tx) => {
      const actor = await seedActor(tx, role);

      await expect(
        updateCompanyDetails(actor, details, { executor: tx }),
      ).rejects.toBeInstanceOf(NotAllowedError);
      await expect(
        getCompanySettings(actor, { executor: tx }),
      ).rejects.toBeInstanceOf(NotAllowedError);
    });
  }
});

describe("replaceCompanyImage", () => {
  dbTest("stores an Admin's logo privately, logged", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { storage, files } = fakeStorage();

    await replaceCompanyImage(admin, "logo", jpeg, { storage, executor: tx });

    const settings = await getCompanySettings(admin, { executor: tx });
    expect(settings?.logoPath).toMatch(/^logo-[0-9a-f-]{36}\.jpg$/);
    expect(files.get(settings!.logoPath!)).toEqual({
      bytes: jpeg,
      contentType: "image/jpeg",
    });
    // An insert logs the whole row, an update the from/to of the path.
    const log = await latestSettingsLog(tx, admin.id);
    expect(log?.changes).toHaveProperty("logo_path");
    expect(JSON.stringify(log?.changes)).toContain(settings!.logoPath!);
    expect(
      await readCompanyImage(admin, "logo", { storage, executor: tx }),
    ).toEqual({ bytes: jpeg, contentType: "image/jpeg" });
  });

  dbTest("removes the old file when one is replaced", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { storage, files } = fakeStorage();
    await replaceCompanyImage(admin, "signature", rgbaPng, {
      storage,
      executor: tx,
    });
    const first = (await getCompanySettings(admin, { executor: tx }))!
      .signaturePath!;

    await replaceCompanyImage(admin, "signature", rgbaPng, {
      storage,
      executor: tx,
    });

    const second = (await getCompanySettings(admin, { executor: tx }))!
      .signaturePath!;
    expect(second).toMatch(/^signature-.*\.png$/);
    expect(second).not.toBe(first);
    expect([...files.keys()]).toEqual([second]);
    expect(await latestSettingsLog(tx, admin.id)).toMatchObject({
      changes: { signature_path: { from: first, to: second } },
    });
  });

  dbTest("keeps the details already saved", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { storage } = fakeStorage();
    await updateCompanyDetails(admin, details, { executor: tx });

    await replaceCompanyImage(admin, "logo", jpeg, { storage, executor: tx });

    expect(await getCompanySettings(admin, { executor: tx })).toMatchObject({
      name: details.name,
    });
  });

  dbTest("refuses a file that fails the image checks", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { storage, files } = fakeStorage();

    await expect(
      replaceCompanyImage(admin, "signature", jpeg, {
        storage,
        executor: tx,
      }),
    ).rejects.toThrow(new UserInputError("Upload the signature as a PNG."));
    expect(files.size).toBe(0);
  });

  dbTest("removes the upload again when it can't be saved", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { storage, files } = fakeStorage();
    // No profile behind this id, so the Activity Log row fails its FK.
    const ghost = { ...admin, id: randomUUID() };

    await expect(
      inSavepoint(tx, (sp) =>
        replaceCompanyImage(ghost, "logo", jpeg, { storage, executor: sp }),
      ),
    ).rejects.toMatchObject(dbError(/foreign key/));
    expect(files.size).toBe(0);
  });

  dbTest("is refused to a Manager before anything is stored", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const { storage, files } = fakeStorage();

    await expect(
      replaceCompanyImage(manager, "logo", jpeg, { storage, executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    await expect(
      readCompanyImage(manager, "logo", { storage, executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    expect(files.size).toBe(0);
  });
});

describe("readCompanyImage", () => {
  dbTest("is null while no image is uploaded", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { storage } = fakeStorage();
    await updateCompanyDetails(admin, details, { executor: tx });
    // The live row may already hold one (ADR 0002).
    await asSystem(tx, () =>
      tx.update(companySettings).set({ signaturePath: null }),
    );

    expect(
      await readCompanyImage(admin, "signature", { storage, executor: tx }),
    ).toBeNull();
  });
});
