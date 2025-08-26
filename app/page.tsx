"use client";
import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";
import TaskForm from "../components/TaskForm";
import TaskCard from "../components/TaskCard";
import TaskDetails from "../components/TaskDetails";
import { useTasks } from "../lib/store";

export default function Page() {
  const tasks = useTasks((s) => s.tasks);
  const remove = useTasks((s) => s.remove);
  const getById = useTasks((s) => s.getById);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailTask = useMemo(() => (detailId ? getById(detailId) : undefined), [detailId, getById]);

  return (
    <main className="container-page py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Новая задача</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 rounded-2xl bg-brand-600 text-white hover:bg-brand-700 shadow"
        >
          Создать
        </button>
      </div>

      <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(450px,1fr))]">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onClick={() => setDetailId(t.id)} />
        ))}
      </div>

      {/* Create / Edit modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Создать задачу" size="xl">
        <TaskForm
          onSaved={(id) => {
            setCreateOpen(false);
            setDetailId(id);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detailTask}
        onClose={() => setDetailId(null)}
        title={detailTask ? `Задача: ${detailTask.title}` : "Задача"}
        size="xl"
      >
        {detailTask && (
          <div className="space-y-6">
            <TaskDetails task={detailTask} />
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setDetailId("edit:" + detailTask.id)}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50"
              >
                Редактировать
              </button>
              <button
                onClick={() => {
                  if (confirm("Удалить задачу?")) {
                    remove(detailTask.id);
                    setDetailId(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit modal (re-use form) */}
      <Modal open={typeof detailId === "string" && detailId.startsWith("edit:")} onClose={() => setDetailId(null)} title="Редактировать задачу" size="xl">
        {typeof detailId === "string" && detailId.startsWith("edit:") && (
          <TaskForm
            initial={getById(detailId.slice(5))}
            onSaved={(id) => setDetailId(id)}
            onCancel={() => setDetailId(null)}
          />
        )}
      </Modal>
    </main>
  );
}
