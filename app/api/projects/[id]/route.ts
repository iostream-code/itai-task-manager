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

  const currentUser = await getCurrentUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberWhere: Record<string, any> = {};
  if (currentUser?.role === "leader") {
    memberWhere.user = { OR: [{ id: currentUser.id }, { leaderId: currentUser.id }] };
  } else if (currentUser?.role === "staff") {
    memberWhere.userId = currentUser.id;
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: { where: memberWhere, include: { user: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(project);
}

// PATCH /api/projects/:id — update nama/deskripsi project.
// Admin bebas. Leader HANYA boleh mengubah project yang dia buat sendiri
// (createdById = dirinya) — bukan sekadar project yang dia ikuti sebagai
// anggota. Staff tidak boleh sama sekali.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const existingProject = await prisma.project.findUnique({ where: { id } });
  if (!existingProject) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  const isOwner = existingProject.createdById === user.id;
  if (user.role !== "admin" && !(user.role === "leader" && isOwner)) {
    return NextResponse.json(
      { error: "Kamu tidak punya izin untuk mengubah project ini" },
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

// DELETE /api/projects/:id — hapus project.
// Admin bebas. Leader HANYA boleh menghapus project yang dia buat sendiri.
// Staff tidak boleh sama sekali.
// Akan ikut menghapus semua Task, Category, dan ProjectMember di project ini
// (lihat onDelete: Cascade di schema.prisma).
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const existingProject = await prisma.project.findUnique({ where: { id } });
  if (!existingProject) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  const isOwner = existingProject.createdById === user.id;
  if (user.role !== "admin" && !(user.role === "leader" && isOwner)) {
    return NextResponse.json(
      { error: "Kamu tidak punya izin untuk menghapus project ini" },
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
