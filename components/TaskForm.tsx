"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTasks } from "../lib/store";
import type { Task, UserRef } from "../lib/types";

const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Введите название задачи"),
  description: z.string().optional(),

  assignee: z.object({ id: z.string(), email: z.string().optional(), name: z.string().optional() }),
  assignees: z.array(z.object({ id: z.string(), email: z.string().optional(), name: z.string().optional() })).optional(),

  creator: z.object({ id: z.string(), email: z.string().optional(), name: z.string().optional() }),

  coAssignees: z.array(z.object({ id: z.string(), email: z.string().optional(), name: z.string().optional() })).optional(),
  observers:  z.array(z.object({ id: z.string(), email: z.string().optional(), name: z.string().optional() })).optional(),

  isImportant: z.boolean().optional(),
  dueDate: z.string().optional(),
  requireResult: z.boolean().optional(),

  repeatRule: z.object({
    isRecurring: z.boolean(),
    timeOfDay: z.string().optional(), // HH:mm
    startsAt: z.string().optional(),  // YYYY-MM-DD
    endsAtRaw: z.string().optional(), // YYYY-MM-DD или число
  }),

  checklist: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).optional(),
  attachments: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
});
type FormValues = z.infer<typeof schema>;

async function fetchUsers(): Promise<UserRef[]> {
  const r = await fetch("/api/bitrix/users", { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || "Не удалось получить пользователей");
  return d.users as UserRef[];
}

export default function TaskForm({
  initial,
  onSaved,
  onCancel,
}: { initial?: Partial<Task>; onSaved: (id: string) => void; onCancel: () => void }) {
  const upsert = useTasks((s) => s.upsert);
  const getById = useTasks((s) => s.getById);

  const [users, setUsers] = useState<UserRef[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const defaultAssignee = useMemo<UserRef>(() => ({ id: "0", email: "", name: "Не выбран" }), []);
  const placeholderCreator = useMemo<UserRef>(() => ({ id: "me", email: "", name: "Я" }), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: initial?.id,
      title: initial?.title || "",
      description: initial?.description || "",
      assignee: initial?.assignee || defaultAssignee,
      assignees: (initial as any)?.assignees || [],
      creator: initial?.creator || placeholderCreator,
      coAssignees: initial?.coAssignees || [],
      observers: initial?.observers || [],
      isImportant: initial?.isImportant || false,
      dueDate: initial?.dueDate || "",
      requireResult: initial?.requireResult || false,
      repeatRule: initial?.repeatRule || { isRecurring: false, timeOfDay: "05:00" },
      checklist: initial?.checklist || [],
      attachments: initial?.attachments || [],
    },
  });

  const { fields: checklistFields, append: checklistAppend, remove: checklistRemove, update: checklistUpdate } =
    useFieldArray({ control: form.control, name: "checklist" as const });

  useEffect(() => {
    let mounted = true;
    setUsersLoading(true);
    fetchUsers()
      .then((u) => {
        if (!mounted) return;
        setUsers(u);
        setUsersError(null);
        const first = u[0];
        if (first) {
          const a = form.getValues("assignee");
          if (!a?.id || a.id === "0") form.setValue("assignee", first);
          const c = form.getValues("creator");
          if (!c?.id || c.id === "me") form.setValue("creator", first);
        }
      })
      .catch((e) => mounted && setUsersError(String(e?.message || e)))
      .finally(() => mounted && setUsersLoading(false));
    return () => void (mounted = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pushInfo, setPushInfo] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  async function onSubmit(values: FormValues) {
    setPushInfo(null);
    setPushing(true);

    const isEdit = Boolean(values.id);      // <-- ключевое: если редактирование — не создаём новую Bitrix-задачу
    const id = useTasks.getState().upsert(values as any);
    const saved = getById(id);

    try {
      if (!isEdit) {
        const r1 = await fetch("/api/bitrix/tasks/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: saved,
            tzOffsetMinutes: new Date().getTimezoneOffset() * -1, // передаём клиентскую TZ
          }),
        });
        const d1 = await r1.json();
        if (d1?.ok) setPushInfo(`Создано в Bitrix`);
        else setPushInfo(`Bitrix ошибка: ${d1?.error || d1?.status}`);
      } else {
        setPushInfo("Сохранено локально (без создания новой задачи)");
      }
    } catch (e: any) {
      setPushInfo(`Bitrix исключение: ${String(e?.message || e)}`);
    }

    // расписание можно обновлять и при редактировании (перерегистрируем)
    try {
      if (values.repeatRule?.isRecurring) {
        const r2 = await fetch("/api/regular/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: saved,
            tzOffsetMinutes: new Date().getTimezoneOffset() * -1,
          }),
        });
        const d2 = await r2.json();
        setPushInfo((p) => (p ? p + " • " : "") + (d2?.ok ? "Расписание зарегистрировано" : `Расписание: ошибка ${d2?.error || d2?.status}`));
      } else {
        await fetch("/api/regular/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        setPushInfo((p) => (p ? p + " • " : "") + "Расписание отключено");
      }
    } catch (e: any) {
      setPushInfo((p) => (p ? p + " • " : "") + `Расписание исключение: ${String(e?.message || e)}`);
    }

    setPushing(false);
    onSaved(id);
  }

  const selectedAssignee = form.watch("assignee");
  const selectedCreator = form.watch("creator");

  function findUserById(id: string) { return users.find((u) => u.id === id); }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Введите название задачи</label>
        <input type="text" className="w-full rounded-xl border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" {...form.register("title")} placeholder="Название" />
      </div>

      <div>
        <textarea className="w-full min-h-36 rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Описание задачи" {...form.register("description")} />
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span className="px-2 py-1 rounded-lg bg-gray-100">CoPilot</span>
        <button type="button" className="px-2 py-1 rounded-lg hover:bg-gray-100"
          onClick={() => { const name = prompt("Текст пункта чек-листа"); if (name) { const curr = form.getValues("checklist") || []; form.setValue("checklist", [...curr, { id: crypto.randomUUID(), text: name, done: false }]); } }}>
          Чек-лист
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Исполнитель (основной)</label>
          {usersLoading ? <div className="text-sm text-gray-500">Загружаю пользователей…</div> :
           usersError ? <div className="text-sm text-red-600">Ошибка: {usersError}</div> :
           <select className="w-full rounded-xl border px-3 py-2" value={selectedAssignee?.id || "0"}
             onChange={(e) => form.setValue("assignee", findUserById(e.target.value) || defaultAssignee)}>
             {[defaultAssignee, ...users].map((u) => <option key={u.id} value={u.id}>{(u.name || "").trim() || u.email || "Без имени"}</option>)}
           </select>}
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Постановщик</label>
          {usersLoading ? <div className="text-sm text-gray-500">Загружаю пользователей…</div> :
           usersError ? <div className="text-sm text-red-600">Ошибка: {usersError}</div> :
           <select className="w-full rounded-xl border px-3 py-2" value={selectedCreator?.id || "me"}
             onChange={(e) => form.setValue("creator", findUserById(e.target.value) || placeholderCreator)}>
             {users.map((u) => <option key={u.id} value={u.id}>{(u.name || "").trim() || u.email || "Без имени"}</option>)}
           </select>}
        </div>
      </div>

      {/* мульти-исполнители */}
      <div>
        <label className="block text-sm text-gray-600 mb-2">Исполнители (можно несколько)</label>
        {usersLoading ? <div className="text-sm text-gray-500">Загружаю пользователей…</div> :
         usersError ? <div className="text-sm text-red-600">Ошибка: {usersError}</div> :
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
           {users.map((u) => {
             const list = form.getValues("assignees") || [];
             const checked = !!list.find((x) => x.id === u.id);
             return (
               <label key={u.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                 <input
                   type="checkbox"
                   checked={checked}
                   onChange={(e) => {
                     const curr = form.getValues("assignees") || [];
                     const next = e.target.checked ? [...curr, u] : curr.filter((x: any) => x.id !== u.id);
                     form.setValue("assignees", next);
                     if (next.length > 0) form.setValue("assignee", next[0]); else form.setValue("assignee", defaultAssignee);
                   }}
                 />
                 <span>{u.name || u.email || "Без имени"}</span>
               </label>
             );
           })}
         </div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Крайний срок</label>
          <input type="datetime-local" className="w-full rounded-xl border px-3 py-2" {...form.register("dueDate")} />
        </div>
        <div className="flex items-center gap-2 mt-6">
          <input type="checkbox" className="size-4" {...form.register("isImportant")} />
          <span>Это важная задача</span>
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" className="size-4" {...form.register("repeatRule.isRecurring")} />
          <span className="font-medium">Сделать задачу регулярной</span>
          <span className="ml-auto text-xs text-gray-500">Повторение: каждый день</span>
        </div>
        {form.watch("repeatRule.isRecurring") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Время создания задачи</label>
              <input type="time" className="w-full rounded-xl border px-3 py-2" {...form.register("repeatRule.timeOfDay")} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Начинать повторение (поле)</label>
              <input type="date" className="w-full rounded-xl border px-3 py-2" {...form.register("repeatRule.startsAt")} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Повторять до (поле)</label>
              <input type="text" placeholder="например, без даты окончания" className="w-full rounded-xl border px-3 py-2" {...form.register("repeatRule.endsAtRaw")} />
            </div>
          </div>
        )}
      </div>

      {/* чек-лист локально */}
      {checklistFields.length > 0 && (
        <div>
          <div className="text-sm text-gray-600 mb-1">Чек-лист</div>
          <ul className="space-y-2">
            {checklistFields.map((item, i) => (
              <li key={item.id} className="flex items-center gap-2">
                <input type="checkbox" className="size-4"
                  checked={form.getValues(`checklist.${i}.done`)}
                  onChange={(e) => checklistUpdate(i, { ...item, done: e.target.checked })}
                />
                <input className="flex-1 rounded-lg border px-3 py-1"
                  value={form.getValues(`checklist.${i}.text`)}
                  onChange={(e) => checklistUpdate(i, { ...item, text: e.target.value })}
                />
                <button type="button" className="text-red-600 hover:underline" onClick={() => checklistRemove(i)}>Удалить</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pushInfo && <div className="text-sm text-gray-600">{pushInfo}</div>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border hover:bg-gray-50">Отмена</button>
        <button type="submit" disabled={pushing} className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {pushing ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
