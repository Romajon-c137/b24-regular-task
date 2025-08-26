import redis, { kv } from "../../../../lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobTemplate = {
  title: string;
  description?: string;
  responsibleId?: string | number;
  observers?: (string | number)[];
  priority?: 1 | 2;
  requireResult?: boolean;
  deadline?: string | null; // локальное время пользователя "YYYY-MM-DDTHH:mm"
};

type Job = {
  id: string;
  kind: "daily" | "minutely";
  timeOfDay?: string;
  stepMinutes?: number;
  tzOffsetMinutes: number;   // TZ пользователя
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

function nextMinutelyUTC(stepMinutes = 1, from = new Date()): number {
  const n = new Date(from);
  n.setSeconds(0, 0);
  n.setMinutes(n.getMinutes() + stepMinutes);
  return n.getTime();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const task = body?.task;
    if (!task?.id) return new Response(JSON.stringify({ ok:false, error:"task.id required" }), { status:400 });
    if (!task?.repeatRule?.isRecurring) return new Response(JSON.stringify({ ok:false, error:"repeatRule.isRecurring required" }), { status:400 });

    const mode = String(body?.mode || "daily") as "daily" | "minutely";
    const tz = Number(body?.tzOffsetMinutes ?? task?.tzOffsetMinutes ?? (new Date().getTimezoneOffset() * -1));

    const assignees: Array<{ id?: string | number }> =
      Array.isArray(task?.assignees) && task.assignees.length ? task.assignees
      : task?.assignee ? [task.assignee]
      : [{ id: undefined }];

    const endsRaw = (task?.repeatRule?.endsAtRaw || "").trim();
    const remainingRuns = /^\d+$/.test(endsRaw) ? parseInt(endsRaw, 10) : undefined;

    const jobsReg = [];

    for (const a of assignees) {
      const id = assignees.length ? `${task.id}__u${a.id ?? "na"}` : String(task.id);

      const job: Job = {
        id,
        kind: mode,
        timeOfDay: mode === "daily" ? String(task.repeatRule.timeOfDay || "05:00") : undefined,
        stepMinutes: mode === "minutely" ? Number(body?.stepMinutes || 1) : undefined,
        tzOffsetMinutes: Number.isFinite(tz) ? tz : 0,
        remainingRuns,
        template: {
          title: task.title,
          description: task.description || "",
          responsibleId: a?.id,
          observers: (task.observers || []).map((u: any) => u.id),
          priority: task.isImportant ? 2 : 1,
          requireResult: !!task.requireResult,
          deadline: task.dueDate || null,
        },
      };

      // вычисляем первый nextRun
      const now = new Date();
      const next = job.kind === "daily"
        ? nextDailyUTC(job.timeOfDay || "05:00", job.tzOffsetMinutes, now)
        : nextMinutelyUTC(job.stepMinutes || 1, now);

      await redis.multi()
        .set(`job:${id}`, JSON.stringify(job))
        .zadd("jobs:next", { score: next, member: id })
        .exec();

      jobsReg.push({ id, nextRunISO: new Date(next).toISOString() });
    }

    return Response.json({ ok: true, jobs: jobsReg });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || "register failed" }), { status:500 });
  }
}
