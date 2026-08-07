"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FileDown, FileText } from "lucide-react";
import {
  Task,
  User,
  Category,
  Status,
  Project,
  ProjectMember as ProjectMemberType,
} from "@/lib/types";
import { exportTasksToPdf } from "@/lib/pdf-export";
import TaskListTree from "@/components/TaskListTree";
import FilterBar from "@/components/FilterBar";
import TaskFormModal, { TaskFormData } from "@/components/TaskFormModal";
import MemberList from "@/components/MemberList";
import AddMemberModal from "@/components/AddMemberModal";
import CategoryManager from "@/components/CategoryManager";
import WhatsAppReportModal from "@/components/WhatsAppReportModal";
import TaskHistoryList from "@/components/TaskHistoryList";
import Timeline from "@/components/Timeline";

type Tab = "board" | "timeline" | "members" | "history";

// projectId dianggap valid kalau ada isinya DAN bukan string literal
// "undefined"/"null" — kondisi terakhir ini bisa terjadi kalau ada link atau
// callbackUrl lama yang menyimpan path rusak seperti "/projects/undefined"
// (misalnya sisa dari percobaan navigasi saat data project belum termuat).
function isValidProjectId(id: string | string[] | undefined): id is string {
  return typeof id === "string" && id !== "" && id !== "undefined" && id !== "null";
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectIdParam = params.id;
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const isLeader = session?.user?.role === "leader";
  // Admin & leader boleh kelola anggota project (leader terbatas ke dirinya
  // sendiri/stafnya sendiri — sudah ditegakkan di API). Staff tidak boleh.
  const canManageMembers = isAdmin || isLeader;

  // Kalau id di URL tidak valid, langsung lempar balik ke /projects alih-alih
  // mencoba fetch (yang pasti gagal) dan menampilkan pesan error generic yang
  // membingungkan seolah-olah server/database bermasalah.
  useEffect(() => {
    if (!isValidProjectId(projectIdParam)) {
      router.replace("/projects");
    }
  }, [projectIdParam, router]);

  const projectId = isValidProjectId(projectIdParam) ? projectIdParam : "";

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
  // Kalau terisi, TaskFormModal masuk mode "Tambah Subtask" untuk task ini.
  // null saat mode tambah task biasa / edit.
  const [parentTaskForSubtask, setParentTaskForSubtask] = useState<Task | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTasks, setReportTasks] = useState<Task[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);

  // History: task DONE yang sudah lewat H+1, diambil terpisah dari task
  // aktif (lihat query param view=history di GET /api/tasks).
  const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Timeline: daftar RATA (flat=1) semua task termasuk subtask, supaya tiap
  // task individual bisa ditaruh di hari masing-masing. Dimuat malas, hanya
  // saat tab Timeline pertama kali dibuka.
  const [timelineTasks, setTimelineTasks] = useState<Task[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [timelineLoaded, setTimelineLoaded] = useState(false);

  // --- Fetch helpers ---
  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) throw new Error("Gagal mengambil data project");
    setProject(await res.json());
  }, [projectId]);

  // view=active (default) -> task DONE yang sudah lewat 24 jam otomatis
  // disembunyikan dari sini karena sudah "pindah" ke tab History.
  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams({ projectId, view: "active" });
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (assigneeFilter) params.set("assigneeId", assigneeFilter);

    const res = await fetch(`/api/tasks?${params.toString()}`);
    if (!res.ok) throw new Error("Gagal mengambil task");
    setTasks(await res.json());
  }, [projectId, categoryFilter, assigneeFilter]);

  // view=history -> HANYA task DONE yang sudah lewat H+1. Dipanggil malas
  // (lazy), hanya saat tab History pertama kali dibuka, supaya tidak
  // menambah beban fetch di kunjungan awal halaman.
  const fetchHistoryTasks = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}&view=history`);
      if (!res.ok) throw new Error();
      setHistoryTasks(await res.json());
      setHistoryLoaded(true);
    } catch {
      setErrorMsg("Gagal memuat riwayat task");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [projectId]);

  // Timeline butuh SEMUA task (top-level + subtask) sebagai daftar rata,
  // tanpa filter kategori/assignee yang sedang aktif di tab Daftar Task —
  // supaya kalender selalu menampilkan gambaran lengkap. Task yang sudah
  // masuk History (DONE > H+1) TETAP disertakan (view=all) supaya jejak
  // riwayatnya masih terlihat di kalender.
  const fetchTimelineTasks = useCallback(async () => {
    setIsTimelineLoading(true);
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}&view=all&flat=1`);
      if (!res.ok) throw new Error();
      setTimelineTasks(await res.json());
      setTimelineLoaded(true);
    } catch {
      setErrorMsg("Gagal memuat timeline");
    } finally {
      setIsTimelineLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // projectId kosong berarti param URL tidak valid dan guard di atas
    // sedang memproses redirect ke /projects — jangan fetch apa pun di sini,
    // supaya tidak ada request ".../undefined" yang terkirim dan tidak ada
    // pesan error yang sempat berkedip sebelum redirect selesai.
    if (!projectId) return;

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

  // Muat data History begitu tab-nya pertama kali dibuka. Dibungkus
  // setTimeout(0) supaya pemanggilan fetch (yang ujung-ujungnya setState)
  // tidak terjadi sinkron di body effect.
  useEffect(() => {
    if (activeTab === "history" && !historyLoaded) {
      const timer = setTimeout(() => {
        fetchHistoryTasks();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, historyLoaded, fetchHistoryTasks]);

  // Sama untuk Timeline — dimuat malas saat tab-nya pertama kali dibuka.
  useEffect(() => {
    if (activeTab === "timeline" && !timelineLoaded) {
      const timer = setTimeout(() => {
        fetchTimelineTasks();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, timelineLoaded, fetchTimelineTasks]);

  // --- Filter handlers (fetch ulang task saat filter berubah) ---
  async function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    try {
      const params = new URLSearchParams({ projectId, view: "active" });
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
      const params = new URLSearchParams({ projectId, view: "active" });
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

    // parentId hanya relevan saat CREATE (subtask baru). Saat edit, field
    // ini diabaikan API (lihat catatan di app/api/tasks/[id]/route.ts) jadi
    // tidak perlu dikirim ulang.
    const payload = isEditing
      ? formData
      : { ...formData, projectId, parentId: formData.parentId || undefined };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Gagal menyimpan task");
    await fetchTasks();
    // Timeline & History bisa terpengaruh (tanggal/status berubah) —
    // tandai perlu refresh berikutnya kali tab itu dibuka lagi.
    setTimelineLoaded(false);
  }

  async function handleDeleteTask(taskId: string) {
    const confirmed = window.confirm(
      "Yakin ingin menghapus task ini? Kalau task ini punya subtask, semua subtask-nya juga akan ikut terhapus."
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchTasks();
      setTimelineLoaded(false);
    } catch {
      setErrorMsg("Gagal menghapus task");
    }
  }

  // Ubah status lewat dropdown di List Tree (menggantikan drag-and-drop
  // Kanban board sebelumnya). Optimistic update: tampilan berubah duluan,
  // baru menunggu response server. Task bisa berada di level TOP-LEVEL atau
  // sebagai SUBTASK bersarang di dalam task.subtasks — helper di bawah
  // mengupdate keduanya, apa pun levelnya.
  function updateTaskStatusInTree(prevTasks: Task[], taskId: string, newStatus: Status): Task[] {
    return prevTasks.map((t) => {
      if (t.id === taskId) return { ...t, status: newStatus };
      if (t.subtasks?.some((s) => s.id === taskId)) {
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === taskId ? { ...s, status: newStatus } : s
          ),
        };
      }
      return t;
    });
  }

  async function handleStatusChange(taskId: string, newStatus: Status) {
    setTasks((prev) => updateTaskStatusInTree(prev, taskId, newStatus));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      // Task yang baru saja DONE tetap tampil di board sampai H+1 (lihat
      // filter view=active di backend), jadi tidak perlu fetchTasks ulang.
      // Tapi kalau nanti tab History/Timeline sudah pernah dibuka, tandai
      // perlu refresh berikutnya supaya tetap akurat.
      setHistoryLoaded(false);
      setTimelineLoaded(false);
    } catch {
      setErrorMsg("Gagal mengubah status, mengembalikan tampilan...");
      await fetchTasks();
    }
  }

  function openAddTaskModal() {
    setEditingTask(null);
    setParentTaskForSubtask(null);
    setIsTaskModalOpen(true);
  }

  function openAddSubtaskModal(parentTask: Task) {
    setEditingTask(null);
    setParentTaskForSubtask(parentTask);
    setIsTaskModalOpen(true);
  }

  function openEditTaskModal(task: Task) {
    setEditingTask(task);
    setParentTaskForSubtask(null);
    setIsTaskModalOpen(true);
  }

  // --- Report handler ---
  // Report SELALU mengambil SEMUA task project (view=all, flat=1) tanpa
  // terpengaruh filter kategori/assignee yang sedang aktif, MAUPUN tanpa
  // terpengaruh pemisahan History — laporan tetap mencakup task yang sudah
  // lama Done. flat=1 supaya subtask ikut sebagai baris tersendiri (lihat
  // lib/report-format.ts untuk cara subtask ditampilkan dengan indentasi).
  async function openReportModal() {
    setIsReportModalOpen(true);
    setIsReportLoading(true);
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}&view=all&flat=1`);
      if (!res.ok) throw new Error();
      setReportTasks(await res.json());
    } catch {
      setErrorMsg("Gagal memuat data untuk report");
      setReportTasks(tasks); // fallback: pakai data yang sudah ada di state
    } finally {
      setIsReportLoading(false);
    }
  }

  // --- Export PDF handler ---
  // Beda dari Report WA: PDF HANYA mencakup task AKTIF (view=active, sama
  // seperti yang tampil di tab Daftar Task) — task yang sudah masuk History
  // (Done > H+1) SENGAJA tidak diikutkan, karena PDF ini dimaksudkan untuk
  // dokumen status kerja saat ini, bukan arsip. flat=1 supaya subtask ikut
  // sebagai baris tersendiri (dikelompokkan ke induknya oleh lib/pdf-export.ts).
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  async function handleExportPdf() {
    if (!project) return;
    setIsExportingPdf(true);
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}&view=active&flat=1`);
      if (!res.ok) throw new Error();
      const activeTasks: Task[] = await res.json();
      exportTasksToPdf(project.name, activeTasks);
    } catch {
      setErrorMsg("Gagal membuat PDF");
    } finally {
      setIsExportingPdf(false);
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

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
            {isExportingPdf ? "Membuat PDF..." : "Export PDF"}
          </button>

          <button
            onClick={openReportModal}
            className="text-sm font-medium text-white bg-[#075E54] hover:bg-[#064a44] px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
            Report
          </button>
        </div>
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
          Daftar Task
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "timeline"
            ? "border-indigo-600 text-indigo-600"
            : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
        >
          Timeline
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
        <button
          onClick={() => setActiveTab("history")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "history"
            ? "border-indigo-600 text-indigo-600"
            : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
        >
          History
        </button>
      </div>

      {activeTab === "members" ? (
        <>
          <MemberList
            members={members}
            isAdmin={canManageMembers}
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
      ) : activeTab === "history" ? (
        <TaskHistoryList tasks={historyTasks} isLoading={isHistoryLoading} />
      ) : activeTab === "timeline" ? (
        <>
          <Timeline
            tasks={timelineTasks}
            onTaskClick={openEditTaskModal}
            isLoading={isTimelineLoading}
          />
          <TaskFormModal
            key={editingTask ? editingTask.id : "timeline-edit"}
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            onSubmit={handleSubmitTask}
            task={editingTask}
            users={members.map((m) => m.user)}
            categories={categories}
            currentUser={session?.user ? { id: session.user.id, name: session.user.name ?? "", role: session.user.role } : null}
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

          <TaskListTree
            tasks={tasks}
            onTaskClick={openEditTaskModal}
            onTaskDelete={handleDeleteTask}
            onStatusChange={handleStatusChange}
            onAddSubtask={openAddSubtaskModal}
          />

          <TaskFormModal
            key={editingTask ? editingTask.id : parentTaskForSubtask ? `subtask-of-${parentTaskForSubtask.id}` : "new"}
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            onSubmit={handleSubmitTask}
            task={editingTask}
            users={members.map((m) => m.user)}
            categories={categories}
            parentTask={parentTaskForSubtask}
            currentUser={session?.user ? { id: session.user.id, name: session.user.name ?? "", role: session.user.role } : null}
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
