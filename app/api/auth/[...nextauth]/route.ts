// Route ini menangani semua endpoint internal Auth.js, contoh:
// /api/auth/signin, /api/auth/signout, /api/auth/session, /api/auth/csrf, dst.
// Implementasinya cukup re-export `handlers` dari auth.ts di root.

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
