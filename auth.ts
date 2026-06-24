// Konfigurasi Auth.js v5 (next-auth@beta).
// File ini WAJIB ada di root project (bukan di dalam app/) — ini konvensi
// baru di v5, supaya config-nya bisa dipakai di mana saja lewat:
//   import { auth, signIn, signOut } from "@/auth"
//
// Kita pakai Credentials provider (email + password) karena belum ada
// kebutuhan login lewat Google/GitHub dsb. Session disimpan sebagai JWT
// (bukan session di database) — lebih ringan dan tidak butuh tabel
// Session/Account tambahan di schema Prisma.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (!email || !password || typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordValid = await compare(password, user.password);
        if (!passwordValid) return null;

        // Apa pun yang dikembalikan di sini akan masuk ke token JWT
        // (lewat callback jwt() di bawah), lalu ke object session.user.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // Disisipkan ke JWT setiap kali login / token di-refresh
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    // Diambil dari JWT, dibentuk jadi object `session` yang dipakai di
    // server (lewat auth()) maupun client (lewat useSession())
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "member";
      }
      return session;
    },
  },
});
