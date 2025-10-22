"use client";

import { useAuth } from "@/hooks/useAuth";
import { getRole, getWebhook } from "@/lib/auth";
import { removeUser } from "@/lib/storage";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  useAuth({ requireAuth: true }); // если нет токена — /login

  const router = useRouter();
  const role = getRole();
  const webhook = getWebhook();

  const logout = () => {
    removeUser();
    router.replace("/login");
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Роль: <b>{role ?? "—"}</b></p>
      <p>Webhook: <code>{webhook ?? "—"}</code></p>

      <button onClick={logout} className="btn" style={{ marginTop: 12 }}>
        Выйти
      </button>

      <hr style={{ margin: "24px 0" }} />
      <p>Здесь будем делать интерфейс регулярных задач для Битрикс.</p>
    </main>
  );
}
