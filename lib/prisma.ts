import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Kenapa pakai pola ini?
// Saat development, Next.js melakukan hot-reload yang bisa membuat
// PrismaClient baru setiap kali file berubah, sehingga numpuk koneksi
// ke database. Kita simpan instance-nya di variabel global supaya
// dipakai ulang (singleton).
//
// Catatan Prisma 7: PrismaClient sekarang WAJIB diberi "driver adapter"
// secara eksplisit (tidak otomatis baca DATABASE_URL dari schema lagi).
// Untuk PostgreSQL, adapternya adalah @prisma/adapter-pg.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
