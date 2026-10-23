import { describe, expect, it } from "vitest";
import { assertDatabaseMatchesProject } from "@/db/test/guard";

const REF = "ejsnnxkqxiuyouxewpzi";

describe("assertDatabaseMatchesProject", () => {
  it("accepts a pooler URL for the project", () => {
    expect(() =>
      assertDatabaseMatchesProject(
        `postgresql://postgres.${REF}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        REF,
      ),
    ).not.toThrow();
  });

  it("accepts a direct URL for the project", () => {
    expect(() =>
      assertDatabaseMatchesProject(
        `postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`,
        REF,
      ),
    ).not.toThrow();
  });

  it("refuses a URL for another project", () => {
    expect(() =>
      assertDatabaseMatchesProject(
        "postgresql://postgres.otherproject123456:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
        REF,
      ),
    ).toThrow(/does not match SUPABASE_PROJECT_REF/);
  });

  it("refuses a URL that only mentions the ref in the password", () => {
    expect(() =>
      assertDatabaseMatchesProject(
        `postgresql://postgres.other:${REF}@localhost:5432/postgres`,
        REF,
      ),
    ).toThrow(/does not match SUPABASE_PROJECT_REF/);
  });

  it("refuses when either value is missing", () => {
    expect(() => assertDatabaseMatchesProject(undefined, REF)).toThrow(
      /DATABASE_URL/,
    );
    expect(() =>
      assertDatabaseMatchesProject("postgresql://x@y/z", undefined),
    ).toThrow(/SUPABASE_PROJECT_REF/);
  });
});
