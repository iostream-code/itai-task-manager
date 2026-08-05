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

import { Task, Status, STATUS_LABEL } from "@/lib/types";

// Urutan status saat menampilkan report: task yang masih berjalan duluan,
// baru yang sudah selesai — supaya perhatian pembaca fokus ke yang belum
// kelar dulu.
const STATUS_ORDER: Status[] = ["IN_PROGRESS", "TODO", "DONE"];

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

// Mengurutkan task untuk keperluan report: berdasarkan status (urutan
// STATUS_ORDER di atas), lalu judul secara alfabetis di dalam status yang
// sama. Dipakai bersama baik oleh render bubble (satu blok per task)
// maupun generateWhatsAppReportText, supaya urutannya selalu konsisten.
export function sortTasksForReport(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const statusDiff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    return a.title.localeCompare(b.title);
  });
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
  const metaParts: string[] = [STATUS_LABEL[task.status]];
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
// nama assignee ditulis sebagai baris info di dalam blok tersebut.
export function generateWhatsAppReportText(
  projectName: string,
  tasks: Task[],
): string {
  const counts = summarizeStatusCounts(tasks);
  const sortedTasks = sortTasksForReport(tasks);
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
    `Total: ${tasks.length} task (To Do: ${counts.TODO}, In Progress: ${counts.IN_PROGRESS}, Done: ${counts.DONE})`,
  );
  lines.push("");

  if (sortedTasks.length === 0) {
    lines.push("_Belum ada task di project ini._");
    return lines.join("\n");
  }

  for (const task of sortedTasks) {
    lines.push(`*${task.title}*`);
    lines.push(`${formatTaskMeta(task)}`);
    lines.push(`Assignee: ${assigneeLabel(task)}`);
    if (task.description && task.description.trim() !== "") {
      lines.push(formatTaskDescriptionLine(task.description));
    }
    lines.push("");
  }

  lines.push("_Dibuat otomatis dari Task Manager_");

  return lines.join("\n").trim();
}

export { formatDueDate };
