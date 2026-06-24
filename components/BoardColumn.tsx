"use client";

import { Task, Status } from "@/lib/types";
import TaskCard from "./TaskCard";

type BoardColumnProps = {
  status: Status;
  label: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onDropTask: (taskId: string, newStatus: Status) => void;
};

// Warna aksen tiap kolom biar gampang dibedain sekilas
const COLUMN_ACCENT: Record<Status, string> = {
  TODO: "border-t-slate-400",
  IN_PROGRESS: "border-t-amber-400",
  DONE: "border-t-emerald-400",
};

export default function BoardColumn({
  status,
  label,
  tasks,
  onTaskClick,
  onTaskDelete,
  onDropTask,
}: BoardColumnProps) {
  // HTML5 Drag and Drop API: ini native browser, tidak butuh library.
  // onDragOver harus preventDefault supaya onDrop bisa terpicu.
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      onDropTask(taskId, status);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex flex-col bg-slate-100/70 rounded-xl border-t-4 ${COLUMN_ACCENT[status]} min-h-[200px]`}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
        <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto scrollbar-thin max-h-[65vh]">
        {tasks.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
            Tidak ada task
          </div>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => {
              // Simpan id task ke dataTransfer, nanti diambil saat di-drop
              e.dataTransfer.setData("text/plain", task.id);
            }}
          >
            <TaskCard
              task={task}
              onClick={() => onTaskClick(task)}
              onDelete={() => onTaskDelete(task.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
