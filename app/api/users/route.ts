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
  createdAt: true,
} as const;

// GET /api/users — daftar semua user, dipakai untuk dropdown "assign ke"
// dan dropdown "tambah anggota project". Siapa pun yang sudah login boleh
// melihat daftar nama dasar (tidak ada data sensitif yang diekspos).
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: PUBLIC_USER_FIELDS,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

// POST /api/users — tambah anggota tim baru (hanya admin).
// Body: { name, email, password, role }
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  if (currentUser.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa menambah user" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role === "admin" ? "admin" : "member",
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
        { status: 409 }
      );
    }
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Gagal menambah user" }, { status: 500 });
  }
}
