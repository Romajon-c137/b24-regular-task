"use client";

import LoginForm from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  useAuth({ redirectIfAuthed: true }); // уже залогинен? -> /dashboard
  return <LoginForm />;
}
