"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Jangan tampilkan navbar di halaman login
  if (pathname === "/login") return null;
  // Saat masih loading session, jangan tampilkan apa-apa (hindari flicker)
  if (status === "loading" || !session) return null;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/projects" className="font-semibold text-slate-800 text-sm">
          Task Manager — Tim IT
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {session.user.name}{" "}
            <span className="text-xs text-slate-400">
              ({session.user.role === "admin" ? "Admin" : "Member"})
            </span>
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-slate-500 hover:text-red-600 transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}
