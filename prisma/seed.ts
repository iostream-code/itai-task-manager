// Script ini mengisi database dengan data awal supaya tidak kosong
// saat pertama kali dijalankan. Jalankan dengan: npm run db:seed

import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Mulai seeding...");

  // Hapus data lama dulu (urutan penting karena ada relasi —
  // hapus dari tabel "anak" dulu sebelum tabel "induk")
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Semua user contoh pakai password yang sama untuk kemudahan testing.
  // GANTI password ini di environment production!
  const defaultPassword = await hash("password123", 12);

  // Buat anggota tim IT.
  // itai jadi admin GLOBAL — dia bisa membuat project & mengatur anggota.
  const [itai, aryak, crysna] = await Promise.all([
    prisma.user.create({
      data: {
        name: "IT AI",
        email: "itai@indokoper.id",
        password: defaultPassword,
        role: "admin",
      },
    }),
    prisma.user.create({
      data: {
        name: "Aryakkk",
        email: "aryak@indokoper.id",
        password: defaultPassword,
        role: "member",
      },
    }),
    prisma.user.create({
      data: {
        name: "Crysna Wima",
        email: "crysna@indokoper.id",
        password: defaultPassword,
        role: "member",
      },
    }),
  ]);

  // Buat satu project contoh, dengan itai sebagai pembuat + Project Lead.
  const project = await prisma.project.create({
    data: {
      name: "Internal Tools",
      description: "Pengembangan & perawatan tools internal tim IT.",
      createdById: itai.id,
      members: {
        create: [
          { userId: itai.id, role: "Project Manager" },
          { userId: aryak.id, role: "Fullstack Developer" },
          { userId: crysna.id, role: "Fullstack Developer" },
        ],
      },
    },
  });

  // Buat kategori untuk project ini
  const [bug, request, maintenance] = await Promise.all([
    prisma.category.create({
      data: { name: "Bug", color: "#ef4444", projectId: project.id },
    }),
    prisma.category.create({
      data: { name: "Request", color: "#3b82f6", projectId: project.id },
    }),
    prisma.category.create({
      data: { name: "Maintenance", color: "#10b981", projectId: project.id },
    }),
  ]);

  // Buat contoh task di dalam project ini
  await prisma.task.createMany({
    data: [
      {
        title: "Perbaiki bug invoice tidak muncul di halaman penjualan",
        description: "Invoice gabungan gagal generate PDF untuk multi-page.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: itai.id,
        categoryId: bug.id,
        projectId: project.id,
      },
      {
        title: "Setup WhatsApp broadcast manual selection",
        description: "Integrasi WAHA untuk akun INDOKOPER dan KOPERINDO.",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: aryak.id,
        categoryId: request.id,
        projectId: project.id,
      },
      {
        title: "Update server & dependency Laravel",
        description: "Cek compatibility PHP 7.3 di environment lama.",
        status: "DONE",
        priority: "LOW",
        assigneeId: crysna.id,
        categoryId: maintenance.id,
        projectId: project.id,
      },
    ],
  });

  console.log("Seeding selesai!");
  console.log("");
  console.log("Akun contoh (semua pakai password: password123):");
  console.log("  Admin  -> itai@indokoper.id");
  console.log("  Member -> aryak@indokoper.id");
  console.log("  Member -> crysna@indokoper.id");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
