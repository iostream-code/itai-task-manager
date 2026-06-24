import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/auth-helpers";

// GET /api/categories?projectId=xxx
// Kategori sekarang melekat ke satu project (tiap project punya daftar
// kategori sendiri), jadi projectId wajib disertakan.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId wajib diisi" }, { status: 400 });
  }

  const hasAccess = await canAccessProject(projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

// POST /api/categories — tambah kategori baru ke sebuah project
// (misal: "Bug", "Request"). Body: { name, color, projectId }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color, projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId wajib diisi" }, { status: 400 });
    }

    const hasAccess = await canAccessProject(projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
    }

    if (!name) {
      return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: { name, color: color || "#6366f1", projectId },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    // P2002 = unique constraint (nama kategori sudah ada di project ini)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Kategori dengan nama ini sudah ada di project ini" },
        { status: 409 }
      );
    }
    console.error("POST /api/categories error:", error);
    return NextResponse.json({ error: "Gagal menambah kategori" }, { status: 500 });
  }
}
