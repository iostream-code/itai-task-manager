"use client";

import { useState } from "react";
import { ProjectMember } from "@/lib/types";

type MemberListProps = {
  members: ProjectMember[];
  isAdmin: boolean;
  onAddClick: () => void;
  onRemove: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: string) => Promise<void>;
};

export default function MemberList({
  members,
  isAdmin,
  onAddClick,
  onRemove,
  onUpdateRole,
}: MemberListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(member: ProjectMember) {
    setEditingId(member.id);
    setEditValue(member.role);
  }

  async function saveEdit(memberId: string) {
    if (!editValue.trim()) return;
    await onUpdateRole(memberId, editValue.trim());
    setEditingId(null);
  }

  async function handleRemove(memberId: string, name: string) {
    const confirmed = window.confirm(`Keluarkan ${name} dari project ini?`);
    if (!confirmed) return;
    await onRemove(memberId);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Anggota Project ({members.length})
        </h2>
        {isAdmin && (
          <button
            onClick={onAddClick}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            + Tambah Anggota
          </button>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {members.length === 0 && (
          <li className="px-4 py-6 text-sm text-slate-400 text-center">Belum ada anggota</li>
        )}
        {members.map((member) => (
          <li key={member.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">
                {member.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {member.user.name}
                  {member.user.role === "admin" && (
                    <span className="ml-1.5 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {editingId === member.id ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(member.id)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                    {member.role}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => startEdit(member)}
                        className="text-xs text-slate-400 hover:text-indigo-600"
                        aria-label="Ubah peran"
                      >
                        Ubah
                      </button>
                      <button
                        onClick={() => handleRemove(member.id, member.user.name)}
                        className="text-xs text-slate-400 hover:text-red-500"
                        aria-label="Keluarkan anggota"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
