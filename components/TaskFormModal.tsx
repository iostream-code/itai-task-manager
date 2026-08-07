"use client";

import { useState } from "react";
import { Task, User, Category, Status, Priority } from "@/lib/types";

type TaskFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  task: Task | null; // null = mode "tambah baru", ada isinya = mode "edit"
  users: User[];
  categories: Category[];
  // Kalau diisi (dan task === null), modal masuk mode "Tambah Subtask":
  // judul task induk ditampilkan sebagai konteks, dan parentId otomatis
  // disertakan di data yang dikirim ke onSubmit. Diabaikan saat mode edit
  // (task tidak null) — subtask tidak bisa "dipindah induk" lewat form ini,
  // lihat catatan di app/api/tasks/[id]/route.ts.
  parentTask?: Task | null;
  // User yang sedang login. Kalau role-nya "staff", dropdown "Assign ke"
  // dikunci ke dirinya sendiri (read-only) — staff hanya boleh membuat/
  // mengelola task miliknya sendiri, tidak bisa menugaskan ke orang lain.
  currentUser?: { id: string; name: string; role: "admin" | "leader" | "staff" } | null;
};

export type TaskFormData = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string;
  assigneeId: string;
  categoryId: string;
  parentId: string;
};

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
  assigneeId: "",
  categoryId: "",
  parentId: "",
};

export default function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  task,
  users,
  categories,
  parentTask = null,
  currentUser = null,
}: TaskFormModalProps) {
  const isStaff = currentUser?.role === "staff";

  // Bangun nilai awal form langsung dari prop `task`.
  // Dipakai sebagai initializer function useState (hanya jalan sekali saat mount).
  // Supaya form ini "reset" tiap kali modal dibuka untuk task yang berbeda,
  // parent (page.tsx) memberi `key` unik pada komponen ini agar React
  // me-remount-nya — bukan lewat useEffect + setState yang bisa memicu
  // cascading render.
  function buildInitialForm(): TaskFormData {
    if (!task) {
      // Mode tambah baru. Kalau ada parentTask, ini tambah SUBTASK —
      // sertakan parentId-nya dari awal. Staff selalu default assign ke
      // dirinya sendiri (dan tidak bisa diubah, lihat dropdown di bawah).
      return {
        ...EMPTY_FORM,
        parentId: parentTask?.id ?? "",
        assigneeId: isStaff && currentUser ? currentUser.id : "",
      };
    }
    return {
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      assigneeId: task.assigneeId || "",
      categoryId: task.categoryId || "",
      parentId: task.parentId || "",
    };
  }

  const [form, setForm] = useState<TaskFormData>(buildInitialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Judul task wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch {
      setError("Gagal menyimpan task. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    // Backdrop — klik di luar modal untuk menutup
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        // stopPropagation supaya klik di dalam modal tidak menutup modal
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            {task ? "Edit Task" : parentTask ? "Tambah Subtask" : "Tambah Task Baru"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {!task && parentTask && (
            <div className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              Subtask dari: <span className="font-medium">{parentTask.title}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Judul <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Perbaiki bug login"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Deskripsi
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detail tambahan (opsional)"
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Prioritas
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Assign ke
              </label>
              {isStaff ? (
                <>
                  <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500">
                    {currentUser?.name} (kamu)
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Task yang kamu buat selalu ter-assign ke dirimu sendiri.
                  </p>
                </>
              ) : (
                <select
                  value={form.assigneeId}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— Belum ditugaskan —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Tanpa kategori —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Jatuh Tempo
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg"
            >
              {isSaving ? "Menyimpan..." : task ? "Simpan Perubahan" : parentTask ? "Tambah Subtask" : "Tambah Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
