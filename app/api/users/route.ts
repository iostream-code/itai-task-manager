import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

// Field yang aman ditampilkan ke client — TIDAK PERNAH menyertakan `password`.
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

// GET /api/users — daftar user, dipakai untuk dropdown "assign ke"
// dan dropdown "tambah anggota project", serta halaman /users.
//
// Scope per role (konsisten dengan scope task, lihat lib/auth-helpers.ts):
//   - admin  -> semua user
//   - leader -> dirinya sendiri + staff yang leaderId = dirinya
//   - staff  -> dirinya sendiri saja (staff tidak assign ke orang lain)
//
// Query opsional: ?includeInactive=1 supaya user nonaktif ikut ditampilkan
// (dipakai di halaman Anggota/admin). Secara default (dipakai dropdown
// assign/tambah anggota) user nonaktif DISEMBUNYIKAN karena tidak masuk
// akal menugaskan task ke akun yang tidak bisa login lagi.
export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "1";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = includeInactive ? {} : { isActive: true };

  if (currentUser.role === "leader") {
    where.OR = [{ id: currentUser.id }, { leaderId: currentUser.id }];
  } else if (currentUser.role === "staff") {
    where.id = currentUser.id;
  }
  // admin: tidak ada batasan tambahan

  const users = await prisma.user.findMany({
    where,
    select: PUBLIC_USER_FIELDS,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

// Domain email resmi tim — semua user baru wajib pakai domain ini.
const EMAIL_DOMAIN = "@koperindo.id";

// POST /api/users — tambah anggota tim baru.
// Body: { name, email, password, role, leaderId }
//
// Siapa boleh membuat siapa:
//   - admin  -> boleh membuat user dengan role apa saja (admin/leader/staff).
//               Kalau admin membuat staff tanpa leaderId eksplisit, staff
//               itu otomatis "melekat" ke admin itu sendiri (admin bisa
//               membuat staffnya sendiri, sama seperti leader).
//   - leader -> hanya boleh membuat staff, dan staff itu otomatis melekat
//               ke dirinya sendiri (leaderId dipaksa = currentUser.id,
//               mengabaikan leaderId apa pun yang dikirim dari client).
//   - staff  -> tidak boleh membuat user sama sekali.
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role === "staff") {
    return NextResponse.json(
      { error: "Kamu tidak punya izin untuk menambah user" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { name, email, password, role, leaderId } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 },
      );
    }
    if (typeof email !== "string" || !email.toLowerCase().endsWith(EMAIL_DOMAIN)) {
      return NextResponse.json(
        { error: `Email wajib menggunakan domain ${EMAIL_DOMAIN}` },
        { status: 400 },
      );
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter" },
        { status: 400 },
      );
    }

    // Tentukan role & leaderId final berdasarkan siapa yang membuat.
    let finalRole: "admin" | "leader" | "staff";
    let finalLeaderId: string | null;

    if (currentUser.role === "leader") {
      // Leader hanya boleh membuat staff, otomatis jadi stafnya sendiri.
      finalRole = "staff";
      finalLeaderId = currentUser.id;
    } else {
      // admin
      finalRole = role === "admin" || role === "leader" || role === "staff" ? role : "staff";
      if (finalRole === "staff") {
        // Kalau admin tidak menentukan leaderId, staff ini melekat ke admin
        // itu sendiri (admin bisa membuat & membawahi staffnya sendiri).
        finalLeaderId = leaderId || currentUser.id;
      } else {
        finalLeaderId = null; // admin/leader tidak punya leaderId
      }
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: finalRole,
        leaderId: finalLeaderId,
        isActive: true,
      },
      select: PUBLIC_USER_FIELDS,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    // Prisma melempar error P2002 kalau ada unique constraint yang dilanggar
    // (di sini email harus unik)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 },
      );
    }
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Gagal menambah user" }, { status: 500 });
  }
}
