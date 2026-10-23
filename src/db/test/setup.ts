import { config } from "dotenv";
import { assertDatabaseMatchesProject } from "@/db/test/guard";

config({ path: [".env.local", ".env"], quiet: true });

assertDatabaseMatchesProject(
  process.env.DATABASE_URL,
  process.env.SUPABASE_PROJECT_REF,
);
