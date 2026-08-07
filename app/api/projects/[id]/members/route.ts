import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessProject } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/:id/members — daftar anggota project
// Scope: admin lihat semua anggota. Leader HANYA lihat dirinya sendiri +
// staff yang leaderId-nya = dia (staf leader lain, meski anggota project
// yang sama, disembunyikan). Staff hanya lihat dirinya sendiri.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const hasAccess = await canAccessProject(id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { projectId: id };
  if (currentUser?.role === "leader") {
    where.user = { OR: [{ id: currentUser.id }, { leaderId: currentUser.id }] };
  } else if (currentUser?.role === "staff") {
    where.userId = currentUser.id;
  }

  const members = await prisma.projectMember.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

// POST /api/projects/:id/members — tambah anggota baru ke project.
// Body: { userId: string, role: string }  -- role di sini peran kerja bebas,
// contoh "Project Lead", "Backend Developer", "QA"
//
// Siapa boleh menambah siapa:
//   - admin  -> boleh menambah siapa saja.
//   - leader -> hanya boleh menambah dirinya sendiri atau staff miliknya
//               sendiri (leaderId = dirinya).
//   - staff  -> tidak boleh menambah anggota project.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role === "staff") {
    return NextResponse.json(
      { error: "Kamu tidak punya izin untuk menambah anggota project" },
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

    if (currentUser.role === "leader") {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      const isSelf = userId === currentUser.id;
      const isOwnStaff = targetUser?.leaderId === currentUser.id;
      if (!isSelf && !isOwnStaff) {
        return NextResponse.json(
          { error: "Kamu hanya bisa menambahkan dirimu sendiri atau staf milikmu" },
          { status: 403 }
        );
      }
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
