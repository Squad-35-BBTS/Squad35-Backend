import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations-postgresql",
    seed: "node prisma/seed.js",
  },

  engine: "classic",

  datasource: {
    url: env("DIRECT_URL"),
  },
});