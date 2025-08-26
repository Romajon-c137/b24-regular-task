"use client";
import React from "react";

export type Task = {
  id: string;
  title: string;
  dueDate?: string | null;
  isImportant?: boolean;
};

type Props = {
  task: Task;
  onOpen?: () => void;      // открыть детали
  onDelete?: () => void;    // удалить карточку
  onClick?: () => void;     // совместимость
};

export default function TaskCard({ task, onOpen, onDelete, onClick }: Props) {
  const open = onOpen ?? onClick;

  return (
    <div
      onClick={open}
      className="rounded-2xl border bg-white/70 ring-1 ring-black/5 p-4 shadow-sm hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-medium">{task.title || "Без названия"}</h3>
        {onDelete && (
          <button
            className="text-xs text-red-600 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Удалить"
          >
            Удалить
          </button>
        )}
      </div>

      {task.dueDate && (
        <div className="mt-2 text-xs text-muted-foreground">Крайний срок: {task.dueDate}</div>
      )}
      {task.isImportant && (
        <div className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700">
          Важно
        </div>
      )}
    </div>
  );
}
