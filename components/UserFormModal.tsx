"use client";

import { useState, useEffect } from "react";
import { User, GlobalRole } from "@/lib/types";

type UserFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    email: string;
    role: GlobalRole;
    password?: string;
  }) => Promise<void>;
  // Kalau diberikan, modal masuk mode EDIT (prefill dari data user ini,
  // password jadi opsional — kosongkan berarti "jangan ganti password").
  // Kalau null/undefined, modal mode TAMBAH user baru (password wajib).
  user?: User | null;
};

export default function UserFormModal({
  isOpen,
  onClose,
  onSubmit,
  user = null,
}: UserFormModalProps) {
  const isEditing = user !== null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GlobalRole>("member");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Prefill form setiap kali modal dibuka dengan user yang berbeda
  // (atau dikosongkan lagi kalau user-nya null / mode tambah). Dibungkus
  // setTimeout(0) supaya bukan setState langsung di body effect (pola yang
  // sama dipakai di ProjectFormModal.tsx).
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setName(user?.name ?? "");
        setEmail(user?.email ?? "");
        setRole(user?.role ?? "member");
        setPassword("");
        setError("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim()) {
      setError("Nama dan email wajib diisi");
      return;
    }
    if (!isEditing && password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (isEditing && password !== "" && password.length < 8) {
      setError("Password minimal 8 karakter (atau kosongkan supaya tidak diganti)");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        role,
        ...(password !== "" ? { password } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan user. Coba lagi.");
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
            {isEditing ? "Edit Anggota" : "Tambah Anggota Baru"}
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
              Nama <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@indokoper.id"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role Global
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as GlobalRole)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Admin otomatis punya akses ke semua project.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password {isEditing ? "" : <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? "Kosongkan jika tidak diganti" : "Minimal 8 karakter"}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              {isSaving ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Tambah Anggota"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
