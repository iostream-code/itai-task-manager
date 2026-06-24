"use client";

import { useState, useEffect } from "react";
import { Project } from "@/lib/types";

type ProjectFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  // Kalau diberikan, modal masuk mode EDIT: form di-prefill dari data
  // project ini, judul & tombol berubah jadi "Edit Project" / "Simpan
  // Perubahan". Kalau tidak ada (undefined), modal mode TAMBAH seperti biasa.
  project?: Project | null;
};

export default function ProjectFormModal({
  isOpen,
  onClose,
  onSubmit,
  project = null,
}: ProjectFormModalProps) {
  const isEditing = project !== null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Prefill form setiap kali modal dibuka dengan project yang berbeda
  // (atau dikosongkan lagi kalau project-nya null / mode tambah).
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setName(project?.name ?? "");
        setDescription(project?.description ?? "");
        setError("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Nama project wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() });
      onClose();
    } catch {
      setError(isEditing ? "Gagal menyimpan perubahan. Coba lagi." : "Gagal membuat project. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
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
          <h2 className="font-semibold text-slate-800">
            {isEditing ? "Edit Project" : "Tambah Project Baru"}
          </h2>
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
              Nama Project <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Internal Tools"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Deskripsi
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Penjelasan singkat tentang project ini (opsional)"
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
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
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg"
            >
              {isSaving
                ? "Menyimpan..."
                : isEditing
                  ? "Simpan Perubahan"
                  : "Buat Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}