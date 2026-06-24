import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/auth-helpers";

// Di Next.js 15+, params sekarang berupa Promise — harus di-await.
type RouteParams = { params: Promise<{ id: string }> };

// GET /api/tasks/:id — ambil satu task spesifik
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { assignee: true, category: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task tidak ditemukan" }, { status: 404 });
  }

  const hasAccess = await canAccessProject(task.projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }

  return NextResponse.json(task);
}

// PATCH /api/tasks/:id — update sebagian field task
// (dipakai juga untuk drag-and-drop ubah status di board)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Ambil task dulu untuk tahu projectId-nya, supaya bisa dicek akses
  // SEBELUM melakukan update apa pun.
  const existingTask = await prisma.task.findUnique({ where: { id } });
  if (!existingTask) {
    return NextResponse.json({ error: "Task tidak ditemukan" }, { status: 404 });
  }

  const hasAccess = await canAccessProject(existingTask.projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, description, status, priority, dueDate, assigneeId, categoryId } = body;

    // Hanya masukkan field yang memang dikirim oleh client.
    // Ini supaya PATCH parsial (misal cuma update status) tidak
    // menimpa field lain jadi null/undefined.
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (categoryId !== undefined) data.categoryId = categoryId || null;

    const task = await prisma.task.update({
      where: { id },
      data,
      include: { assignee: true, category: true },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error(`PATCH /api/tasks/${id} error:`, error);
    return NextResponse.json({ error: "Gagal mengupdate task" }, { status: 500 });
  }
}

// DELETE /api/tasks/:id
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const existingTask = await prisma.task.findUnique({ where: { id } });
  if (!existingTask) {
    return NextResponse.json({ error: "Task tidak ditemukan" }, { status: 404 });
  }

  const hasAccess = await canAccessProject(existingTask.projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }

  try {
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ message: "Task berhasil dihapus" });
  } catch (error) {
    console.error(`DELETE /api/tasks/${id} error:`, error);
    return NextResponse.json({ error: "Gagal menghapus task" }, { status: 500 });
  }
}
