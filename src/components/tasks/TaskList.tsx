"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BitrixUser, fetchActiveUsers, fetchTasks, TaskItem } from "@/lib/api";

type UserMap = Record<number, string>;

function toUserMap(list: BitrixUser[]): UserMap {
  const m: UserMap = {};
  for (const u of list) {
    const id = Number(u.ID);
    const name =
      [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(" ") ||
      `User ${u.ID}`;
    m[id] = name;
  }
  return m;
}

function fmtDateTime(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return d.toLocaleString();
  } catch {
    return dt ?? "—";
  }
}

function priorityBadge(p: 0 | 1 | 2) {
  if (p === 2) return { text: "Высокий", className: "bx-badge bx-red" };
  if (p === 1) return { text: "Средний", className: "bx-badge bx-yellow" };
  return { text: "Низкий", className: "bx-badge bx-green" };
}

function commaNames(ids: number[], map: UserMap) {
  if (!ids?.length) return "—";
  return ids.map((id) => map[id] ?? `ID ${id}`).join(", ");
}

export default function TaskList() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [t, u] = await Promise.all([fetchTasks(), fetchActiveUsers()]);
        if (!mounted) return;
        setTasks(t);
        setUsers(toUserMap(u));
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(() => tasks, [tasks]);

  if (loading) return <div className="bx-card">Загрузка…</div>;
  if (!cards.length) return <div className="bx-card">Задач пока нет.</div>;

  return (
    <div className="bx-cards">
      {cards.map((t) => {
        const pr = priorityBadge(t.priority);
        return (
          <div key={t.id} className="bx-card bx-task">
            <div className="bx-task-head">
              <Link href={`/tasks/${t.id}`} className="bx-task-title bx-link">
                {t.title}
              </Link>
              <span className={pr.className}>{pr.text}</span>
            </div>

            <div className="bx-task-row">
              <span className="bx-task-label">Создатель</span>
              <span className="bx-task-value">
                {t.creator_by ? (users[t.creator_by] ?? `ID ${t.creator_by}`) : "—"}
              </span>
            </div>

            <div className="bx-task-row">
              <span className="bx-task-label">Исполнители</span>
              <span className="bx-task-value">
                {commaNames(t.responsible_ids, users)}
              </span>
            </div>

            <div className="bx-task-row">
              <span className="bx-task-label">Наблюдатели</span>
              <span className="bx-task-value">
                {commaNames(t.auditors as number[], users)}
              </span>
            </div>

            <div className="bx-task-row">
              <span className="bx-task-label">Повторяемость</span>
              <span className="bx-task-value">
                {t.repeat_type === "days"
                  ? "Каждый день"
                  : t.repeat_type === "month"
                  ? "Каждый месяц"
                  : "—"}
              </span>
            </div>

            <div className="bx-task-row">
              <span className="bx-task-label">Последний запуск</span>
              <span className="bx-task-value">{t.the_last_run}</span>
            </div>

            <div className="bx-task-row">
              <span className="bx-task-label">Следующий запуск</span>
              <span className="bx-task-value">
                {fmtDateTime(t.next_run)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
