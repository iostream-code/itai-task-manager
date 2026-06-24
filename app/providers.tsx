"use client";

import { SessionProvider } from "next-auth/react";

// next-auth/react butuh dibungkus SessionProvider supaya useSession() /
// signIn() / signOut() bisa dipakai di client component mana pun.
// Dipisah jadi file sendiri karena layout.tsx (Server Component) tidak
// boleh punya "use client" langsung kalau mau tetap bisa export `metadata`.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
