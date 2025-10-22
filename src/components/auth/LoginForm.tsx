"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postLogin } from "@/lib/api";
import { setUserInfo } from "@/lib/storage";

export default function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone.trim() || !password.trim()) {
      setError("Введите телефон и пароль");
      return;
    }

    try {
      setLoading(true);
      const { ok, data } = await postLogin({ phone, password });
      if (!ok || !data) {
        setError("Неверные данные");
        return;
      }
      const token = data.token as string | undefined;
      const webhook = data.webhook as string | undefined;
      if (!token) {
        setError("Токен не получен");
        return;
      }
      setUserInfo({ token, webhook });
      router.replace("/dashboard");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="bx-form" style={{ maxWidth: 360 }}>
      <div className="bx-field">
        <label className="bx-label">Телефон</label>
        <input className="bx-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="bx-field">
        <label className="bx-label">Пароль</label>
        <input className="bx-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="bx-error">{error}</p>}
      <button className="bx-btn bx-btn-primary" type="submit" disabled={loading}>
        {loading ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
