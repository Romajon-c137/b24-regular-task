"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/components/ui/Modal";
import CreateTaskForm from "@/components/tasks/CreateTaskForm";
import TaskBoard from "@/components/tasks/TaskBoard";

export default function DashboardPage() {
  useAuth({ requireAuth: true });
  const [open, setOpen] = useState(false);

  return (
    <main className="bx-container">
      <div className="bx-toolbar">
        <h1 className="bx-title">Задачи</h1>
        <button className="bx-btn bx-btn-primary" onClick={() => setOpen(true)}>
          + Создать задачу
        </button>
      </div>

      <TaskBoard />

      <Modal open={open} onClose={() => setOpen(false)} title="Создать задачу">
        <CreateTaskForm onSuccess={() => setOpen(false)} />
      </Modal>
    </main>
  );
}
