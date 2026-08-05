import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

// PATCH /api/users/:id — edit user (admin only)
// Body (semua opsional, kirim hanya yang mau diubah):
//   { name, email, role, isActive, password }
// `password` kalau dikirim akan di-hash ulang (dipakai untuk reset password
// manual oleh admin, bukan flow "lupa password" mandiri).
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa mengubah data user" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, role, isActive, password } = body;

    // Admin tidak boleh menonaktifkan/menurunkan role dirinya sendiri lewat
    // endpoint ini — supaya tidak ada skenario "admin terakhir mengunci diri
    // sendiri keluar dari sistem" secara tidak sengaja.
    if (currentUser.id === id) {
      if (isActive === false) {
        return NextResponse.json(
          { error: "Kamu tidak bisa menonaktifkan akunmu sendiri" },
          { status: 400 }
        );
      }
      if (role !== undefined && role !== "admin") {
        return NextResponse.json(
          { error: "Kamu tidak bisa menurunkan role akunmu sendiri" },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role === "admin" ? "admin" : "member";
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
        return NextResponse.json(
          { error: "Password minimal 8 karakter" },
          { status: 400 }
        );
      }
      data.password = await hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: PUBLIC_USER_FIELDS,
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email sudah dipakai user lain" },
        { status: 409 }
      );
    }
    console.error(`PATCH /api/users/${id} error:`, error);
    return NextResponse.json({ error: "Gagal mengubah data user" }, { status: 500 });
  }
}
