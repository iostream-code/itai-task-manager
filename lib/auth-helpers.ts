// Helper kecil yang dipakai berulang di berbagai API route, supaya tidak
// copy-paste logic "cek sudah login?" / "cek dia admin?" / "cek dia anggota
// project ini?" / "task ini masuk scope dia atau bukan?" di setiap route.ts.
//
// RINGKASAN MODEL ROLE (3 role global):
//   admin  -> all access. Semua Project, semua User, semua Task.
//   leader -> hanya Project tempat dia terdaftar (ProjectMember). Di dalam
//             project itu, HANYA melihat/mengelola task miliknya sendiri +
//             task milik staff yang User.leaderId == dia. Staff leader LAIN
//             yang kebetulan jadi member project yang sama tetap tersembunyi.
//   staff  -> hanya melihat/mengelola task yang assignee-nya = dirinya
//             sendiri. Selalu melekat 1 leader lewat User.leaderId.

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

// True kalau user yang login adalah admin GLOBAL (all access).
export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

// True kalau user yang login adalah anggota (member ATAU dianggap punya
// akses) dari project tertentu. Admin global otomatis dianggap punya akses
// ke SEMUA project (tidak perlu didaftarkan manual sebagai ProjectMember).
// PENTING: ini HANYA mengecek akses ke Project (boleh buka halamannya /
// lihat daftar task project ini secara garis besar). Untuk scope task per
// leader/staff yang lebih sempit, lihat getTaskScopeUserIds() &
// canAccessTask() di bawah.
export async function canAccessProject(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "admin") return true;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  return membership !== null;
}

// Menghasilkan daftar userId yang task-nya BOLEH dilihat/dikelola oleh user
// yang sedang login — dipakai untuk membangun filter `assigneeId: { in: ... }`
// di query task.
//   - admin  -> null (artinya: TIDAK ADA batasan, semua assignee boleh)
//   - leader -> [dirinya sendiri, ...semua staff yang leaderId = dirinya]
//   - staff  -> [dirinya sendiri saja]
// Task tanpa assignee (assigneeId null) sengaja TIDAK ikut ter-scope di sini
// — itu dihandle terpisah di pemanggil kalau relevan (biasanya task tanpa
// assignee tetap dianggap "milik" pembuatnya/creator, tapi skema saat ini
// belum menyimpan creator, jadi tim harus assign task ke seseorang).
export async function getTaskScopeUserIds(): Promise<string[] | null> {
  const user = await getCurrentUser();
  if (!user) return [];
  if (user.role === "admin") return null;

  if (user.role === "leader") {
    const staff = await prisma.user.findMany({
      where: { leaderId: user.id },
      select: { id: true },
    });
    return [user.id, ...staff.map((s: { id: string }) => s.id)];
  }

  // staff
  return [user.id];
}

// True kalau task tertentu (identifikasi lewat assigneeId-nya) ada di dalam
// scope user yang sedang login. Dipakai di route [id] (PATCH/DELETE/GET satu
// task) setelah task-nya diambil dari database.
export async function canAccessTask(taskAssigneeId: string | null) {
  const scope = await getTaskScopeUserIds();
  if (scope === null) return true; // admin
  if (!taskAssigneeId) return false; // leader/staff tidak boleh lihat task tanpa assignee milik orang lain
  return scope.includes(taskAssigneeId);
}

// True kalau user yang login boleh MENGUBAH assignee sebuah task ke
// targetAssigneeId tertentu.
//   - admin  -> boleh assign ke siapa saja
//   - leader -> boleh assign ke dirinya sendiri atau staff-nya sendiri
//   - staff  -> hanya boleh assign ke dirinya sendiri
export async function canAssignTo(targetAssigneeId: string | null) {
  if (!targetAssigneeId) return true; // mengosongkan assignee selalu boleh
  const scope = await getTaskScopeUserIds();
  if (scope === null) return true; // admin
  return scope.includes(targetAssigneeId);
}
