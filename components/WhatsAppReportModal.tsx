"use client";

import { useState, useMemo } from "react";
import { Task, STATUS_LABEL } from "@/lib/types";
import {
  groupTasksByAssignee,
  summarizeStatusCounts,
  generateWhatsAppReportText,
  formatDueDate,
} from "@/lib/report-format";

type WhatsAppReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  tasks: Task[];
  isLoading?: boolean;
};

export default function WhatsAppReportModal({
  isOpen,
  onClose,
  projectName,
  tasks,
  isLoading = false,
}: WhatsAppReportModalProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  // Hitung ulang hanya saat modal dibuka / data task berubah — tidak perlu
  // di-recompute tiap render karena tasks biasanya stabil selama modal terbuka.
  const counts = useMemo(() => summarizeStatusCounts(tasks), [tasks]);
  const groups = useMemo(() => groupTasksByAssignee(tasks), [tasks]);
  const reportText = useMemo(
    () => generateWhatsAppReportText(projectName, tasks),
    [projectName, tasks]
  );

  if (!isOpen) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]"
      >
        {/* Header ala WhatsApp: avatar bulat + nama project + status */}
        <div className="px-4 py-3 rounded-t-xl bg-[#075E54] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-semibold shrink-0">
              {projectName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{projectName}</p>
              <p className="text-[11px] text-emerald-100">Laporan Task Otomatis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-100 hover:text-white shrink-0"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Area chat: background hijau pucat + pola titik halus ala WA */}
        <div
          className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
          style={{
            backgroundColor: "#e5ddd5",
            backgroundImage:
              "radial-gradient(circle at 8px 8px, rgba(0,0,0,0.04) 1.5px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* Bubble 1: header laporan + ringkasan jumlah */}
          <ChatBubble>
            <p className="font-semibold text-[#075E54]">
              LAPORAN TASK — {projectName.toUpperCase()}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">{todayLabel}</p>
            <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
              <CountPill label="To Do" count={counts.TODO} />
              <CountPill label="In Progress" count={counts.IN_PROGRESS} />
              <CountPill label="Done" count={counts.DONE} />
            </div>
            <BubbleMeta />
          </ChatBubble>

          {isLoading ? (
            <ChatBubble>
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-[#075E54] rounded-full animate-spin" />
                Memuat data task...
              </p>
            </ChatBubble>
          ) : tasks.length === 0 ? (
            <ChatBubble>
              <p className="text-slate-500 italic text-sm">
                Belum ada task di project ini.
              </p>
              <BubbleMeta />
            </ChatBubble>
          ) : (
            groups.map((group) => (
              <ChatBubble key={group.assigneeName}>
                <p className="font-semibold text-[#075E54]">{group.assigneeName}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {group.tasks.map((task) => (
                    <TaskLine key={task.id} task={task} />
                  ))}
                </ul>
                <BubbleMeta />
              </ChatBubble>
            ))
          )}

          <ChatBubble>
            <p className="text-slate-400 italic text-xs">
              Dibuat otomatis dari Task Manager
            </p>
            <BubbleMeta />
          </ChatBubble>
        </div>

        {/* Footer: tombol copy */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 bg-white rounded-b-xl">
          {copyState === "copied" && (
            <span className="text-xs text-emerald-600 font-medium">
              ✓ Tersalin ke clipboard
            </span>
          )}
          {copyState === "error" && (
            <span className="text-xs text-red-500 font-medium">
              Gagal menyalin, coba lagi
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Tutup
          </button>
          <button
            onClick={handleCopy}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-[#075E54] hover:bg-[#064a44] disabled:opacity-50 rounded-lg"
          >
            Copy untuk WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// Satu bubble pesan, gaya WA: putih, rounded, ekor kecil di kiri atas (lewat
// border-radius asimetris), dengan sedikit shadow tipis.
function ChatBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg rounded-tl-none shadow-sm px-3 py-2 max-w-[92%] text-sm text-slate-800">
      {children}
    </div>
  );
}

// Jam kecil + centang biru ganda, persis pojok kanan-bawah bubble WA asli.
function BubbleMeta() {
  const time = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
      <span className="text-[10px] text-slate-400">{time}</span>
      <span className="text-[11px] text-[#53bdeb]">✓✓</span>
    </div>
  );
}

function CountPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="bg-slate-100 rounded-full px-2 py-0.5 text-slate-600">
      {label}: <span className="font-semibold">{count}</span>
    </span>
  );
}

function TaskLine({ task }: { task: Task }) {
  const dueDateText = formatDueDate(task.dueDate);

  const metaParts: string[] = [];
  if (task.category) metaParts.push(task.category.name);
  metaParts.push(STATUS_LABEL[task.status]);
  if (dueDateText) metaParts.push(dueDateText);

  const hasDescription = task.description && task.description.trim() !== "";

  return (
    <li className="leading-snug">
      <p>
        - {task.title} -{" "}
        <span className="font-semibold">[ {metaParts.join(" | ")} ]</span>
      </p>
      {hasDescription && (
        <p className="italic text-slate-500 text-xs pl-3 mt-0.5">{task.description}</p>
      )}
    </li>
  );
}