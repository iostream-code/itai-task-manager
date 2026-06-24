import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessProject } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/:id — detail satu project + anggotanya
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const hasAccess = await canAccessProject(id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Kamu tidak punya akses ke project ini" },
      { status: 403 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(project);
}

// PATCH /api/projects/:id — update nama/deskripsi project (admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa mengubah project" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, description } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;

    const project = await prisma.project.update({
      where: { id },
      data,
      include: { members: { include: { user: true } } },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error(`PATCH /api/projects/${id} error:`, error);
    return NextResponse.json({ error: "Gagal mengupdate project" }, { status: 500 });
  }
}

// DELETE /api/projects/:id — hapus project (admin only)
// Akan ikut menghapus semua Task, Category, dan ProjectMember di project ini
// (lihat onDelete: Cascade di schema.prisma).
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa menghapus project" },
      { status: 403 }
    );
  }

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ message: "Project berhasil dihapus" });
  } catch (error) {
    console.error(`DELETE /api/projects/${id} error:`, error);
    return NextResponse.json({ error: "Gagal menghapus project" }, { status: 500 });
  }
}
