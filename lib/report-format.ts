// Helper untuk membentuk teks summary report task, diformat dengan gaya
// WhatsApp (*bold*) supaya bisa langsung di-paste ke chat WA asli.
//
// Dipakai di 2 tempat:
// 1. Tombol "Copy" di WhatsAppReportModal -> hasil fungsi ini disalin ke clipboard
// 2. Preview bubble -> baris-baris yang sama dipecah lagi jadi bubble chat,
//    tapi render-nya tetap dari sumber data yang sama (task[]) supaya
//    keduanya selalu konsisten.
//
// PERUBAHAN: Report sekarang dikelompokkan PER TASK (satu bubble/blok per
// task, diurutkan berdasarkan status lalu judul), BUKAN per assignee lagi.
// Nama assignee ditampilkan sebagai salah satu baris info di dalam setiap
// task, bukan lagi sebagai judul pengelompok.
//
// SUBTASK: Fungsi-fungsi di sini menerima daftar task RATA (flat) — hasil
// dari GET /api/tasks?...&flat=1, yaitu task top-level DAN subtask sebagai
// satu daftar datar, dibedakan lewat field `parentId`. sortTasksForReport
// mengelompokkan tiap subtask tepat di bawah task induknya (bukan ikut
// terurut sendiri berdasarkan status subtask itu sendiri), supaya report
// tetap terbaca sebagai struktur task -> subtask, bukan daftar acak.

import { Task, Status } from "@/lib/types";

// Label status KHUSUS untuk fitur export (Report WhatsApp & PDF) — sengaja
// dipisah dari STATUS_LABEL di lib/types.ts (yang dipakai tampilan List
// Tree & Timeline utama) supaya perubahan istilah di sini tidak ikut
// mengubah label di layar lain yang tidak diminta berubah.
export const EXPORT_STATUS_LABEL: Record<Status, string> = {
  TODO: "Pending",
  IN_PROGRESS: "Sedang Dikerjakan",
  DONE: "Done",
};

// Urutan status saat menampilkan report: task yang masih berjalan duluan,
// baru yang sudah selesai — supaya perhatian pembaca fokus ke yang belum
// kelar dulu.
const STATUS_ORDER: Status[] = ["IN_PROGRESS", "TODO", "DONE"];

// Bandingkan due date: yang paling dekat (tanggal terkecil/paling awal)
// duluan, task tanpa due date sama sekali ditaruh PALING AKHIR dalam
// kelompoknya. Dipakai sebagai urutan sekunder di dalam satu status
// (menggantikan urutan alfabetis judul yang dipakai sebelumnya).
function byDueDate(a: Task, b: Task): number {
  if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
  if (!a.dueDate) return 1; // a tidak punya deadline -> taruh setelah b
  if (!b.dueDate) return -1; // b tidak punya deadline -> taruh setelah a
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

// Format tanggal jadi "24-Juni" (tanggal-NamaBulan, tanpa tahun).
// Dipakai di dalam bracket *[ ... ]*, jadi tidak perlu prefix teks apa pun
// di sini -- pemanggil yang menentukan di mana ini ditaruh.
function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "";
  const date = new Date(dueDate);
  const day = date.getDate();
  const month = date.toLocaleDateString("id-ID", { month: "long" });
  return `${day}-${month}`;
}

// Baris hasil susunan report: task induk atau subtask, ditandai `isSubtask`
// supaya pemanggil (teks copy maupun bubble) tahu perlu diberi indentasi.
export type ReportRow = { task: Task; isSubtask: boolean };

// Susun task (flat, top-level + subtask campur) jadi daftar baris terurut:
// task top-level diurutkan lewat STATUS_ORDER lalu judul (seperti biasa),
// dan tiap subtask-nya langsung mengikuti tepat di bawah task induknya
// (diurutkan dengan aturan yang sama di antara sesama subtask satu induk).
// Subtask "yatim" (parentId menunjuk ke task yang tidak ada di daftar —
// harusnya tidak pernah terjadi lewat UI normal, tapi dijaga untuk
// keamanan) ditaruh di akhir sebagai task top-level biasa.
export function sortTasksForReport(tasks: Task[]): ReportRow[] {
  function byStatusThenDueDate(a: Task, b: Task): number {
    const statusDiff =
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    return byDueDate(a, b);
  }

  const topLevel = tasks.filter((t) => !t.parentId);
  const subtasksByParent = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const parentExists = tasks.some((p) => p.id === t.parentId);
    if (!parentExists) continue; // subtask yatim ditangani terpisah di bawah
    const list = subtasksByParent.get(t.parentId) ?? [];
    list.push(t);
    subtasksByParent.set(t.parentId, list);
  }
  const orphanSubtasks = tasks.filter(
    (t) => t.parentId && !tasks.some((p) => p.id === t.parentId),
  );

  const rows: ReportRow[] = [];
  for (const parent of [...topLevel].sort(byStatusThenDueDate)) {
    rows.push({ task: parent, isSubtask: false });
    // Sesama subtask satu induk sudah pasti berada di grup status yang sama
    // di layar (mereka menempel di bawah induknya, bukan dikelompokkan
    // sendiri) — jadi cukup diurutkan lewat due date saja di sini.
    const children = (subtasksByParent.get(parent.id) ?? []).sort(byDueDate);
    for (const child of children) {
      rows.push({ task: child, isSubtask: true });
    }
  }
  for (const orphan of [...orphanSubtasks].sort(byStatusThenDueDate)) {
    rows.push({ task: orphan, isSubtask: false });
  }

  return rows;
}

// Nama assignee yang ditampilkan di setiap baris task ("Belum Ditugaskan"
// kalau task.assignee null).
export function assigneeLabel(task: Task): string {
  return task.assignee?.name ?? "Belum Ditugaskan";
}

// Satu baris "meta" untuk satu task, dipakai persis sama baik di teks copy
// maupun di render bubble (supaya tidak ada drift antara dua tampilan).
// Format: "*[ Status | Kategori | 24-Juni ]*"
// Kategori disembunyikan kalau task tidak punya kategori.
// Tanggal disembunyikan kalau task tidak punya due date.
export function formatTaskMeta(task: Task): string {
  const metaParts: string[] = [EXPORT_STATUS_LABEL[task.status]];
  if (task.category) metaParts.push(task.category.name);

  const dueDateText = formatDueDate(task.dueDate);
  if (dueDateText) metaParts.push(dueDateText);

  return `*[ ${metaParts.join(" | ")} ]*`;
}

// Dipertahankan untuk kompatibilitas mundur (dipakai sebelumnya saat report
// masih dikelompokkan per assignee) — sekarang cuma delegasi ke
// formatTaskMeta, ditempel setelah judul task.
export function formatTaskLine(task: Task): string {
  return `${task.title} - ${formatTaskMeta(task)}`;
}

// Baris deskripsi tambahan di bawah formatTaskLine, HANYA dipanggil kalau
// task.description ada isinya (pemanggil yang mengecek null/kosong).
// Diberi indentasi kecil (spasi) supaya terlihat sebagai sub-baris dari
// task di atasnya, bukan task baru.
export function formatTaskDescriptionLine(description: string): string {
  return `  _${description.trim()}_`;
}

// Hitung ringkasan jumlah task per status, dipakai di header report.
export function summarizeStatusCounts(tasks: Task[]): Record<Status, number> {
  return tasks.reduce(
    (acc, t) => {
      acc[t.status] += 1;
      return acc;
    },
    { TODO: 0, IN_PROGRESS: 0, DONE: 0 } as Record<Status, number>,
  );
}

// Generate teks lengkap, format WhatsApp (*bold*), siap di-copy & paste.
// Sekarang satu blok per TASK (diurutkan lewat sortTasksForReport), dengan
// nama assignee ditulis sebagai baris info di dalam blok tersebut. Subtask
// ditulis dengan indentasi + awalan "↳" tepat di bawah task induknya.
export function generateWhatsAppReportText(
  projectName: string,
  tasks: Task[],
): string {
  const counts = summarizeStatusCounts(tasks);
  const rows = sortTasksForReport(tasks);
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [];
  lines.push(`*LAPORAN TASK — ${projectName.toUpperCase()}*`);
  lines.push(today);
  lines.push("");
  lines.push(
    `Total: ${tasks.length} task (${EXPORT_STATUS_LABEL.TODO}: ${counts.TODO}, ${EXPORT_STATUS_LABEL.IN_PROGRESS}: ${counts.IN_PROGRESS}, ${EXPORT_STATUS_LABEL.DONE}: ${counts.DONE})`,
  );
  lines.push("");

  if (rows.length === 0) {
    lines.push("_Belum ada task di project ini._");
    return lines.join("\n");
  }

  for (const { task, isSubtask } of rows) {
    const indent = isSubtask ? "  ↳ " : "";
    lines.push(`${indent}*${task.title}*`);
    lines.push(`${indent}${formatTaskMeta(task)}`);
    lines.push(`${indent}Assignee: ${assigneeLabel(task)}`);
    if (task.description && task.description.trim() !== "") {
      lines.push(`${indent}${formatTaskDescriptionLine(task.description)}`);
    }
    lines.push("");
  }

  lines.push("_Dibuat otomatis dari Task Manager_");

  return lines.join("\n").trim();
}

export { formatDueDate };
