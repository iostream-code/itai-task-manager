"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Project } from "@/lib/types";
import ProjectFormModal from "@/components/ProjectFormModal";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error("Gagal mengambil daftar project");
    setProjects(await res.json());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        await fetchProjects();
      } catch {
        setErrorMsg("Gagal memuat project. Pastikan server & database berjalan.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [fetchProjects]);

  async function handleCreateProject(data: { name: string; description: string }) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Gagal membuat project");
    await fetchProjects();
  }

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Project</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "Semua project di organisasi kamu."
              : "Project yang kamu ikuti."}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            + Tambah Project
          </button>
        )}
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
      ) : projects.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-20 border-2 border-dashed border-slate-200 rounded-xl">
          {isAdmin
            ? "Belum ada project. Klik \"Tambah Project\" untuk membuat yang pertama."
            : "Kamu belum ditambahkan ke project apa pun. Hubungi admin."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <h2 className="font-semibold text-slate-800">{project.name}</h2>
              {project.description && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{project.members.length} anggota</span>
                {project._count && <span>{project._count.tasks} task</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <ProjectFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />
    </main>
  );
}
