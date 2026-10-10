import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // auth.* and realtime.* are owned by Supabase.
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_DIRECT_URL ?? "",
  },
  strict: true,
  verbose: true,
});
