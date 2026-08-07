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
  leaderId: true,
  leader: { select: { id: true, name: true } },
} as const;

const EMAIL_DOMAIN = "@koperindo.id";

// PATCH /api/users/:id — edit user.
// Body (semua opsional, kirim hanya yang mau diubah):
//   { name, email, role, isActive, password, leaderId }
// `password` kalau dikirim akan di-hash ulang (dipakai untuk reset password
// manual, bukan flow "lupa password" mandiri).
//
// Siapa boleh mengubah siapa:
//   - admin  -> boleh mengubah siapa saja, termasuk role & leaderId bebas.
//   - leader -> HANYA boleh mengubah staff yang leaderId-nya = dirinya
//               sendiri. Tidak boleh mengubah role (staff tetap staff) atau
//               memindahkan staff itu ke leader lain.
//   - staff  -> tidak boleh mengubah user sama sekali (termasuk dirinya
//               sendiri lewat endpoint ini).
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role === "staff") {
    return NextResponse.json(
      { error: "Kamu tidak punya izin untuk mengubah data user" },
      { status: 403 }
    );
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  if (currentUser.role === "leader" && targetUser.leaderId !== currentUser.id) {
    return NextResponse.json(
      { error: "Kamu hanya bisa mengubah data staf milikmu sendiri" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, role, isActive, password, leaderId } = body;

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
      if (role !== undefined && role !== currentUser.role) {
        return NextResponse.json(
          { error: "Kamu tidak bisa menurunkan role akunmu sendiri" },
          { status: 400 }
        );
      }
    }

    if (email !== undefined && (typeof email !== "string" || !email.toLowerCase().endsWith(EMAIL_DOMAIN))) {
      return NextResponse.json(
        { error: `Email wajib menggunakan domain ${EMAIL_DOMAIN}` },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;

    if (currentUser.role === "leader") {
      // Leader tidak boleh mengubah role staff-nya atau memindahkannya ke
      // leader lain — field role & leaderId diabaikan sepenuhnya di sini.
    } else {
      // admin: bebas mengubah role & leaderId
      if (role !== undefined) {
        if (role !== "admin" && role !== "leader" && role !== "staff") {
          return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
        }
        data.role = role;
        // Kalau role diubah jadi bukan staff, leaderId harus dikosongkan.
        if (role !== "staff") data.leaderId = null;
      }
      if (leaderId !== undefined) {
        const effectiveRole = (data.role as string | undefined) ?? targetUser.role;
        data.leaderId = effectiveRole === "staff" ? leaderId || null : null;
      }
    }

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
