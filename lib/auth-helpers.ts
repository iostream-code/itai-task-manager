// Helper kecil yang dipakai berulang di berbagai API route, supaya tidak
// copy-paste logic "cek sudah login?" / "cek dia admin?" / "cek dia anggota
// project ini?" di setiap file route.ts.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Ambil session user yang sedang login. null kalau belum login.
// (Sebenarnya proxy.ts sudah memblokir request yang belum login untuk
// hampir semua route, tapi kita tetap cek di sini sebagai pertahanan kedua
// — defense in depth — terutama karena beberapa pesan error perlu lebih
// spesifik daripada sekadar redirect.)
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

// True kalau user yang login adalah admin GLOBAL.
export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

// True kalau user yang login adalah anggota (member ATAU dianggap punya
// akses) dari project tertentu. Admin global otomatis dianggap punya akses
// ke SEMUA project (tidak perlu didaftarkan manual sebagai ProjectMember).
export async function canAccessProject(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "admin") return true;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  return membership !== null;
}
