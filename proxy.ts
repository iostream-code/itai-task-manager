// Di Next.js 16, `middleware.ts` diganti namanya jadi `proxy.ts`
// (fungsinya sama: jalan sebelum request mencapai halaman/route handler).
//
// Tugas file ini: redirect ke /login kalau belum login, dan sebaliknya
// redirect ke / kalau sudah login tapi mencoba akses /login lagi.
// Pengecekan ROLE (admin vs member) untuk aksi spesifik tetap dilakukan
// di masing-masing API route / page — proxy ini hanya gerbang pertama
// (sudah login atau belum).

import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublicPath = PUBLIC_PATHS.some((path) => nextUrl.pathname.startsWith(path));

  if (!isLoggedIn && !isPublicPath) {
    const loginUrl = new URL("/login", nextUrl);
    // Jangan simpan path yang jelas rusak (mengandung "undefined"/"null"
    // sebagai salah satu segmennya, misal dari link atau prefetch yang
    // sempat menyimpan id yang belum ter-resolve) sebagai callbackUrl —
    // kalau tersimpan, user akan diarahkan BALIK ke path rusak itu persis
    // setelah berhasil login, dan halaman tujuan akan gagal fetch data.
    const pathSegments = nextUrl.pathname.split("/");
    const hasBrokenSegment = pathSegments.some((seg) => seg === "undefined" || seg === "null");
    if (!hasBrokenSegment) {
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

// Jalankan proxy ini di semua route KECUALI api/auth, file statis Next.js,
// dan favicon. /api/* lainnya (tasks, users, dst) TETAP melewati proxy ini
// supaya endpoint-nya juga ikut terlindungi.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
