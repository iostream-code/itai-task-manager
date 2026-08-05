"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  Task,
  Status,
  STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITY_BADGE,
} from "@/lib/types";

type TaskListTreeProps = {
  tasks: Task[];
  onTaskClick: (task: Task) => void; // buka modal edit (dari tombol "Edit Detail")
  onTaskDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: Status) => void;
};

const COLUMNS: { status: Status; label: string; accent: string }[] = [
  { status: "TODO", label: "To Do", accent: "border-l-slate-400" },
  { status: "IN_PROGRESS", label: "In Progress", accent: "border-l-amber-400" },
  { status: "DONE", label: "Done", accent: "border-l-emerald-400" },
];

// List Tree: menggantikan Kanban Board. Task dikelompokkan per status
// sebagai grup yang bisa di-collapse, dan setiap task adalah satu baris
// yang bisa di-expand (dropdown) untuk melihat detail lengkapnya tanpa
// perlu buka modal — modal edit tetap ada untuk mengubah field lain.
export default function TaskListTree({
  tasks,
  onTaskClick,
  onTaskDelete,
  onStatusChange,
}: TaskListTreeProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<Status>>(new Set());

  function toggleTask(taskId: string) {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }

  function toggleGroup(status: Status) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {COLUMNS.map((col) => {
        const groupTasks = tasks.filter((t) => t.status === col.status);
        const isCollapsed = collapsedGroups.has(col.status);

        return (
          <div
            key={col.status}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleGroup(col.status)}
              className={`w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border-l-4 ${col.accent} hover:bg-slate-100 transition-colors`}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              </div>
              <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {groupTasks.length}
              </span>
            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-slate-100">
                {groupTasks.length === 0 && (
                  <li className="px-4 py-6 text-xs text-slate-400 text-center">
                    Tidak ada task
                  </li>
                )}
                {groupTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;
                  const dueDateLabel = task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <li key={task.id}>
                      <div
                        onClick={() => toggleTask(task.id)}
                        className="cursor-pointer px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}

                        <span className="text-sm font-medium text-slate-800 truncate flex-1 min-w-0">
                          {task.title}
                        </span>

                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${PRIORITY_BADGE[task.priority]}`}
                        >
                          {PRIORITY_LABEL[task.priority]}
                        </span>

                        {task.category && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium text-white shrink-0 hidden sm:inline-block"
                            style={{ backgroundColor: task.category.color }}
                          >
                            {task.category.name}
                          </span>
                        )}

                        {task.assignee ? (
                          <div
                            className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center justify-center shrink-0"
                            title={task.assignee.name}
                          >
                            {task.assignee.name.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <div className="w-6 h-6 shrink-0" />
                        )}
                      </div>

                      {isExpanded && (
                        <div
                          className="px-4 pb-4 pl-11 space-y-3 bg-slate-50/60"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.description && (
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">
                              {task.description}
                            </p>
                          )}

                          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                            <div>
                              <dt className="text-slate-400">Assignee</dt>
                              <dd className="text-slate-700 font-medium mt-0.5">
                                {task.assignee?.name ?? "Belum ditugaskan"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-400">Kategori</dt>
                              <dd className="text-slate-700 font-medium mt-0.5">
                                {task.category?.name ?? "Tanpa kategori"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-400">Jatuh Tempo</dt>
                              <dd className="text-slate-700 font-medium mt-0.5">
                                {dueDateLabel ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-400">Prioritas</dt>
                              <dd className="text-slate-700 font-medium mt-0.5">
                                {PRIORITY_LABEL[task.priority]}
                              </dd>
                            </div>
                          </dl>

                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <label className="text-xs text-slate-500">
                              Ubah status:
                            </label>
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                onStatusChange(task.id, e.target.value as Status)
                              }
                              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(task);
                              }}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 ml-auto"
                            >
                              Edit Detail
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onTaskDelete(task.id);
                              }}
                              className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Hapus
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
