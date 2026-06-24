// File konfigurasi baru yang wajib ada di Prisma 7.
// Sebelumnya, connection URL database ditulis langsung di schema.prisma
// dengan `url = env("DATABASE_URL")`. Sekarang URL untuk keperluan
// Prisma CLI (db push, migrate, studio, seed) dipindah ke sini.

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
