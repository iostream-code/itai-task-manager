"use client";

import { useState } from "react";
import { User } from "@/lib/types";

type AddMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { userId: string; role: string }) => Promise<void>;
  // Daftar user yang BELUM jadi anggota project ini (sudah difilter di parent)
  availableUsers: User[];
};

export default function AddMemberModal({
  isOpen,
  onClose,
  onSubmit,
  availableUsers,
}: AddMemberModalProps) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!userId) {
      setError("Pilih user yang mau ditambahkan");
      return;
    }
    if (!role.trim()) {
      setError("Peran (role) wajib diisi, contoh: Developer, QA, Project Lead");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({ userId, role: role.trim() });
      setUserId("");
      setRole("");
      onClose();
    } catch {
      setError("Gagal menambah anggota. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    setUserId("");
    setRole("");
    setError("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Tambah Anggota Project</h2>
          <button
            onClick={handleClose}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              User <span className="text-red-500">*</span>
            </label>
            {availableUsers.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                Semua user sudah menjadi anggota project ini.
              </p>
            ) : (
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              >
                <option value="">— Pilih user —</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Peran di project ini <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Contoh: Project Lead, Backend Developer, QA"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-slate-400 mt-1">
              Bebas tulis apa saja sesuai peran kerjanya di project ini.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || availableUsers.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg"
            >
              {isSaving ? "Menyimpan..." : "Tambah Anggota"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
