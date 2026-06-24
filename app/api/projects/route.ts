import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET /api/projects
// Admin lihat SEMUA project. Member hanya lihat project yang dia ikuti
// (lewat ProjectMember).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where:
      user.role === "admin"
        ? undefined // admin: tidak ada filter, ambil semua
        : { members: { some: { userId: user.id } } },
    include: {
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

// POST /api/projects
// Hanya admin yang boleh membuat project baru.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa membuat project" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Nama project wajib diisi" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description || null,
        createdById: user.id,
        // Pembuat project otomatis jadi anggota dengan peran "Project Lead",
        // supaya dia langsung bisa lihat & kerja di project yang baru
        // dia buat (selain karena dia admin global juga punya akses).
        members: {
          create: {
            userId: user.id,
            role: "Project Lead",
          },
        },
      },
      include: {
        members: { include: { user: true } },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Gagal membuat project" },
      { status: 500 }
    );
  }
}
