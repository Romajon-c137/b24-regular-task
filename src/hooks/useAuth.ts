"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

type Opts = {
  requireAuth?: boolean;          // если true — редирект на /login при отсутствии токена
  redirectIfAuthed?: boolean;     // если true — редирект на /dashboard при наличии токена (для /login)
  redirectTo?: string;            // куда гнать неавторизованных
  redirectToAuthed?: string;      // куда гнать авторизованных
};

export function useAuth({
  requireAuth = false,
  redirectIfAuthed = false,
  redirectTo = "/login",
  redirectToAuthed = "/dashboard",
}: Opts = {}) {
  const router = useRouter();

  useEffect(() => {
    const authed = isAuthenticated();
    if (requireAuth && !authed) {
      router.replace(redirectTo);
      return;
    }
    if (redirectIfAuthed && authed) {
      router.replace(redirectToAuthed);
    }
  }, [requireAuth, redirectIfAuthed, redirectTo, redirectToAuthed, router]);
}
