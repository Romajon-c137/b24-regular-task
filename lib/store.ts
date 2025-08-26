"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Task, UserRef } from "./types";

type Store = {
  tasks: Task[];
  upsert: (task: Partial<Task> & { id?: string }) => string; // returns id
  remove: (id: string) => void;
  getById: (id: string) => Task | undefined;
};

export const useTasks = create<Store>()(
  persist(
    (set, get) => ({
      tasks: [],
      upsert: (incoming) => {
        let id = incoming.id || nanoid();
        const now = new Date().toISOString();
        const existing = get().tasks.find((t) => t.id === id);
        const task: Task = {
          id,
          title: incoming.title || existing?.title || "Без названия",
          description: incoming.description ?? existing?.description,
          assignee: incoming.assignee as UserRef || existing?.assignee || { id: "0", email: "", name: "Не выбран" },
          creator: incoming.creator as UserRef || existing?.creator || { id: "me", email: "", name: "Я" },
          coAssignees: incoming.coAssignees ?? existing?.coAssignees ?? [],
          observers: incoming.observers ?? existing?.observers ?? [],
          isImportant: incoming.isImportant ?? existing?.isImportant ?? false,
          dueDate: incoming.dueDate ?? existing?.dueDate,
          requireResult: incoming.requireResult ?? existing?.requireResult ?? false,
          checklist: incoming.checklist ?? existing?.checklist ?? [],
          attachments: incoming.attachments ?? existing?.attachments ?? [],
          createdAt: existing?.createdAt || now,
          repeatRule: incoming.repeatRule ?? existing?.repeatRule ?? { isRecurring: false },
        };
        set((s) => ({
          tasks: existing ? s.tasks.map((t) => (t.id === id ? task : t)) : [task, ...s.tasks],
        }));
        return id;
      },
      remove: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      getById: (id) => get().tasks.find((t) => t.id === id),
    }),
    {
      name: "tasks_v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : undefined as any)),
      skipHydration: false,
    }
  )
);
