"use client";

import { User, Category } from "@/lib/types";

type FilterBarProps = {
  users: User[];
  categories: Category[];
  selectedCategoryId: string;
  selectedAssigneeId: string;
  onCategoryChange: (categoryId: string) => void;
  onAssigneeChange: (assigneeId: string) => void;
  onAddClick: () => void;
};

export default function FilterBar({
  users,
  categories,
  selectedCategoryId,
  selectedAssigneeId,
  onCategoryChange,
  onAssigneeChange,
  onAddClick,
}: FilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedCategoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={selectedAssigneeId}
          onChange={(e) => onAssigneeChange(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Semua Anggota</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onAddClick}
        className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
      >
        + Tambah Task
      </button>
    </div>
  );
}
