"use client";
import React from "react";
import type { Task } from "../lib/types";
import { nextOccurrenceDaily, formatRu } from "../lib/time";

export default function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const nextRun = task.repeatRule?.isRecurring && task.repeatRule.timeOfDay
    ? nextOccurrenceDaily(task.repeatRule.timeOfDay)
    : null;

  return (
    <div
      onClick={onClick}
      className="w-[450px] h-[450px] bg-white rounded-2xl shadow hover:shadow-lg transition-shadow border cursor-pointer flex flex-col overflow-hidden"
    >
      <div className="p-4 border-b flex items-start gap-2">
        <div className="flex-1">
          <h4 className="font-semibold text-lg line-clamp-2">{task.title || "Без названия"}</h4>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{task.description}</p>
        </div>
        {task.repeatRule?.isRecurring && (
          <span className="inline-block text-xs px-2 py-1 rounded-full bg-brand-100 text-brand-700">Регулярная</span>
        )}
      </div>

      <div className="p-4 space-y-3 text-sm flex-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Исполнитель</span>
          <span className="font-medium">{task.assignee?.name || task.assignee?.email || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Постановщик</span>
          <span className="">{task.creator?.name || task.creator?.email || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Создана</span>
          <span>{formatRu(new Date(task.createdAt))}</span>
        </div>
        {task.dueDate && (
          <div className="flex justify-between">
            <span className="text-gray-500">Крайний срок</span>
            <span className="font-medium">{formatRu(new Date(task.dueDate))}</span>
          </div>
        )}
        {nextRun && (
          <div className="flex justify-between">
            <span className="text-gray-500">Следующее создание</span>
            <span className="font-medium">{formatRu(nextRun)}</span>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-gray-50 mt-auto text-xs text-gray-600">
        Кликните, чтобы открыть полные данные
      </div>
    </div>
  );
}
