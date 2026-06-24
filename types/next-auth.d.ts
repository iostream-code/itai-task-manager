// Menambahkan field custom (`id`, `role`) ke tipe Session & User bawaan
// next-auth, supaya TypeScript tidak komplain saat kita pakai
// `session.user.id` / `session.user.role` di seluruh aplikasi.
// Lihat callback `session` & `jwt` di auth.ts — di sana field ini disisipkan.

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "member";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "admin" | "member";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "member";
  }
}
