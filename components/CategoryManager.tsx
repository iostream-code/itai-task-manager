"use client";

import { useState } from "react";
import { Category } from "@/lib/types";

type CategoryManagerProps = {
  categories: Category[];
  isAdmin: boolean;
  onAdd: (data: { name: string; color: string }) => Promise<void>;
};

// Palet warna terbatas supaya badge kategori tetap enak dilihat & konsisten,
// daripada pakai color picker bebas yang gampang menghasilkan warna pucat
// atau terlalu terang untuk teks putih di atasnya.
const COLOR_OPTIONS = [
  { label: "Merah", value: "#ef4444" },
  { label: "Biru", value: "#3b82f6" },
  { label: "Hijau", value: "#10b981" },
  { label: "Kuning", value: "#f59e0b" },
  { label: "Ungu", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Indigo", value: "#6366f1" },
];

export default function CategoryManager({ categories, isAdmin, onAdd }: CategoryManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Nama kategori wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      await onAdd({ name: name.trim(), color });
      setName("");
      setColor(COLOR_OPTIONS[0].value);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah kategori");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {categories.map((c) => (
        <span
          key={c.id}
          className="text-[11px] px-2 py-1 rounded-full font-medium text-white"
          style={{ backgroundColor: c.color }}
        >
          {c.name}
        </span>
      ))}

      {isAdmin && (
        <>
          {isOpen ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-1.5 flex-wrap">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama kategori"
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSaving}
                className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-2.5 py-1 rounded-lg"
              >
                {isSaving ? "..." : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setError("");
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Batal
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              className="text-[11px] px-2 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              + Kategori
            </button>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </>
      )}
    </div>
  );
}
