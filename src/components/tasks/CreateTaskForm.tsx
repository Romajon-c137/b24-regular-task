"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BitrixUser,
  createTask,
  fetchActiveUsers,
  CreateTaskPayload,
} from "@/lib/api";

type Option = { id: number; label: string };
type Props = { onSuccess?: () => void };

function userToOption(u: BitrixUser): Option {
  const name =
    [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(" ") ||
    `User ${u.ID}`;
  return { id: Number(u.ID), label: name };
}

function nowForDatetimeLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function toTimeOnly(dtLocal: string): string {
  if (!dtLocal) return "";
  const justTime = dtLocal.includes("T") ? dtLocal.split("T")[1] : dtLocal;
  return justTime.slice(0, 5); // "HH:MM"
}

export default function CreateTaskForm({ onSuccess }: Props) {
  const [users, setUsers] = useState<Option[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creatorId, setCreatorId] = useState<number | "">("");
  const [responsibles, setResponsibles] = useState<number[]>([]);
  const [auditors, setAuditors] = useState<number[]>([]);
  const [priority, setPriority] = useState<0 | 1 | 2>(0);
  const [taskControl, setTaskControl] = useState<boolean>(false);
  const [startNow, setStartNow] = useState<boolean>(false);


  const [startTask, setStartTask] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");

  const [repeatType, setRepeatType] = useState<"none" | "days" | "month">(
    "none"
  );
  const repeatInterval = useMemo(
    () => (repeatType === "none" ? 0 : 1),
    [repeatType]
  );

  const [checklist, setChecklist] = useState<
    { text: string; is_complete?: boolean }[]
  >([]);
  const [newCheck, setNewCheck] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchActiveUsers();
        if (!mounted) return;
        setUsers(list.map(userToOption));
      } finally {
        setLoadingUsers(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const minDT = nowForDatetimeLocal();
  const toggleInArray = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Заполните заголовок");
      return;
    }
    if (!description.trim()) {
      setError("Заполните описание");
      return;
    }
    if (!creatorId) {
      setError("Выберите постановщика (creator_by)");
      return;
    }

    const payload: CreateTaskPayload = {
      title: title.trim(),
      description: description.trim(),
      creator_by: Number(creatorId),
      responsible_ids: responsibles,
      auditors_input: auditors,
      priority,
      task_control: taskControl,
      start_now: startNow, // ← добавили

      // если "Запустить сразу" включен — start_task можно не слать
      start_task: startNow
        ? undefined
        : (startTask ? new Date(startTask).toISOString() : undefined),

      deadline: deadline ? toTimeOnly(deadline) : undefined,
      check_list: checklist.length ? checklist : undefined,
      repeat_type: repeatType,
      repeat_interval: repeatInterval,
    };
    setStartNow(false);


    try {
      setSubmitting(true);
      const { ok, status } = await createTask(payload);
      if (!ok) {
        setError(`Ошибка сохранения (${status})`);
        return;
      }
      // reset
      setTitle("");
      setDescription("");
      setCreatorId("");
      setResponsibles([]);
      setAuditors([]);
      setPriority(0);
      setTaskControl(false);
      setStartTask("");
      setDeadline("");
      setChecklist([]);
      setNewCheck("");
      setRepeatType("none");
      onSuccess?.();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setSubmitting(false);
    }
    window.location.reload(); // ✅ просто обновляем страницу

  };

  return (
    <form onSubmit={submit} className="bx-form">
      <div className="bx-field">
        <label className="bx-label">Заголовок *</label>
        <input
          className="bx-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Введите заголовок"
          required
        />
      </div>

      <div className="bx-field">
        <label className="bx-label">Описание *</label>
        <textarea
          className="bx-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Краткое описание задачи"
          rows={4}
          required
        />
      </div>

      <div className="bx-field">
        <label className="bx-label">Постановщик *</label>
        <select
          className="bx-select"
          value={creatorId}
          onChange={(e) =>
            setCreatorId(e.target.value ? Number(e.target.value) : "")
          }
          disabled={loadingUsers}
          required
        >
          <option value="">Выберите пользователя…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bx-field">
        <div className="bx-label">Исполнители</div>
        <div className="bx-list">
          {loadingUsers && <p className="bx-muted">Загрузка пользователей…</p>}
          {!loadingUsers &&
            users.map((u) => (
              <label key={u.id} className="bx-check">
                <input
                  type="checkbox"
                  checked={responsibles.includes(u.id)}
                  onChange={() =>
                    setResponsibles((prev) => toggleInArray(prev, u.id))
                  }
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

      {/* Начало + Повтор — в одной строке */}
      <div className="bx-grid-2">
        <div className="bx-field">
          <label className="bx-label">Начало</label>
          <input
            className="bx-input"
            type="datetime-local"
            value={startTask}
            min={minDT}
            step={60}
            onChange={(e) => setStartTask(e.target.value)}
          />
        </div>

        <div className="bx-field">
          <label className="bx-label">Повтор задачи</label>
          <select
            className="bx-select"
            value={repeatType}
            onChange={(e) =>
              setRepeatType(e.target.value as "none" | "days" | "month")
            }
          >
            <option value="none">Без повтора</option>
            <option value="days">Каждый день</option>
            <option value="month">Каждый месяц</option>
          </select>

        </div>
      </div>

      {/* Крайний срок — после наблюдателей */}
      <div className="bx-field">
        <label className="bx-label">Крайний срок (время)</label>
        <input
          className="bx-input"
          type="time"
          step={60}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <div className="bx-grid-2">
        <div className="bx-field">
          <label className="bx-label">Приоритет</label>
          <select
            className="bx-select"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as 0 | 1 | 2)}
          >
            <option value={0}>0 — низкий</option>
            <option value={1}>1 — средний</option>
            <option value={2}>2 — высокий</option>
          </select>
        </div>

        <div className="bx-field bx-switch">
          <label className="bx-label">Контроль задачи</label>
          <label className="bx-toggle">
            <input
              type="checkbox"
              checked={taskControl}
              onChange={(e) => setTaskControl(e.target.checked)}
            />
            <span />
          </label>
        </div>
      </div>
      <label className="bx-check" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={startNow}
          onChange={(e) => setStartNow(e.target.checked)}
        />
        <span>Запустить сразу</span>
      </label>

      <div className="bx-field">
        <div className="bx-label">Чек-лист</div>
        <div className="bx-inline" >
          <input
            className="bx-input"
            type="text"
            value={newCheck}
            placeholder="Новый пункт…"
            onChange={(e) => setNewCheck(e.target.value)}
            style={{width:"100%"}}
          />
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
                <span>{c.text}</span>
                <button
                  type="button"
                  className="bx-icon-btn"
                  onClick={() =>
                    setChecklist((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="bx-error">{error}</p>}

      <div className="bx-actions">
        <button className="bx-btn" type="button" onClick={onSuccess}>
          Отмена
        </button>
        <button className="bx-btn bx-btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Сохранение…" : "Создать"}
        </button>
      </div>
    </form>
  );
}
