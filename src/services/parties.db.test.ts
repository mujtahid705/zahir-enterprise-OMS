import { and, desc, eq, sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest } from "@/db/test/rollback";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import { customers, suppliers } from "@/services/parties";

async function seedActor(tx: Tx, role: Role): Promise<CurrentUser> {
  const actor = await seedUser(tx, { fullName: `Test ${role}`, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name: actor.name, email: profile!.email, role };
}

function latestLog(tx: Tx, entityId: string) {
  return tx
    .select()
    .from(activityLog)
    .where(
      and(eq(activityLog.entityId, entityId), eq(activityLog.kind, "data")),
    )
    .orderBy(desc(activityLog.id))
    .limit(1)
    .then((rows) => rows[0]);
}

function codeNumber(code: string) {
  return Number(code.split("-")[1]);
}

const highwaySweets = {
  name: "Highway Sweets",
  phone: "01711000000",
  address: "12 Station Road, Dhaka",
};

const suzinas = {
  name: "Suzinas",
  phone: "01811000000",
  whatsapp: "01811000000",
  address: "Plot 4, Tongi BSCIC",
};

describe("create", () => {
  dbTest("gives each new Customer the next C- code, logged", async (tx) => {
    const manager = await seedActor(tx, "manager");

    const first = await customers.create(manager, highwaySweets, {
      executor: tx,
    });
    const second = await customers.create(
      manager,
      { ...highwaySweets, name: "Lucky Bakery" },
      { executor: tx },
    );

    expect(first.code).toMatch(/^C-\d{4,}$/);
    expect(codeNumber(second.code)).toBe(codeNumber(first.code) + 1);
    expect(
      await customers.get(manager, first.id, { executor: tx }),
    ).toMatchObject({
      code: first.code,
      name: "Highway Sweets",
      contactPerson: null,
      isActive: true,
      createdBy: manager.id,
    });
    expect(await latestLog(tx, first.id)).toMatchObject({
      action: "insert",
      userId: manager.id,
      entityLabel: `${first.code} Highway Sweets`,
    });
  });

  dbTest("counts Suppliers separately with S- codes", async (tx) => {
    const admin = await seedActor(tx, "admin");

    const customer = await customers.create(admin, highwaySweets, {
      executor: tx,
    });
    const supplier = await suppliers.create(admin, suzinas, {
      executor: tx,
    });
    const next = await customers.create(admin, highwaySweets, {
      executor: tx,
    });

    expect(supplier.code).toMatch(/^S-\d{4,}$/);
    expect(codeNumber(next.code)).toBe(codeNumber(customer.code) + 1);
  });

  dbTest("is refused to Staff", async (tx) => {
    const staff = await seedActor(tx, "staff");

    await expect(
      customers.create(staff, highwaySweets, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    await expect(
      suppliers.create(staff, suzinas, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });

  dbTest("requires name, phone and address", async (tx) => {
    const manager = await seedActor(tx, "manager");

    await expect(
      customers.create(
        manager,
        { ...highwaySweets, phone: "  " },
        { executor: tx },
      ),
    ).rejects.toThrow(new UserInputError("Enter a phone number."));
    await expect(
      customers.create(
        manager,
        { ...highwaySweets, name: "" },
        { executor: tx },
      ),
    ).rejects.toThrow(new UserInputError("Enter a name."));
  });

  dbTest("requires a Supplier's WhatsApp number", async (tx) => {
    const manager = await seedActor(tx, "manager");

    await expect(
      suppliers.create(manager, { ...suzinas, whatsapp: "" }, { executor: tx }),
    ).rejects.toThrow(new UserInputError("Enter a WhatsApp number."));
  });

  dbTest("rejects a malformed email and stores blanks as null", async (tx) => {
    const manager = await seedActor(tx, "manager");

    await expect(
      customers.create(
        manager,
        { ...highwaySweets, email: "not-an-email" },
        { executor: tx },
      ),
    ).rejects.toThrow(new UserInputError("Enter a valid email address."));

    const { id } = await customers.create(
      manager,
      { ...highwaySweets, email: " ", notes: "", contactPerson: " Rahim " },
      { executor: tx },
    );
    expect(await customers.get(manager, id, { executor: tx })).toMatchObject({
      email: null,
      notes: null,
      contactPerson: "Rahim",
    });
  });
});

describe("update and setActive", () => {
  dbTest(
    "let a Manager edit a Customer, logged as a field diff",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const { id, code } = await customers.create(manager, highwaySweets, {
        executor: tx,
      });

      await customers.update(
        manager,
        id,
        { ...highwaySweets, phone: "01722000000" },
        { executor: tx },
      );

      expect(await customers.get(manager, id, { executor: tx })).toMatchObject({
        code,
        phone: "01722000000",
        updatedBy: manager.id,
      });
      expect((await latestLog(tx, id))?.changes).toEqual({
        phone: { from: "01711000000", to: "01722000000" },
      });
    },
  );

  dbTest("deactivate and reactivate a Supplier", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { id } = await suppliers.create(admin, suzinas, { executor: tx });

    await suppliers.setActive(admin, id, false, { executor: tx });
    expect((await suppliers.get(admin, id, { executor: tx }))?.isActive).toBe(
      false,
    );
    await suppliers.setActive(admin, id, true, { executor: tx });
    expect((await suppliers.get(admin, id, { executor: tx }))?.isActive).toBe(
      true,
    );
  });

  dbTest("are refused to Staff", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const staff = await seedActor(tx, "staff");
    const customer = await customers.create(manager, highwaySweets, {
      executor: tx,
    });
    const supplier = await suppliers.create(manager, suzinas, {
      executor: tx,
    });

    await expect(
      customers.update(staff, customer.id, highwaySweets, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    await expect(
      customers.setActive(staff, customer.id, false, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    await expect(
      suppliers.update(staff, supplier.id, suzinas, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    await expect(
      suppliers.setActive(staff, supplier.id, false, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });

  dbTest("report a record that doesn't exist", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const missing = "00000000-0000-0000-0000-000000000000";

    await expect(
      customers.update(manager, missing, highwaySweets, { executor: tx }),
    ).rejects.toThrow(new UserInputError("That Customer doesn't exist."));
  });
});

describe("remove", () => {
  dbTest("lets an Admin delete an unused Customer, logged", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { id, code } = await customers.create(admin, highwaySweets, {
      executor: tx,
    });

    await customers.remove(admin, id, { executor: tx });

    expect(await customers.get(admin, id, { executor: tx })).toBeUndefined();
    expect(await latestLog(tx, id)).toMatchObject({
      action: "delete",
      userId: admin.id,
      entityLabel: `${code} Highway Sweets`,
    });
  });

  dbTest("never hands a deleted record's code out again", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const deleted = await suppliers.create(admin, suzinas, { executor: tx });
    await suppliers.remove(admin, deleted.id, { executor: tx });

    const next = await suppliers.create(admin, suzinas, { executor: tx });

    expect(codeNumber(next.code)).toBe(codeNumber(deleted.code) + 1);
  });

  for (const role of ["manager", "staff"] as const) {
    dbTest(`is refused to a ${role}`, async (tx) => {
      const admin = await seedActor(tx, "admin");
      const actor = await seedActor(tx, role);
      const { id } = await customers.create(admin, highwaySweets, {
        executor: tx,
      });

      await expect(
        customers.remove(actor, id, { executor: tx }),
      ).rejects.toBeInstanceOf(NotAllowedError);
      expect(await customers.get(admin, id, { executor: tx })).toBeDefined();
    });
  }

  dbTest("refuses a Customer used in an Order", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { id, code } = await customers.create(admin, highwaySweets, {
      executor: tx,
    });
    // Stands in for orders.customer_id (SPEC §14), rolled back with the test.
    await tx.execute(sql`
      create table test_orders (customer_id uuid not null references customers)`);
    await tx.execute(sql`insert into test_orders values (${id})`);

    await expect(customers.remove(admin, id, { executor: tx })).rejects.toThrow(
      new UserInputError(
        `${code} Highway Sweets is in use, so it can't be deleted. Deactivate it instead.`,
      ),
    );
    expect(await customers.get(admin, id, { executor: tx })).toBeDefined();
  });
});

describe("list", () => {
  dbTest("searches code, name or phone for any role", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const staff = await seedActor(tx, "staff");
    const { id, code } = await customers.create(
      manager,
      { ...highwaySweets, name: "Zqxv Sweets", phone: "01999123456" },
      { executor: tx },
    );

    for (const query of ["zqxv", "01999123456", code]) {
      const { rows, total } = await customers.list(
        staff,
        { query },
        { executor: tx },
      );
      expect(rows.map((r) => r.id)).toEqual([id]);
      expect(total).toBe(1);
    }
  });

  dbTest("shows active records unless asked otherwise", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const active = await suppliers.create(
      manager,
      { ...suzinas, name: "Qqzv Active" },
      { executor: tx },
    );
    const inactive = await suppliers.create(
      manager,
      { ...suzinas, name: "Qqzv Inactive" },
      { executor: tx },
    );
    await suppliers.setActive(manager, inactive.id, false, { executor: tx });

    const ids = async (status?: "active" | "inactive" | "all") =>
      (
        await suppliers.list(
          manager,
          { query: "qqzv", status },
          { executor: tx },
        )
      ).rows.map((r) => r.id);
    expect(await ids()).toEqual([active.id]);
    expect(await ids("inactive")).toEqual([inactive.id]);
    expect(await ids("all")).toEqual([active.id, inactive.id]);
  });

  dbTest("pages 25 at a time", async (tx) => {
    const manager = await seedActor(tx, "manager");
    for (let i = 0; i < 26; i++) {
      await customers.create(
        manager,
        { ...highwaySweets, name: `Pager ${String(i).padStart(2, "0")} Vvqz` },
        { executor: tx },
      );
    }

    const first = await customers.list(
      manager,
      { query: "vvqz" },
      { executor: tx },
    );
    const second = await customers.list(
      manager,
      { query: "vvqz", page: 2 },
      { executor: tx },
    );
    expect(first.total).toBe(26);
    expect(first.rows).toHaveLength(25);
    expect(second.rows.map((r) => r.name)).toEqual(["Pager 25 Vvqz"]);
  });
});

describe("options", () => {
  dbTest("offers only active records to pickers", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const active = await customers.create(manager, highwaySweets, {
      executor: tx,
    });
    const inactive = await customers.create(manager, highwaySweets, {
      executor: tx,
    });
    await customers.setActive(manager, inactive.id, false, { executor: tx });

    const ids = (await customers.options(manager, { executor: tx })).map(
      (o) => o.id,
    );
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactive.id);
  });
});
