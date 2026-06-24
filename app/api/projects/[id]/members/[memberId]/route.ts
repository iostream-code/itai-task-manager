import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string; memberId: string }> };

// PATCH /api/projects/:id/members/:memberId — ubah peran kerja anggota (admin only)
// Body: { role: string }
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { memberId } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa mengubah peran anggota" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { role } = body;

    if (!role || typeof role !== "string" || role.trim() === "") {
      return NextResponse.json({ error: "Peran (role) wajib diisi" }, { status: 400 });
    }

    const member = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: role.trim() },
      include: { user: true },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error(`PATCH .../members/${memberId} error:`, error);
    return NextResponse.json({ error: "Gagal mengubah peran anggota" }, { status: 500 });
  }
}

// DELETE /api/projects/:id/members/:memberId — keluarkan anggota dari project (admin only)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { memberId } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa mengeluarkan anggota" },
      { status: 403 }
    );
  }

  try {
    await prisma.projectMember.delete({ where: { id: memberId } });
    return NextResponse.json({ message: "Anggota berhasil dikeluarkan dari project" });
  } catch (error) {
    console.error(`DELETE .../members/${memberId} error:`, error);
    return NextResponse.json({ error: "Gagal mengeluarkan anggota" }, { status: 500 });
  }
}
