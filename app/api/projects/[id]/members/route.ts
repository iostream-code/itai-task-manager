import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessProject } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/:id/members — daftar anggota project
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const hasAccess = await canAccessProject(id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

// POST /api/projects/:id/members — tambah anggota baru ke project (admin only)
// Body: { userId: string, role: string }  -- role di sini peran kerja bebas,
// contoh "Project Lead", "Backend Developer", "QA"
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa menambah anggota project" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role || typeof role !== "string" || role.trim() === "") {
      return NextResponse.json(
        { error: "userId dan peran (role) wajib diisi" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: role.trim(),
      },
      include: { user: true },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: unknown) {
    // P2002 = unique constraint (user ini sudah jadi anggota project ini)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "User ini sudah menjadi anggota project ini" },
        { status: 409 }
      );
    }
    console.error(`POST /api/projects/${projectId}/members error:`, error);
    return NextResponse.json({ error: "Gagal menambah anggota" }, { status: 500 });
  }
}
