import { redirect } from "next/navigation";

// Halaman utama sekarang adalah daftar Project, bukan langsung Kanban board.
// File ini hanya bertugas redirect "/" -> "/projects".
export default function HomePage() {
  redirect("/projects");
}
