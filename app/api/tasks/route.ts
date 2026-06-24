import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/auth-helpers";

// GET /api/tasks?projectId=xxx
// Mengambil task DI DALAM satu project, bisa difilter lewat query string
// tambahan, contoh: /api/tasks?projectId=xxx&status=TODO&categoryId=abc123
//
// projectId WAJIB — task selalu terikat ke satu project, dan kita harus
// tahu project mana untuk mengecek apakah user yang request punya akses.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const categoryId = searchParams.get("categoryId");
  const assigneeId = searchParams.get("assigneeId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId wajib diisi" }, { status: 400 });
  }

  const hasAccess = await canAccessProject(projectId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Kamu tidak punya akses ke project ini" },
      { status: 403 }
    );
  }

  // Bangun objek "where" secara dinamis.
  // Kalau query param tidak ada, filter itu tidak dipakai.
  const where: Record<string, string> = { projectId };
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (assigneeId) where.assigneeId = assigneeId;

  try {
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: true, // sertakan data user yang di-assign
        category: true, // sertakan data category
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data task" },
      { status: 500 }
    );
  }
}

// POST /api/tasks
// Membuat task baru. Body request berupa JSON, projectId WAJIB disertakan.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, status, priority, dueDate, assigneeId, categoryId, projectId } =
      body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId wajib diisi" }, { status: 400 });
    }

    const hasAccess = await canAccessProject(projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Kamu tidak punya akses ke project ini" },
        { status: 403 }
      );
    }

    // Validasi sederhana di server.
    // Jangan percaya 100% sama validasi di frontend saja.
    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "Judul task wajib diisi" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        status: status || "TODO",
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId || null,
        categoryId: categoryId || null,
        projectId,
      },
      include: {
        assignee: true,
        category: true,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: "Gagal membuat task" },
      { status: 500 }
    );
  }
}
