// Helper untuk membentuk teks summary report task, diformat dengan gaya
// WhatsApp (*bold*) supaya bisa langsung di-paste ke chat WA asli.
//
// Dipakai di 2 tempat:
// 1. Tombol "Copy" di WhatsAppReportModal -> hasil fungsi ini disalin ke clipboard
// 2. Preview bubble -> baris-baris yang sama dipecah lagi jadi bubble chat,
//    tapi render-nya tetap dari sumber data yang sama (task[]) supaya
//    keduanya selalu konsisten.
//
// Catatan: status & kategori ditulis sebagai teks biasa di dalam bracket
// *[ ... ]* (bold ala WhatsApp). Prioritas TIDAK ditampilkan di report ini.

import { Task, Status, STATUS_LABEL } from "@/lib/types";

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

export type AssigneeGroup = {
  assigneeName: string;
  tasks: Task[];
};

// Mengelompokkan task berdasarkan assignee. Task tanpa assignee dikumpulkan
// di grup terpisah "Belum Ditugaskan" dan selalu ditaruh di akhir, supaya
// daftar nama orang di atas tetap rapi.
export function groupTasksByAssignee(tasks: Task[]): AssigneeGroup[] {
  const groups = new Map<string, AssigneeGroup>();
  const UNASSIGNED_KEY = "__unassigned__";

  for (const task of tasks) {
    const key = task.assignee?.id ?? UNASSIGNED_KEY;
    const name = task.assignee?.name ?? "Belum Ditugaskan";

    if (!groups.has(key)) {
      groups.set(key, { assigneeName: name, tasks: [] });
    }
    groups.get(key)!.tasks.push(task);
  }

  const result = Array.from(groups.entries());
  // Urutkan alfabetis by nama, lalu pindahkan grup "Belum Ditugaskan" ke akhir
  result.sort(([keyA, a], [keyB, b]) => {
    if (keyA === UNASSIGNED_KEY) return 1;
    if (keyB === UNASSIGNED_KEY) return -1;
    return a.assigneeName.localeCompare(b.assigneeName);
  });

  return result.map(([, group]) => group);
}

// Satu baris untuk satu task, dipakai persis sama baik di teks copy
// maupun di render bubble (supaya tidak ada drift antara dua tampilan).
// Format: "Judul Task - *[ Kategori | Status | 24-Juni ]*"
// Kategori disembunyikan kalau task tidak punya kategori.
// Tanggal disembunyikan kalau task tidak punya due date.
export function formatTaskLine(task: Task): string {
  const metaParts: string[] = [];
  if (task.category) metaParts.push(task.category.name);
  metaParts.push(STATUS_LABEL[task.status]);

  const dueDateText = formatDueDate(task.dueDate);
  if (dueDateText) metaParts.push(dueDateText);

  return `${task.title} - *[ ${metaParts.join(" | ")} ]*`;
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
export function generateWhatsAppReportText(
  projectName: string,
  tasks: Task[],
): string {
  const counts = summarizeStatusCounts(tasks);
  const groups = groupTasksByAssignee(tasks);
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

  if (tasks.length === 0) {
    lines.push("_Belum ada task di project ini._");
    return lines.join("\n");
  }

  for (const group of groups) {
    lines.push(`*${group.assigneeName}*`);
    for (const task of group.tasks) {
      lines.push(`- ${formatTaskLine(task)}`);
      if (task.description && task.description.trim() !== "") {
        lines.push(formatTaskDescriptionLine(task.description));
      }
    }
    lines.push("");
  }

  lines.push("_Dibuat otomatis dari Task Manager_");

  return lines.join("\n").trim();
}

export { formatDueDate };
