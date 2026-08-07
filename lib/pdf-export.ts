// Generate PDF ringkasan task, dikelompokkan PER STATUS (To Do / In Progress
// / Done) — beda dari lib/report-format.ts yang dikelompokkan per task
// untuk tampilan bubble WhatsApp. Dibuat sebagai file terpisah karena
// tujuannya beda: report WA untuk dibaca cepat di chat, PDF ini untuk
// disimpan/dicetak sebagai dokumen.
//
// Dijalankan sepenuhnya di BROWSER (client-side) lewat jsPDF — tidak ada
// endpoint API baru, generate & download terjadi langsung dari data task
// yang sudah di-fetch. Konsisten dengan Report WA yang juga tidak
// menyentuh server untuk pembuatan dokumennya, hanya untuk fetch data task.
//
// SUBTASK: sama seperti report-format.ts, fungsi ini menerima daftar task
// RATA (flat, hasil GET /api/tasks?...&flat=1) lalu mengelompokkan subtask
// tepat di bawah task induknya dalam status yang sama.

import { jsPDF } from "jspdf";
import { Task, Status, STATUS_LABEL, PRIORITY_LABEL } from "@/lib/types";

const STATUS_ORDER: Status[] = ["TODO", "IN_PROGRESS", "DONE"];

// Warna header per status (RGB), dipakai untuk garis/badge kecil di PDF
// supaya tiap grup status mudah dibedakan sekilas.
const STATUS_COLOR: Record<Status, [number, number, number]> = {
  TODO: [100, 116, 139], // slate-500
  IN_PROGRESS: [217, 119, 6], // amber-600
  DONE: [22, 163, 74], // green-600
};

function formatDueDateFull(dueDate: string | null): string {
  if (!dueDate) return "Tanpa tenggat";
  const date = new Date(dueDate);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function assigneeLabel(task: Task): string {
  return task.assignee?.name ?? "Belum Ditugaskan";
}

// Susun task top-level per status, dengan subtask masing-masing menempel
// tepat di bawah induknya. Berbeda dari sortTasksForReport di
// report-format.ts, di sini pengelompokan UTAMA adalah per status (bukan
// daftar tunggal berurutan) — task dikelompokkan ke status TASK INDUK-nya,
// subtask ikut di situ juga meski status subtask itu sendiri berbeda,
// supaya struktur task->subtask tidak terpecah ke grup status yang beda.
function groupTasksByStatus(tasks: Task[]): Record<Status, { parent: Task; children: Task[] }[]> {
  const topLevel = tasks.filter((t) => !t.parentId);
  const subtasksByParent = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = subtasksByParent.get(t.parentId) ?? [];
    list.push(t);
    subtasksByParent.set(t.parentId, list);
  }

  const result: Record<Status, { parent: Task; children: Task[] }[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  for (const parent of [...topLevel].sort((a, b) => a.title.localeCompare(b.title))) {
    const children = (subtasksByParent.get(parent.id) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
    result[parent.status].push({ parent, children });
  }

  return result;
}

// Generate PDF dan langsung memicu download di browser.
// `projectName` dipakai di judul dokumen & nama file.
export function exportTasksToPdf(projectName: string, tasks: Task[]): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const maxTextWidth = pageWidth - marginX * 2;
  let y = 50;

  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  }

  // --- Header dokumen ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Laporan Task — ${projectName}`, marginX, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(`Dibuat: ${today}`, marginX, y);
  y += 14;
  doc.text(`Total: ${tasks.filter((t) => !t.parentId).length} task utama`, marginX, y);
  y += 20;
  doc.setTextColor(0);

  const grouped = groupTasksByStatus(tasks);

  for (const status of STATUS_ORDER) {
    const items = grouped[status];

    ensureSpace(40);

    // --- Judul grup status ---
    const [r, g, b] = STATUS_COLOR[status];
    doc.setFillColor(r, g, b);
    doc.rect(marginX, y - 12, 4, 16, "F"); // aksen garis warna di kiri judul
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(r, g, b);
    doc.text(`${STATUS_LABEL[status]} (${items.length})`, marginX + 12, y);
    doc.setTextColor(0);
    y += 18;

    if (items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("Tidak ada task di status ini.", marginX + 12, y);
      doc.setTextColor(0);
      y += 20;
      continue;
    }

    for (const { parent, children } of items) {
      y = renderTaskBlock(doc, parent, marginX, y, maxTextWidth, ensureSpace, false);
      for (const child of children) {
        y = renderTaskBlock(doc, child, marginX, y, maxTextWidth, ensureSpace, true);
      }
    }

    y += 10; // jarak antar grup status
  }

  const fileSafeName = projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const dateSuffix = new Date().toISOString().slice(0, 10);
  doc.save(`laporan-task-${fileSafeName}-${dateSuffix}.pdf`);
}

// Render satu blok task (judul, meta, deskripsi, kategori) ke posisi Y saat
// ini, mengembalikan Y baru setelah blok itu. `isChild` menambah indentasi
// & prefix "↳" untuk subtask, sama seperti pola report WA.
function renderTaskBlock(
  doc: jsPDF,
  task: Task,
  marginX: number,
  startY: number,
  maxTextWidth: number,
  ensureSpace: (h: number) => void,
  isChild: boolean
): number {
  let y = startY;
  const indent = isChild ? 16 : 0;
  const textWidth = maxTextWidth - indent;

  ensureSpace(50);

  // Judul task
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const titlePrefix = isChild ? "↳ " : "• ";
  const titleLines: string[] = doc.splitTextToSize(
    `${titlePrefix}${task.title}`,
    textWidth
  );
  doc.text(titleLines, marginX + indent, y);
  y += titleLines.length * 13;

  // Baris meta: assignee | prioritas | kategori | due date
  const metaParts = [
    `Assignee: ${assigneeLabel(task)}`,
    `Prioritas: ${PRIORITY_LABEL[task.priority]}`,
  ];
  if (task.category) metaParts.push(`Kategori: ${task.category.name}`);
  metaParts.push(`Tenggat: ${formatDueDateFull(task.dueDate)}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const metaText = metaParts.join("   |   ");
  const metaLines: string[] = doc.splitTextToSize(metaText, textWidth);
  ensureSpace(metaLines.length * 11 + 4);
  doc.text(metaLines, marginX + indent, y);
  y += metaLines.length * 11 + 2;
  doc.setTextColor(0);

  // Deskripsi (kalau ada)
  if (task.description && task.description.trim() !== "") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110);
    const descLines: string[] = doc.splitTextToSize(task.description.trim(), textWidth);
    ensureSpace(descLines.length * 11 + 4);
    doc.text(descLines, marginX + indent, y);
    y += descLines.length * 11 + 2;
    doc.setTextColor(0);
  }

  y += 8; // jarak setelah satu blok task
  return y;
}
