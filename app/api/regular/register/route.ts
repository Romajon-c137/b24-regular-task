import redis, { kv } from "../../../../lib/kv";

// app/api/regular/register/route.ts
// import redis from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobTemplate = {
  title: string;
  description?: string;
  responsibleId?: string | number;
  observers?: (string | number)[];
  creatorId?: string | number;      // <-- добавь
  priority?: 1 | 2;
  requireResult?: boolean;
  deadline?: string | null;          // локал. "YYYY-MM-DDTHH:mm"
  webhookBase?: string;              // <-- ВАЖНО: вебхук Bitrix для этой задачи
};

type Job = {
  id: string;
  kind: "daily" | "monthly" | "minutely";
  timeOfDay?: string;                // HH:mm
  dayOfMonth?: number;               // 1..31  (для monthly)
  stepMinutes?: number;              // для тестов
  tzOffsetMinutes: number;
  remainingRuns?: number;
  template: JobTemplate;
  
};

function nextDailyUTC(timeOfDay: string, tzOffsetMin: number, from = new Date()): number {
  const localNow = new Date(from.getTime() + tzOffsetMin * 60_000);
  const [hh, mm] = timeOfDay.split(":").map((x) => parseInt(x, 10));
  const localRun = new Date(localNow); localRun.setHours(hh, mm, 0, 0);
  if (localRun <= localNow) localRun.setDate(localRun.getDate() + 1);
  return localRun.getTime() - tzOffsetMin * 60_000;
}

function daysInMonth(y: number, m0: number) { return new Date(y, m0 + 1, 0).getDate(); }
function clampDay(y: number, m0: number, d: number) { return Math.max(1, Math.min(d, daysInMonth(y, m0))); }
function nextMonthlyUTC(dayOfMonth: number, timeOfDay: string, tzOffsetMin: number, from = new Date()): number {
  const localNow = new Date(from.getTime() + tzOffsetMin * 60_000);
  const [hh, mm] = timeOfDay.split(":").map((x) => parseInt(x, 10));
  const y = localNow.getFullYear();
  const m0 = localNow.getMonth();
  let d = clampDay(y, m0, dayOfMonth);
  let localRun = new Date(localNow); localRun.setDate(d); localRun.setHours(hh, mm, 0, 0);
  if (localRun <= localNow) {
    const ny = m0 === 11 ? y + 1 : y;
    const nm0 = (m0 + 1) % 12;
    d = clampDay(ny, nm0, dayOfMonth);
    localRun = new Date(localNow); localRun.setFullYear(ny, nm0, d); localRun.setHours(hh, mm, 0, 0);
  }
  return localRun.getTime() - tzOffsetMin * 60_000;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const task = body?.task;
    if (!task?.id) return new Response(JSON.stringify({ ok:false, error:"task.id required" }), { status:400 });
    if (!task?.repeatRule?.isRecurring) return new Response(JSON.stringify({ ok:false, error:"repeatRule.isRecurring required" }), { status:400 });

    // Новое: частота (daily|monthly|minutely для тестов)
    const mode = (String(body?.frequency || body?.mode || "daily") as "daily" | "monthly" | "minutely");
    const tz = Number(body?.tzOffsetMinutes ?? task?.tzOffsetMinutes ?? (new Date().getTimezoneOffset() * -1));

    // Исполнители: из чекбоксов (массив) или одиночный
    const assignees: Array<{ id?: string | number }> =
      Array.isArray(task?.assignees) && task.assignees.length ? task.assignees
      : task?.assignee ? [task.assignee]
      : [{ id: undefined }];

    const endsRaw = (task?.repeatRule?.endsAtRaw || "").trim();
    const remainingRuns = /^\d+$/.test(endsRaw) ? parseInt(endsRaw, 10) : undefined;

    const timeOfDay: string = String(task.repeatRule?.timeOfDay || "05:00");
    const dayOfMonth: number | undefined =
      mode === "monthly" ? Number(task.repeatRule?.dayOfMonth || body?.dayOfMonth || 1) : undefined;

    const webhookBase: string | undefined =
      (body?.webhookBase && String(body.webhookBase).trim()) || undefined;

    const jobsReg = [];

    for (const a of assignees) {
      const id = assignees.length ? `${task.id}__u${a.id ?? "na"}` : String(task.id);

      const job: Job = {
        id,
        kind: mode,
        timeOfDay: mode !== "minutely" ? timeOfDay : undefined,
        dayOfMonth,
        stepMinutes: mode === "minutely" ? Number(body?.stepMinutes || 1) : undefined,
        tzOffsetMinutes: Number.isFinite(tz) ? tz : 0,
        remainingRuns,
        template: {
          title: task.title,
          description: task.description || "",
          responsibleId: a?.id,
          creatorId: task.creatorId,  // <-- сюда
          observers: (task.observers || []).map((u: any) => u.id),
          priority: task.isImportant ? 2 : 1,
          requireResult: !!task.requireResult,
          deadline: task.dueDate || null,
          webhookBase, // <- сохраняем вебхук вместе с шаблоном
        },
      };

      const now = new Date();
      let next =
        job.kind === "daily"
          ? nextDailyUTC(timeOfDay, job.tzOffsetMinutes, now)
          : job.kind === "monthly"
          ? nextMonthlyUTC(dayOfMonth ?? 1, timeOfDay, job.tzOffsetMinutes, now)
          : (() => { const n = new Date(now); n.setSeconds(0,0); n.setMinutes(n.getMinutes() + (job.stepMinutes || 1)); return +n; })();

      await (redis as any).multi()
        .set(`job:${id}`, JSON.stringify(job))
        .zadd("jobs:next", { score: next, member: id })
        .exec();

      jobsReg.push({ id, kind: job.kind, nextRunISO: new Date(next).toISOString() });
    }

    return Response.json({ ok: true, jobs: jobsReg });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || "register failed" }), { status:500 });
  }
}
