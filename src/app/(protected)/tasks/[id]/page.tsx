"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  TaskItem,
  fetchTask,
  deleteTask,
  BitrixUser,
  fetchActiveUsers,
  fetchUsersByIds,
} from "@/lib/api";
import EditTaskForm from "@/components/tasks/EditTaskForm";

type UserMap = Record<number, { name: string }>;
function toUserMap(list: BitrixUser[]): UserMap {
  const m: UserMap = {};
  for (const u of list) {
    const id = Number(u.ID);
    const name =
      [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(" ") ||
      `ID ${u.ID}`;
    m[id] = { name };
  }
  return m;
}
function fmt(dt?: string | null) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

export default function TaskDetailPage() {
  useAuth({ requireAuth: true });

  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);

  const [task, setTask] = useState<TaskItem | null>(null);
  const [users, setUsers] = useState<UserMap>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await fetchTask(id);
      const active = await fetchActiveUsers();

      const ids = new Set<number>();
      if (t?.creator_by) ids.add(Number(t.creator_by));
      (t?.responsible_ids || []).forEach((n) => ids.add(Number(n)));
      ((t?.auditors as number[]) || []).forEach((n) => ids.add(Number(n)));

      const activeMap = toUserMap(active);
      const missing = [...ids].filter((n) => !(n in activeMap));
      const extras = missing.length ? await fetchUsersByIds(missing) : [];
      const allMap: UserMap = { ...activeMap, ...toUserMap(extras) };

      setTask(t);
      setUsers(allMap);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  const creatorName = useMemo(
    () => (task?.creator_by ? (users[task.creator_by]?.name || `ID ${task.creator_by}`) : "—"),
    [task, users]
  );
  const respNames = useMemo(
    () => (task?.responsible_ids || []).map((n) => users[n]?.name || `ID ${n}`).join(", ") || "—",
    [task, users]
  );
  const audNames = useMemo(
    () => ((task?.auditors as number[]) || []).map((n) => users[n]?.name || `ID ${n}`).join(", ") || "—",
    [task, users]
  );

  const onDelete = async () => {
    if (!task) return;
    if (!confirm("Удалить задачу? Это действие необратимо.")) return;
    try {
      setDeleting(true);
      const { ok, status } = await deleteTask(task.id);
      if (!ok) { setError(`Не удалось удалить (${status})`); return; }
      router.replace("/dashboard");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <main className="bx-container"><div className="bx-card">Загрузка…</div></main>;
  if (!task) return <main className="bx-container"><div className="bx-card">Задача не найдена</div></main>;

  if (editing) {
    return (
      <main className="bx-container">
        <div className="bx-toolbar">
          <button className="bx-btn" onClick={() => setEditing(false)}>‹ Задача #{task.id}</button>
        </div>
        <div className="bx-card">
          <EditTaskForm task={task} onSaved={async () => { setEditing(false); await load(); }} />
        </div>
      </main>
    );
  }

  return (
    <main className="bx-container">
      <div className="bx-toolbar">
        <button className="bx-btn" onClick={() => router.replace("/dashboard")}>‹ Задача #{task.id}</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="bx-btn" onClick={() => setEditing(true)}>✎ Редактировать</button>
          <button className="bx-btn" onClick={() => router.replace("/dashboard")}>К списку</button>
          <button
            className="bx-btn"
            style={{ background: "#ff4d4f", color: "#fff", borderColor: "#ff4d4f" }}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? "Удаление…" : "Удалить"}
          </button>
        </div>
      </div>

      {error && <div className="bx-card"><p className="bx-error">{error}</p></div>}

      <div className="bx-card">
        <div className="bx-task-row"><span className="bx-task-label">Название</span><span className="bx-task-value">{task.title}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Описание</span><span className="bx-task-value">{task.description || "—"}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Создатель</span><span className="bx-task-value">{creatorName}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Исполнители</span><span className="bx-task-value">{respNames}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Наблюдатели</span><span className="bx-task-value">{audNames}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Повторяемость</span><span className="bx-task-value">{task.repeat_type==="days" ? "Каждый день" : task.repeat_type==="month" ? "Каждый месяц" : "—"}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Начало</span><span className="bx-task-value">{fmt(task.start_task)}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Крайний срок</span><span className="bx-task-value">{task.deadline || "—"}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Последний запуск</span><span className="bx-task-value">{fmt(task.the_last_run)}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Следующий запуск</span><span className="bx-task-value">{fmt(task.next_run)}</span></div>
        <div className="bx-task-row"><span className="bx-task-label">Контроль задачи</span><span className="bx-task-value">{task.task_control ? "Включён" : "Выключен"}</span></div>
      </div>
    </main>
  );
}
