// Tipe-tipe ini "mirror" dari schema Prisma, dipakai supaya komponen
// React tau bentuk data yang akan diterima (autocomplete + type-safety).

export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type GlobalRole = "admin" | "member";

// NOTE: tipe `User` ini dipakai di frontend untuk data publik saja —
// TIDAK pernah menyertakan field `password`. Field password hanya ada
// di Prisma model & dipakai saat verifikasi login (lihat auth.ts).
export type User = {
  id: string;
  name: string;
  email: string;
  role: GlobalRole;
};

// Satu baris keanggotaan: user X di project Y, dengan peran kerja Z
// (Z bebas teks, contoh: "Project Lead", "Developer", "QA")
export type ProjectMember = {
  id: string;
  role: string;
  projectId: string;
  userId: string;
  user: User;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdById: string | null;
  members: ProjectMember[];
  // Disertakan di endpoint list, dipakai untuk tampilkan jumlah task dsb
  _count?: { tasks: number };
};

export type Category = {
  id: string;
  name: string;
  color: string;
  projectId: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  assigneeId: string | null;
  categoryId: string | null;
  assignee: User | null;
  category: Category | null;
};

// Label & warna untuk ditampilkan di UI (bukan dari database)
export const STATUS_LABEL: Record<Status, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  HIGH: "bg-red-100 text-red-700 border-red-200",
};
