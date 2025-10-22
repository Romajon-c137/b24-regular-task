"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BitrixUser,
  CreateTaskPayload,
  TaskItem,
  fetchActiveUsers,
  fetchUsersByIds,
  updateTask,
  ChecklistItem,
} from "@/lib/api";

type Option = { id: number; label: string };

function userToOption(u: BitrixUser): Option {
  const name =
    [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(" ") ||
    `ID ${u.ID}`;
  return { id: Number(u.ID), label: name };
}

function toLocalDatetimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

type Props = { task: TaskItem; onSaved?: () => void };

export default function EditTaskForm({ task, onSaved }: Props) {
  const [users, setUsers] = useState<Option[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // state из задачи
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [creatorId, setCreatorId] = useState<number | "">(task.creator_by ?? "");
  const [responsibles, setResponsibles] = useState<number[]>(
    task.responsible_ids || []
  );
  const [auditors, setAuditors] = useState<number[]>(
    (task.auditors as number[]) || []
  );
  const [priority, setPriority] = useState<0 | 1 | 2>(task.priority ?? 0);
  const [taskControl, setTaskControl] = useState<boolean>(!!task.task_control);

  const [startTask, setStartTask] = useState<string>(
    toLocalDatetimeInput(task.start_task)
  );
  const [deadline, setDeadline] = useState<string>(task.deadline || "");

  const [repeatType, setRepeatType] = useState<"none" | "days" | "month">(
    (task.repeat_type ?? "none") as "none" | "days" | "month"
  );
  const repeatInterval = useMemo(
    () => (repeatType === "none" ? 0 : 1),
    [repeatType]
  );

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    task.check_list || []
  );
  const [newCheck, setNewCheck] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // активные + те, кто в задаче
        const base = await fetchActiveUsers();
        const have = new Set(base.map((u) => Number(u.ID)));
        const needed = new Set<number>();
        if (task.creator_by) needed.add(Number(task.creator_by));
        (task.responsible_ids || []).forEach((n) => needed.add(Number(n)));
        ((task.auditors as number[]) || []).forEach((n) => needed.add(Number(n)));
        const missing = [...needed].filter((n) => !have.has(n));
        const extra = missing.length ? await fetchUsersByIds(missing) : [];
        const final = [...base, ...extra];

        if (!mounted) return;
        setUsers(final.map(userToOption));
      } finally {
        setLoadingUsers(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [task]);

  const toggleInArray = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) return setError("Заполните заголовок");
    if (!description.trim()) return setError("Заполните описание");
    if (!creatorId) return setError("Выберите постановщика");

    const payload: Omit<CreateTaskPayload, "start_now"> = {
      title: title.trim(),
      description: description.trim(),
      creator_by: Number(creatorId),
      responsible_ids: responsibles,
      auditors_input: auditors,
      priority,
      task_control: taskControl,
      start_task: startTask ? new Date(startTask).toISOString() : undefined,
      deadline: deadline || undefined,
      check_list: checklist.length
        ? checklist.map((c) => ({ text: c.text, is_complete: !!c.is_complete }))
        : undefined,
      repeat_type: repeatType,
      repeat_interval: repeatInterval,
    };

    try {
      setSaving(true);
      const { ok, status } = await updateTask(task.id, payload);
      if (!ok) {
        setError(`Не удалось сохранить (${status})`);
        return;
      }
      onSaved?.();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bx-form">
      <div className="bx-field">
        <label className="bx-label">Заголовок *</label>
        <input className="bx-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="bx-field">
        <label className="bx-label">Описание *</label>
        <textarea className="bx-textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="bx-field">
        <label className="bx-label">Постановщик *</label>
        <select
          className="bx-select"
          value={creatorId}
          onChange={(e) => setCreatorId(e.target.value ? Number(e.target.value) : "")}
          disabled={loadingUsers}
        >
          <option value="">Выберите пользователя…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
      </div>

      <div className="bx-field">
        <div className="bx-label">Исполнители</div>
        <div className="bx-list">
          {users.map((u) => (
            <label key={u.id} className="bx-check">
              <input
                type="checkbox"
                checked={responsibles.includes(u.id)}
                onChange={() => setResponsibles((prev) => toggleInArray(prev, u.id))}
              />
              <span>{u.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bx-field">
        <div className="bx-label">Наблюдатели</div>
        <div className="bx-list">
          {users.map((u) => (
            <label key={u.id} className="bx-check">
              <input
                type="checkbox"
                checked={auditors.includes(u.id)}
                onChange={() => setAuditors((prev) => toggleInArray(prev, u.id))}
              />
              <span>{u.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bx-grid-2">
        <div className="bx-field">
          <label className="bx-label">Начало</label>
          <input className="bx-input" type="datetime-local" value={startTask} onChange={(e) => setStartTask(e.target.value)} />
        </div>

        <div className="bx-field">
          <label className="bx-label">Повтор задачи</label>
          <select className="bx-select" value={repeatType} onChange={(e) => setRepeatType(e.target.value as "none" | "days" | "month")}>
            <option value="none">Без повтора</option>
            <option value="days">Каждый день</option>
            <option value="month">Каждый месяц</option>
          </select>
          {repeatType !== "none" && <div className="bx-help">Интервал: <b>1</b></div>}
        </div>
      </div>

      <div className="bx-grid-2">
        <div className="bx-field">
          <label className="bx-label">Крайний срок (время)</label>
          <input className="bx-input" type="time" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        <div className="bx-field bx-switch">
          <label className="bx-label">Контроль задачи</label>
          <label className="bx-toggle">
            <input type="checkbox" checked={taskControl} onChange={(e) => setTaskControl(e.target.checked)} />
            <span />
          </label>
        </div>
      </div>

      <div className="bx-field">
        <label className="bx-label">Приоритет</label>
        <select className="bx-select" value={priority} onChange={(e) => setPriority(Number(e.target.value) as 0 | 1 | 2)}>
          <option value={0}>0 — низкий</option>
          <option value={1}>1 — средний</option>
          <option value={2}>2 — высокий</option>
        </select>
      </div>

      <div className="bx-field">
        <div className="bx-label">Чек-лист</div>
        <div className="bx-inline">
          <input className="bx-input" value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder="Новый пункт…" />
          <button
            type="button"
            className="bx-btn"
            onClick={() => {
              const t = newCheck.trim();
              if (!t) return;
              setChecklist((prev) => [...prev, { text: t, is_complete: false }]);
              setNewCheck("");
            }}
          >
            Добавить
          </button>
        </div>
        {checklist.length > 0 && (
          <ul className="bx-ul">
            {checklist.map((c, i) => (
              <li key={i}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!c.is_complete}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setChecklist((prev) => prev.map((x, idx) => (idx === i ? { ...x, is_complete: v } : x)));
                    }}
                  />
                  <span>{c.text}</span>
                </label>
                <button type="button" className="bx-icon-btn" onClick={() => setChecklist((prev) => prev.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="bx-error">{error}</p>}

      <div className="bx-actions">
        <button type="submit" className="bx-btn bx-btn-primary" disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}
