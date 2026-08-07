"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { User, GlobalRole, ROLE_LABEL } from "@/lib/types";
import UserFormModal from "@/components/UserFormModal";

export default function UsersPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const isLeader = session?.user?.role === "leader";
  const canManage = isAdmin || isLeader;

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users?includeInactive=1");
    if (!res.ok) throw new Error("Gagal mengambil daftar anggota");
    setUsers(await res.json());
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    async function load() {
      try {
        setIsLoading(true);
        await fetchUsers();
      } catch {
        setErrorMsg("Gagal memuat data anggota. Pastikan server & database berjalan.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [fetchUsers, status]);

  async function handleSubmitUser(data: {
    name: string;
    email: string;
    role: GlobalRole;
    leaderId?: string | null;
    password?: string;
  }) {
    const isEditing = editingUser !== null;
    const url = isEditing ? `/api/users/${editingUser!.id}` : "/api/users";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || (isEditing ? "Gagal menyimpan perubahan" : "Gagal menambah anggota"));
    }
    await fetchUsers();
  }

  async function handleToggleActive(user: User) {
    const wantActive = !user.isActive;
    const confirmed = window.confirm(
      wantActive
        ? `Aktifkan kembali ${user.name}? Dia akan bisa login lagi.`
        : `Nonaktifkan ${user.name}? Dia tidak akan bisa login lagi, tapi data & riwayat task-nya tetap tersimpan.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: wantActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Gagal mengubah status anggota");
      }
      await fetchUsers();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengubah status anggota");
    }
  }

  function openAddModal() {
    setEditingUser(null);
    setIsModalOpen(true);
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setIsModalOpen(true);
  }

  if (status !== "loading" && !canManage) {
    return (
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="text-center text-sm text-red-500 py-20">
          Halaman ini hanya bisa diakses oleh admin atau leader.
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Anggota</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "Semua user di sistem, terlepas dari project. Kelola akun, role, dan status aktif."
              : "Staf yang melekat padamu. Kelola akun dan status aktif mereka."}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          + Tambah {isAdmin ? "Anggota" : "Staf"}
        </button>
      </header>

      {errorMsg && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-sm text-slate-400 py-20">Memuat data...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl">
          <ul className="divide-y divide-slate-100">
            {users.map((user) => (
              <li
                key={user.id}
                className={`px-4 py-3 flex items-center justify-between gap-3 ${
                  !user.isActive ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-1.5">
                      {user.name}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          user.role === "admin"
                            ? "text-indigo-600 bg-indigo-50"
                            : user.role === "leader"
                              ? "text-amber-600 bg-amber-50"
                              : "text-slate-500 bg-slate-100"
                        }`}
                      >
                        {ROLE_LABEL[user.role]}
                      </span>
                      {!user.isActive && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {user.email}
                      {user.role === "staff" && user.leader && (
                        <span className="text-slate-400"> · Leader: {user.leader.name}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => openEditModal(user)}
                    className="text-xs text-slate-400 hover:text-indigo-600"
                  >
                    Ubah
                  </button>
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`text-xs font-medium ${
                      user.isActive
                        ? "text-slate-400 hover:text-red-500"
                        : "text-emerald-600 hover:text-emerald-700"
                    }`}
                  >
                    {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <UserFormModal
        key={editingUser ? editingUser.id : "new"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitUser}
        user={editingUser}
        currentUserRole={(session?.user?.role as GlobalRole) ?? "staff"}
      />
    </main>
  );
}
