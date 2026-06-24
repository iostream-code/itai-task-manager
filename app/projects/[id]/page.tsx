"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FileDown } from "lucide-react";
import {
  Task,
  User,
  Category,
  Status,
  Project,
  ProjectMember as ProjectMemberType,
} from "@/lib/types";
import BoardColumn from "@/components/BoardColumn";
import FilterBar from "@/components/FilterBar";
import TaskFormModal, { TaskFormData } from "@/components/TaskFormModal";
import MemberList from "@/components/MemberList";
import AddMemberModal from "@/components/AddMemberModal";
import CategoryManager from "@/components/CategoryManager";
import WhatsAppReportModal from "@/components/WhatsAppReportModal";

const COLUMNS: { status: Status; label: string }[] = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

type Tab = "board" | "members";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("board");

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTasks, setReportTasks] = useState<Task[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);

  // --- Fetch helpers ---
  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) throw new Error("Gagal mengambil data project");
    setProject(await res.json());
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams({ projectId });
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (assigneeFilter) params.set("assigneeId", assigneeFilter);

    const res = await fetch(`/api/tasks?${params.toString()}`);
    if (!res.ok) throw new Error("Gagal mengambil task");
    setTasks(await res.json());
  }, [projectId, categoryFilter, assigneeFilter]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const [usersRes, categoriesRes] = await Promise.all([
          fetch("/api/users"),
          fetch(`/api/categories?projectId=${projectId}`),
        ]);
        if (!usersRes.ok || !categoriesRes.ok) throw new Error();
        setAllUsers(await usersRes.json());
        setCategories(await categoriesRes.json());
        await fetchProject();
        await fetchTasks();
      } catch {
        setErrorMsg("Gagal memuat data. Pastikan server & database berjalan.");
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // --- Filter handlers (fetch ulang task saat filter berubah) ---
  async function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    try {
      const params = new URLSearchParams({ projectId });
      if (value) params.set("categoryId", value);
      if (assigneeFilter) params.set("assigneeId", assigneeFilter);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error();
      setTasks(await res.json());
    } catch {
      setErrorMsg("Gagal memuat task");
    }
  }

  async function handleAssigneeFilterChange(value: string) {
    setAssigneeFilter(value);
    try {
      const params = new URLSearchParams({ projectId });
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (value) params.set("assigneeId", value);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error();
      setTasks(await res.json());
    } catch {
      setErrorMsg("Gagal memuat task");
    }
  }

  // --- Task handlers ---
  async function handleSubmitTask(formData: TaskFormData) {
    const isEditing = editingTask !== null;
    const url = isEditing ? `/api/tasks/${editingTask!.id}` : "/api/tasks";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEditing ? formData : { ...formData, projectId }),
    });

    if (!res.ok) throw new Error("Gagal menyimpan task");
    await fetchTasks();
  }

  async function handleDeleteTask(taskId: string) {
    const confirmed = window.confirm("Yakin ingin menghapus task ini?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchTasks();
    } catch {
      setErrorMsg("Gagal menghapus task");
    }
  }

  async function handleDropTask(taskId: string, newStatus: Status) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setErrorMsg("Gagal memindahkan task, mengembalikan tampilan...");
      await fetchTasks();
    }
  }

  function openAddTaskModal() {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  }

  function openEditTaskModal(task: Task) {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  }

  // --- Report handler ---
  // Report SELALU mengambil semua task project tanpa terpengaruh filter
  // kategori/assignee yang sedang aktif di tab Kanban Board, supaya laporan
  // yang dikirim ke WhatsApp benar-benar mencakup seluruh project.
  async function openReportModal() {
    setIsReportModalOpen(true);
    setIsReportLoading(true);
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!res.ok) throw new Error();
      setReportTasks(await res.json());
    } catch {
      setErrorMsg("Gagal memuat data untuk report");
      setReportTasks(tasks); // fallback: pakai data yang sudah ada di state
    } finally {
      setIsReportLoading(false);
    }
  }

  // --- Member handlers ---
  async function handleAddMember(data: { userId: string; role: string }) {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Gagal menambah anggota");
    }
    await fetchProject();
  }

  async function handleRemoveMember(memberId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      await fetchProject();
    } catch {
      setErrorMsg("Gagal mengeluarkan anggota");
    }
  }

  async function handleUpdateMemberRole(memberId: string, role: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error();
      await fetchProject();
    } catch {
      setErrorMsg("Gagal mengubah peran anggota");
    }
  }

  // --- Category handlers ---
  async function handleAddCategory(data: { name: string; color: string }) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, projectId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Gagal menambah kategori");
    }
    const categoriesRes = await fetch(`/api/categories?projectId=${projectId}`);
    setCategories(await categoriesRes.json());
  }

  if (isLoading) {
    return (
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="text-center text-sm text-slate-400 py-20">Memuat data...</div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="text-center text-sm text-red-500 py-20">
          {errorMsg || "Project tidak ditemukan atau kamu tidak punya akses."}
        </div>
      </main>
    );
  }

  const members: ProjectMemberType[] = project.members;
  const memberUserIds = new Set(members.map((m) => m.userId));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <Link href="/projects" className="text-sm text-slate-400 hover:text-slate-600">
          ← Semua Project
        </Link>
      </div>

      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500 mt-0.5">{project.description}</p>
          )}
        </div>

        <button
          onClick={openReportModal}
          className="text-sm font-medium text-white bg-[#075E54] hover:bg-[#064a44] px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
        >
          <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
          Report
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

      <div className="mb-5 border-b border-slate-200 flex gap-4">
        <button
          onClick={() => setActiveTab("board")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "board"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
        >
          Kanban Board
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "members"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
        >
          Anggota ({members.length})
        </button>
      </div>

      {activeTab === "members" ? (
        <>
          <MemberList
            members={members}
            isAdmin={isAdmin}
            onAddClick={() => setIsMemberModalOpen(true)}
            onRemove={handleRemoveMember}
            onUpdateRole={handleUpdateMemberRole}
          />
          <AddMemberModal
            isOpen={isMemberModalOpen}
            onClose={() => setIsMemberModalOpen(false)}
            onSubmit={handleAddMember}
            availableUsers={availableUsers}
          />
        </>
      ) : (
        <>
          <div className="mb-3">
            <CategoryManager
              categories={categories}
              isAdmin={isAdmin}
              onAdd={handleAddCategory}
            />
          </div>

          <div className="mb-5">
            <FilterBar
              users={members.map((m) => m.user)}
              categories={categories}
              selectedCategoryId={categoryFilter}
              selectedAssigneeId={assigneeFilter}
              onCategoryChange={handleCategoryFilterChange}
              onAssigneeChange={handleAssigneeFilterChange}
              onAddClick={openAddTaskModal}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <BoardColumn
                key={col.status}
                status={col.status}
                label={col.label}
                tasks={tasks.filter((t) => t.status === col.status)}
                onTaskClick={openEditTaskModal}
                onTaskDelete={handleDeleteTask}
                onDropTask={handleDropTask}
              />
            ))}
          </div>

          <TaskFormModal
            key={editingTask ? editingTask.id : "new"}
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            onSubmit={handleSubmitTask}
            task={editingTask}
            users={members.map((m) => m.user)}
            categories={categories}
          />
        </>
      )}

      <WhatsAppReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        projectName={project.name}
        tasks={reportTasks}
        isLoading={isReportLoading}
      />
    </main>
  );
}