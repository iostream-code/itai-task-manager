"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CornerDownRight } from "lucide-react";
import { Task, PRIORITY_LABEL, PRIORITY_BADGE, STATUS_LABEL } from "@/lib/types";

type TimelineProps = {
  // Daftar RATA (flat) semua task, termasuk subtask, dalam project ini —
  // lihat GET /api/tasks?...&flat=1 di app/projects/[id]/page.tsx.
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  isLoading: boolean;
};

const DAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Senin sebagai awal minggu (konvensi umum di Indonesia), bukan Minggu.
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Minggu, 1=Senin, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, diffToMonday));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Task dianggap "menyentuh" suatu hari kalau hari itu berada di rentang
// [createdAt, dueDate] (inklusif keduanya). Task tanpa dueDate TIDAK pernah
// muncul di Timeline sama sekali (sesuai definisi yang diminta) — dicek di
// pemanggil lewat memfilter task yang dueDate-nya null sebelum dikirim ke
// komponen ini, tapi kita jaga juga di sini untuk keamanan.
function taskTouchesDay(task: Task, day: Date): boolean {
  if (!task.dueDate) return false;
  const due = startOfDay(new Date(task.dueDate));
  const created = startOfDay(new Date(task.createdAt));
  const target = startOfDay(day);
  // Kalau data anomali (dueDate sebelum createdAt), tetap anggap valid
  // untuk 1 hari itu saja (due date-nya).
  const rangeStart = created <= due ? created : due;
  const rangeEnd = created <= due ? due : created;
  return target >= rangeStart && target <= rangeEnd;
}

export default function Timeline({ tasks, onTaskClick, isLoading }: TimelineProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Hanya task yang punya dueDate yang relevan untuk Timeline.
  const tasksWithDueDate = useMemo(() => tasks.filter((t) => t.dueDate !== null), [tasks]);

  const weekRangeLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const startLabel = weekStart.toLocaleDateString("id-ID", {
      day: "numeric",
      month: sameMonth ? undefined : "short",
    });
    const endLabel = end.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${startLabel} — ${endLabel}`;
  }, [weekStart]);

  function goToPreviousWeek() {
    setWeekStart((prev) => addDays(prev, -7));
  }

  function goToNextWeek() {
    setWeekStart((prev) => addDays(prev, 7));
  }

  function goToThisWeek() {
    setWeekStart(startOfWeek(new Date()));
  }

  if (isLoading) {
    return <div className="text-center text-sm text-slate-400 py-16">Memuat timeline...</div>;
  }

  const today = new Date();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={goToPreviousWeek}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Minggu sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Minggu selanjutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToThisWeek}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 ml-2"
          >
            Minggu Ini
          </button>
        </div>
        <span className="text-sm font-semibold text-slate-700">{weekRangeLabel}</span>
      </div>

      <div className="space-y-2">
        {weekDays.map((day) => {
          const dayTasks = tasksWithDueDate.filter((t) => taskTouchesDay(t, day));
          const isToday = isSameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={`bg-white border rounded-xl overflow-hidden ${
                isToday ? "border-indigo-300 ring-1 ring-indigo-100" : "border-slate-200"
              }`}
            >
              <div
                className={`px-4 py-2 flex items-center justify-between ${
                  isToday ? "bg-indigo-50" : "bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isToday ? "text-indigo-700" : "text-slate-700"}`}>
                    {DAY_LABELS[day.getDay()]}, {day.toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-medium text-indigo-600 bg-white px-1.5 py-0.5 rounded-full border border-indigo-200">
                      Hari Ini
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{dayTasks.length} task</span>
              </div>

              {dayTasks.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-300 italic">Tidak ada task</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dayTasks.map((task) => {
                    const isDueToday = task.dueDate && isSameDay(new Date(task.dueDate), day);
                    return (
                      <li key={task.id}>
                        <button
                          onClick={() => onTaskClick(task)}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors"
                        >
                          {task.parentId && (
                            <CornerDownRight
                              className="w-3.5 h-3.5 text-slate-300 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span className="text-sm text-slate-800 truncate flex-1 min-w-0">
                            {task.title}
                          </span>
                          {isDueToday && (
                            <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200 shrink-0">
                              Jatuh Tempo
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">
                            {STATUS_LABEL[task.status]}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${PRIORITY_BADGE[task.priority]}`}
                          >
                            {PRIORITY_LABEL[task.priority]}
                          </span>
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
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
