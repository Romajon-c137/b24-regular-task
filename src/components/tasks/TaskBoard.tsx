"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BitrixUser,
  TaskItem,
  fetchActiveUsers,
  fetchTasks,
} from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";

type U = { id: number; name: string; avatarUrl?: string | null };
type UserMap = Record<number, U>;

function toUserMap(list: BitrixUser[]): UserMap {
  const m: UserMap = {};
  for (const u of list) {
    const id = Number(u.ID);
    const name =
      [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(" ") ||
      `ID ${u.ID}`;
    const avatarUrl = u.PHOTO_URL ?? (typeof u.PERSONAL_PHOTO === "string" ? u.PERSONAL_PHOTO : null);
    m[id] = { id, name, avatarUrl };
  }
  return m;
}
function getUser(map: UserMap, id: number): U {
  return map[id] ?? { id, name: `ID ${id}`, avatarUrl: null };
}
function fmtDate(dt?: string | null) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" };
    return d.toLocaleString(undefined, opts);
  } catch {
    return dt;
  }
}
function Priority({ p }: { p: 0 | 1 | 2 }) {
  const map = {
    0: { text: "низкий", cls: "bx-badge bx-green" },
    1: { text: "средний", cls: "bx-badge bx-yellow" },
    2: { text: "высокий", cls: "bx-badge bx-red" },
  } as const;
  const v = map[p];
  return <span className={v.cls}>{v.text}</span>;
}
function AvatarStack({ users }: { users: U[] }) {
  const cut = users.slice(0, 7);
  const rest = users.length - cut.length;
  return (
    <div className="bx-astack">
      {cut.map((u) => (
        <Avatar key={u.id} name={u.name} src={u.avatarUrl ?? undefined} size={24} title={u.name} />
      ))}
      {rest > 0 && <div className="bx-astack-more">+{rest}</div>}
    </div>
  );
}
function TaskCard({ t, users }: { t: TaskItem; users: UserMap }) {
  const creator = t.creator_by ? getUser(users, t.creator_by) : undefined;
  const responsibles: U[] = (t.responsible_ids || []).map((id) => getUser(users, id));
  return (
    <div className="bx-kcard">
      <div className="bx-kcard-head">
        <Link className="bx-kcard-title" href={`/tasks/${t.id}`}>{t.title}</Link>
        <div className="bx-kcard-tags">
          {t.task_control && <div className="bx-chip">Контроль задачи</div>}
          <Priority p={t.priority ?? 0} />
        </div>
      </div>
      <div className="bx-kcard-row"><span className="bx-kcard-label">Последний запуск</span><span className="bx-kcard-val">{fmtDate(t.the_last_run)}</span></div>
      <div className="bx-kcard-row"><span className="bx-kcard-label">Следующий запуск</span><span className="bx-kcard-val">{fmtDate(t.next_run)}</span></div>
      <div className="bx-kcard-avatars">
        <div className="bx-kcard-side">
          <div className="bx-kcard-label mini">Постановщик</div>
          {creator ? <Avatar name={creator.name} src={creator.avatarUrl ?? undefined} size={28} /> : <div className="bx-empty-avatar" />}
        </div>
        <div className="bx-kcard-side right">
          <div className="bx-kcard-label mini">Исполнители</div>
          <AvatarStack users={responsibles} />
        </div>
      </div>
    </div>
  );
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [t, u] = await Promise.all([fetchTasks(), fetchActiveUsers()]);
        if (!mounted) return;
        setTasks(t);
        setUserMap(toUserMap(u));
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const daily = useMemo(() => tasks.filter((t) => t.repeat_type === "days"), [tasks]);
  const monthly = useMemo(() => tasks.filter((t) => t.repeat_type === "month"), [tasks]);

  if (loading) return <div className="bx-card">Загрузка…</div>;

  return (
    <div className="bx-board-wrap">
      <div className="bx-board-bg" />
      <div className="bx-board">
        <section className="bx-column">
          <header className="bx-col-head bx-col-green"><div className="bx-col-title">Каждый день</div><span className="bx-col-count">{daily.length}</span></header>
          <div className="bx-col-body">{daily.length === 0 ? <div className="bx-empty">Нет задач</div> : daily.map((t) => <TaskCard key={t.id} t={t} users={userMap} />)}</div>
        </section>
        <section className="bx-column">
          <header className="bx-col-head bx-col-blue"><div className="bx-col-title">Каждый месяц</div><span className="bx-col-count">{monthly.length}</span></header>
          <div className="bx-col-body">{monthly.length === 0 ? <div className="bx-empty">Нет задач</div> : monthly.map((t) => <TaskCard key={t.id} t={t} users={userMap} />)}</div>
        </section>
      </div>
    </div>
  );
}
