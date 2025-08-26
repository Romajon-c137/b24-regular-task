"use client";
import React from "react";
import type { Task } from "../lib/types";
import { formatRu, nextOccurrenceDaily } from "../lib/time";

export default function TaskDetails({ task }: { task: Task }) {
  const nextRun = task.repeatRule?.isRecurring && task.repeatRule.timeOfDay
    ? nextOccurrenceDaily(task.repeatRule.timeOfDay)
    : null;
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500">Название задачи</div>
        <div className="text-lg font-semibold">{task.title}</div>
      </div>
      {task.description && (
        <div>
          <div className="text-xs text-gray-500">Описание</div>
          <div className="whitespace-pre-wrap">{task.description}</div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500">Исполнитель</div>
          <div>{task.assignee?.name || task.assignee?.email || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Постановщик</div>
          <div>{task.creator?.name || task.creator?.email || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Создана</div>
          <div>{formatRu(new Date(task.createdAt))}</div>
        </div>
        {task.dueDate && (
          <div>
            <div className="text-xs text-gray-500">Крайний срок</div>
            <div>{formatRu(new Date(task.dueDate))}</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-3">
        <div className="font-medium mb-2">Регулярность</div>
        <div className="text-sm">
          {task.repeatRule?.isRecurring ? (
            <div className="space-y-1">
              <div>Каждый день в {task.repeatRule.timeOfDay}</div>
              {nextRun && <div>Следующее создание: <span className="font-medium">{formatRu(nextRun)}</span></div>}
              {task.repeatRule.startsAt && <div>Начинать повторение: {task.repeatRule.startsAt}</div>}
              {task.repeatRule.endsAtRaw && <div>Повторять до: {task.repeatRule.endsAtRaw}</div>}
            </div>
          ) : (
            <div className="text-gray-500">Не регулярная</div>
          )}
        </div>
      </div>

      {task.checklist?.length ? (
        <div>
          <div className="font-medium mb-2">Чек-лист</div>
          <ul className="space-y-1">
            {task.checklist!.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input type="checkbox" checked={c.done} readOnly className="size-4" />
                <span className={c.done ? "line-through text-gray-500" : ""}>{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {task.attachments?.length ? (
        <div>
          <div className="font-medium mb-2">Вложения (псевдо)</div>
          <ul className="list-disc pl-5 text-sm">
            {task.attachments!.map((a) => <li key={a.id}>{a.name}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
