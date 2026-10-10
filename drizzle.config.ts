import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// `generate` works offline; only commands that talk to the database need the URL.
const DB_COMMANDS = ["migrate", "push", "pull", "studio", "check"];
const needsDatabase = DB_COMMANDS.some((command) => process.argv.includes(command));

const directUrl = z.url().optional().safeParse(process.env.DATABASE_DIRECT_URL);
if (!directUrl.success || (needsDatabase && !directUrl.data)) {
  throw new Error(
    "DATABASE_DIRECT_URL must be a valid Postgres URL (Supabase session pooler, port 5432). See README.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // auth.* and realtime.* are owned by Supabase.
  schemaFilter: ["public"],
  dbCredentials: {
    url: directUrl.data ?? "",
  },
  strict: true,
  verbose: true,
});
