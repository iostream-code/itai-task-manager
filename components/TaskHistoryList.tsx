"use client";

import { Task, PRIORITY_LABEL, PRIORITY_BADGE } from "@/lib/types";

type TaskHistoryListProps = {
  tasks: Task[];
  isLoading: boolean;
};

// Daftar task yang sudah "pindah" ke History: task berstatus DONE yang
// sudah lebih dari 24 jam sejak terakhir diupdate (lihat filter view=history
// di app/api/tasks/route.ts). Read-only — tidak ada tombol ubah status atau
// hapus di sini, supaya History betul-betul jadi arsip, bukan tempat kerja.
export default function TaskHistoryList({ tasks, isLoading }: TaskHistoryListProps) {
  if (isLoading) {
    return <div className="text-center text-sm text-slate-400 py-16">Memuat riwayat...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center text-sm text-slate-400 py-16 border-2 border-dashed border-slate-200 rounded-xl">
        Belum ada task yang masuk History. Task otomatis pindah ke sini 24 jam
        setelah statusnya diubah menjadi &quot;Done&quot;.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <ul className="divide-y divide-slate-100">
        {tasks.map((task) => {
          const completedLabel = new Date(task.updatedAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <li key={task.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 line-through decoration-slate-300">
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${PRIORITY_BADGE[task.priority]}`}
                  >
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                  {task.category && (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
                      style={{ backgroundColor: task.category.color }}
                    >
                      {task.category.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                <span>Selesai: {completedLabel}</span>
                {task.assignee && <span>Assignee: {task.assignee.name}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
