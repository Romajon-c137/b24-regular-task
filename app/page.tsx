"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import TaskForm from "../components/TaskForm";
import TaskCard from "../components/TaskCard";
import TaskDetails from "../components/TaskDetails";
import { useTasks } from "../lib/store";

export default function Page() {
  // webhook
  const [webhookInput, setWebhookInput] = useState("");
  const [webhook, setWebhook] = useState("");
  const [saveOk, setSaveOk] = useState<null | boolean>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("jarvis:webhook") || "";
    setWebhookInput(v);
    setWebhook(v);
  }, []);

  async function handleSaveWebhook() {
    setSaving(true);
    try {
      const val = (webhookInput || "").trim();
      localStorage.setItem("jarvis:webhook", val);
      setWebhook(val);
      setSaveOk(true);
      setTimeout(() => setSaveOk(null), 1500);
    } catch {
      setSaveOk(false);
      setTimeout(() => setSaveOk(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  // store — через any, чтобы не падать от имён экшенов
  const tasks      = useTasks((s: any) => s.tasks);
  const addTask    = useTasks((s: any) => s.add ?? s.create ?? s.addTask);
  const removeTask = useTasks((s: any) => s.remove ?? s.delete ?? s.removeTask);
  const getById    = useTasks((s: any) => s.getById ?? ((id: string) => (s.tasks || []).find((t: any) => t.id === id)));

  // UI
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailTask = useMemo(() => (detailId ? getById(detailId) : undefined), [detailId, getById]);

  return (
    <main className="container-page py-8">
      {/* header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            JARVIS <span className="text-indigo-600">regular tasks</span>
          </h1>
          <p className="text-sm text-muted-foreground">Создавай регулярные задачи для Bitrix24 без ограничений тарифа.</p>
        </div>

        {/* webhook */}
        <div className="w-full md:w-[560px]">
          <label className="block text-sm text-muted-foreground mb-1">Bitrix24 webhook</label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={webhookInput}
              onChange={(e) => setWebhookInput(e.target.value)}
              placeholder="https://your.bitrix24.kz/rest/<user>/<token>/"
              className="w-full rounded-2xl border bg-white/70 shadow-sm ring-1 ring-black/5 px-4 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <button
              onClick={handleSaveWebhook}
              disabled={saving}
              className="rounded-2xl bg-indigo-600 text-white px-4 py-2 shadow-sm hover:bg-indigo-700 active:scale-[.98] transition disabled:opacity-60"
            >
              {saving ? "Сохр." : "Сохранить"}
            </button>
          </div>
          {saveOk !== null && (
            <div className={`mt-1 text-xs ${saveOk ? "text-green-600" : "text-red-600"}`}>
              {saveOk ? "Сохранено" : "Ошибка сохранения"}
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-2xl bg-indigo-600 text-white px-5 py-2.5 shadow-sm hover:bg-indigo-700 active:scale-[.98] transition"
        >
          Создать задачу
        </button>
      </div>

      {/* grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tasks?.map((t: any) => (
          // @ts-ignore — TaskCard расширен под onOpen/onDelete
          <TaskCard key={t.id} task={t} onOpen={() => setDetailId(t.id)} onDelete={() => removeTask?.(t.id)} />
        ))}
      </div>

      {/* details modal */}
      <Modal open={!!detailTask} onClose={() => setDetailId(null)}>
        {detailTask ? (
          <TaskDetails
            task={detailTask}
            onDelete={async () => {
              try {
                await fetch("/api/regular/unregister", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: detailTask.id }),
                });
              } catch {}
              removeTask?.(detailTask.id);
              setDetailId(null);
            }}
            onClose={() => setDetailId(null)}
          />
        ) : null}
      </Modal>

      {/* create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <TaskForm
          webhookBase={webhook}
          onCancel={() => setCreateOpen(false)}
          onCreated={(task: any) => {
            addTask?.(task);
            setCreateOpen(false);
          }}
        />
      </Modal>
    </main>
  );
}
