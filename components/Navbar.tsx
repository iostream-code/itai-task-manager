"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium px-1 pb-1 border-b-2 transition-colors ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Jangan tampilkan navbar di halaman login
  if (pathname === "/login") return null;
  // Saat masih loading session, jangan tampilkan apa-apa (hindari flicker)
  if (status === "loading" || !session) return null;

  const isAdmin = session.user.role === "admin";
  const isLeader = session.user.role === "leader";
  const roleLabel =
    session.user.role === "admin" ? "Admin" : session.user.role === "leader" ? "Leader" : "Staff";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/projects" className="font-semibold text-slate-800 text-sm shrink-0">
            Korin Task Management
          </Link>

          <nav className="flex items-center gap-4">
            <NavLink
              href="/projects"
              label="Project"
              active={pathname.startsWith("/projects")}
            />
            {(isAdmin || isLeader) && (
              <NavLink
                href="/users"
                label="Anggota"
                active={pathname.startsWith("/users")}
              />
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-slate-500">
            {session.user.name}{" "}
            <span className="text-xs text-slate-400">({roleLabel})</span>
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
