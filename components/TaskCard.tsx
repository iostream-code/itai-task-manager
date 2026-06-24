"use client";

import { Task, PRIORITY_LABEL, PRIORITY_BADGE } from "@/lib/types";

type TaskCardProps = {
  task: Task;
  onClick: () => void;
  onDelete: () => void;
};

// Komponen ini "dumb" — cuma menampilkan data dan memanggil
// callback (onClick, onDelete) yang dikasih dari parent.
// Pola ini bikin komponen mudah dipakai ulang & ditest.
export default function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-800 leading-snug">
          {task.title}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation(); // jangan trigger onClick kartu juga
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity text-xs shrink-0"
          aria-label="Hapus task"
        >
          ✕
        </button>
      </div>

      {task.description && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
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

        {task.assignee && (
          <div
            className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center justify-center shrink-0"
            title={task.assignee.name}
          >
            {task.assignee.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {dueDateLabel && (
        <div className="mt-2 text-[11px] text-slate-400">
          Jatuh tempo: {dueDateLabel}
        </div>
      )}
    </div>
  );
}
