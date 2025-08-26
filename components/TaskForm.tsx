"use client";

import React, { useEffect, useMemo, useState } from "react";

type UserRef = { id: string | number; email?: string; name?: string };
type ChecklistItem = { id: string; text: string; done: boolean };

type Props = {
  webhookBase?: string;
  onCancel?: () => void;
  onCreated?: (task: any) => void;
};

function newId(prefix = "") {
  if (typeof crypto?.randomUUID === "function") return prefix + crypto.randomUUID().slice(0, 12);
  return prefix + Math.random().toString(36).slice(2, 10);
}

export default function TaskForm({ webhookBase, onCancel, onCreated }: Props) {
  // users
  const [users, setUsers] = useState<UserRef[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  async function loadUsers() {
    if (!webhookBase?.trim()) {
      setUsers([]);
      setUsersError("Сначала сохраните webhook");
      return;
    }
    setUsersLoading(true);
    setUsersError(null);
    try {
      const url = `/api/bitrix/users?webhook=${encodeURIComponent(webhookBase.trim())}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      const arr: UserRef[] = Array.isArray(j?.result || j)
        ? (j.result || j).map((u: any) => ({
            id: String(u.ID ?? u.id),
            email: u.EMAIL ?? u.email,
            name: [u.NAME ?? u.name, u.LAST_NAME ?? u.last_name].filter(Boolean).join(" ").trim(),
          }))
        : [];
      setUsers(arr);
      if (!arr.length) setUsersError("Пользователей не найдено");
    } catch {
      setUsersError("Ошибка загрузки пользователей");
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhookBase]);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // постановщик
  const [creatorId, setCreatorId] = useState<string>(""); // пусто = "я" (по вебхуку)

  // исполнители (multi)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const toggleAssignee = (id: string, on: boolean) =>
    setAssigneeIds((prev) => (on ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));

  const [dueDate, setDueDate] = useState<string>("");
  const [isImportant, setIsImportant] = useState(false);
  const [requireResult, setRequireResult] = useState(true);

  // чеклист
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const addChecklistItem = () => setChecklist((p) => [...p, { id: newId("i_"), text: "", done: false }]);
  const updateChecklist = (id: string, text: string) =>
    setChecklist((p) => p.map((i) => (i.id === id ? { ...i, text } : i)));
  const toggleChecklist = (id: string, done: boolean) =>
    setChecklist((p) => p.map((i) => (i.id === id ? { ...i, done } : i)));
  const removeChecklist = (id: string) => setChecklist((p) => p.filter((i) => i.id !== id));

  // регулярность
  const [isRecurring, setIsRecurring] = useState(true);
  const [frequency, setFrequency] = useState<"daily" | "monthly">("daily");
  const [timeOfDay, setTimeOfDay] = useState<string>("05:00");
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!webhookBase?.trim()) return false;
    if (isRecurring) {
      if (!timeOfDay) return false;
      if (frequency === "monthly" && !(dayOfMonth >= 1 && dayOfMonth <= 31)) return false;
    }
    return true;
  }, [title, webhookBase, isRecurring, timeOfDay, frequency, dayOfMonth]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const id = newId("t_");
    const tzOffsetMinutes = -new Date().getTimezoneOffset();

    const uiTask = {
      id,
      title,
      description,
      creator: creatorId || null,
      assignees: assigneeIds.map((id) => ({ id })),
      createdAt: new Date().toISOString(),
      dueDate: dueDate || null,
      isImportant,
      requireResult,
      checklist: checklist.map((i) => ({ text: i.text, done: i.done })),
      repeatRule: isRecurring
        ? { isRecurring: true, timeOfDay, dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined }
        : { isRecurring: false },
      tzOffsetMinutes,
    };

    const registerPayload = {
      task: {
        id,
        title,
        description,
        creatorId: creatorId || undefined,
        assignees: assigneeIds.map((id) => ({ id })),
        observers: [],
        isImportant,
        requireResult,
        dueDate: dueDate || null,
        tzOffsetMinutes,
        repeatRule: isRecurring
          ? { isRecurring: true, timeOfDay, dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined }
          : { isRecurring: false },
      },
      frequency,
      webhookBase: webhookBase?.trim() || undefined,
    };

    const addPayload = {
      task: {
        title,
        description,
        creatorId: creatorId || undefined,
        assignees: assigneeIds.map((id) => ({ id })), // создадим для каждого
        observers: [],
        isImportant,
        requireResult,
        dueDate: dueDate || null,
        checklist: checklist.map((i) => ({ text: i.text, isComplete: !!i.done })),
      },
      webhookBase: webhookBase?.trim() || undefined,
    };

    try {
      // 1) сразу создаём задачи в B24
      await fetch("/api/bitrix/tasks/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addPayload),
      });

      // 2) регистрируем расписание
      await fetch("/api/regular/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerPayload),
      });

      onCreated?.(uiTask);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-3xl">
      <div className="space-y-4">
        {/* название */}
        <div className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm">
          <label className="block text-sm text-muted-foreground mb-1">Название задачи</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Отправить отчёт"
            className="w-full rounded-xl border bg-white/70 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* описание */}
        <div className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm">
          <label className="block text-sm text-muted-foreground mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Короткое описание задачи…"
            className="w-full rounded-xl border bg-white/70 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* постановщик + исполнители */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm md:col-span-1">
            <div className="text-sm font-medium mb-2">Постановщик</div>
            <select
              value={creatorId}
              onChange={(e) => setCreatorId(e.target.value)}
              className="w-full rounded-xl border bg-white/70 px-3 py-2"
            >
              <option value="">Я (по вебхуку)</option>
              {users.map((u) => (
                <option key={String(u.id)} value={String(u.id)}>
                  {u.name || u.email || `ID ${u.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Исполнители</div>
              <button type="button" onClick={loadUsers} className="text-xs text-indigo-600 hover:text-indigo-700">
                Обновить список
              </button>
            </div>

            {usersLoading && <div className="text-sm text-muted-foreground">Загрузка…</div>}
            {usersError && <div className="text-sm text-red-600">{usersError}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
              {users.map((u) => (
                <label key={String(u.id)} className="flex items-center gap-3 rounded-xl border px-3 py-2 hover:bg-indigo-50 transition">
                  <input
                    type="checkbox"
                    className="size-4 rounded accent-indigo-600"
                    checked={assigneeIds.includes(String(u.id))}
                    onChange={(e) => toggleAssignee(String(u.id), e.target.checked)}
                  />
                  <span className="text-sm">{u.name || u.email || `ID ${u.id}`}</span>
                </label>
              ))}
              {!usersLoading && users.length === 0 && !usersError && (
                <div className="text-sm text-muted-foreground">Нет данных пользователей</div>
              )}
            </div>
          </div>
        </div>

        {/* дедлайн и флаги */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm">
            <label className="block text-sm text-muted-foreground mb-1">Крайний срок</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border bg-white/70 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <label className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 rounded accent-indigo-600"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
            />
            Важная задача
          </label>

          <label className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 rounded accent-indigo-600"
              checked={requireResult}
              onChange={(e) => setRequireResult(e.target.checked)}
            />
            Требовать результат
          </label>
        </div>

        {/* регулярность */}
        <div className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm space-y-3">
          <label className="inline-flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 rounded accent-indigo-600"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <span className="font-medium">Сделать задачу регулярной</span>
          </label>

          {isRecurring && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Частота</div>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="w-full rounded-xl border bg-white/70 px-3 py-2">
                  <option value="daily">Каждый день</option>
                  <option value="monthly">Каждый месяц</option>
                </select>
              </div>

              {frequency === "monthly" && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">День месяца</div>
                  <input
                    type="number" min={1} max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value || "1", 10))))}
                    className="w-full rounded-xl border bg-white/70 px-3 py-2"
                  />
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground mb-1">Время создания</div>
                <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="w-full rounded-xl border bg-white/70 px-3 py-2" />
              </div>
            </div>
          )}
        </div>

        {/* чек-лист */}
        <div className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Чек-лист</div>
            <button type="button" onClick={addChecklistItem} className="text-sm text-indigo-600 hover:text-indigo-700">
              + добавить пункт
            </button>
          </div>
          <div className="space-y-2">
            {checklist.map((i) => (
              <div key={i.id} className="flex items-center gap-3">
                <input type="checkbox" checked={i.done} onChange={(e) => toggleChecklist(i.id, e.target.checked)} className="size-4 rounded accent-indigo-600" />
                <input value={i.text} onChange={(e) => updateChecklist(i.id, e.target.value)} placeholder="Текст пункта…" className="flex-1 rounded-xl border bg-white/70 px-3 py-2" />
                <button type="button" onClick={() => removeChecklist(i.id)} className="text-sm text-muted-foreground hover:text-red-600">удалить</button>
              </div>
            ))}
            {checklist.length === 0 && <div className="text-sm text-muted-foreground">Пусто</div>}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel} className="rounded-2xl border px-4 py-2 hover:bg-gray-50">Отмена</button>
          <button type="submit" disabled={!canSubmit} className="rounded-2xl bg-indigo-600 text-white px-5 py-2.5 shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
            Создать
          </button>
        </div>
      </div>
    </form>
  );
}
