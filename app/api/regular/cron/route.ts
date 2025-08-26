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
  deadline?: string | null;
};
type Job = {
  id: string;
  kind: "daily" | "minutely";
  timeOfDay?: string;
  stepMinutes?: number;
  tzOffsetMinutes: number;
  remainingRuns?: number;
  template: JobTemplate;
};

const PORTAL_TZ = Number(process.env.BITRIX_TZ_OFFSET_MINUTES ?? 0);

function localToPortalLocalString(yyyyMmDdThhMm?: string | null, userTzMin?: number | null) {
  if (!yyyyMmDdThhMm || userTzMin == null) return undefined;
  const m = String(yyyyMmDdThhMm).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const y = +m[1], mo = +m[2]-1, d = +m[3], h = +m[4], mi = +m[5];
  const utc = Date.UTC(y, mo, d, h, mi) - userTzMin * 60_000;
  const portal = new Date(utc + PORTAL_TZ * 60_000);
  const pad = (n:number)=>String(n).padStart(2,"0");
  return `${portal.getUTCFullYear()}-${pad(portal.getUTCMonth()+1)}-${pad(portal.getUTCDate())}T${pad(portal.getUTCHours())}:${pad(portal.getUTCMinutes())}:00`;
}

function nextDailyUTC(timeOfDay: string, tzOffsetMin: number, from = new Date()): number {
  const localNow = new Date(from.getTime() + tzOffsetMin * 60_000);
  const [hh, mm] = timeOfDay.split(":").map((x) => parseInt(x, 10));
  const localRun = new Date(localNow); localRun.setHours(hh, mm, 0, 0);
  if (localRun <= localNow) localRun.setDate(localRun.getDate() + 1);
  return localRun.getTime() - tzOffsetMin * 60_000;
}
function nextMinutelyUTC(stepMinutes = 1, from = new Date()): number {
  const n = new Date(from); n.setSeconds(0,0); n.setMinutes(n.getMinutes()+stepMinutes); return n.getTime();
}

async function createBitrixTask(t: JobTemplate, userTzMin: number) {
  const base = process.env.BITRIX_WEBHOOK_BASE!;
  const url = base.replace(/\/?$/, "/") + "tasks.task.add.json";
  const fields: any = {
    TITLE: t.title || "",
    DESCRIPTION: t.description || "",
    RESPONSIBLE_ID: t.responsibleId ? Number(t.responsibleId) : undefined,
    AUDITORS: (t.observers || []).map((x)=>Number(x)).filter((n)=>Number.isFinite(n)),
    PRIORITY: t.priority === 2 ? 2 : 1,
    TASK_CONTROL: t.requireResult ? "Y" : "N",
  };
  const dl = localToPortalLocalString(t.deadline || undefined, userTzMin);
  if (dl) fields.DEADLINE = dl;

  const res = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ fields })});
  const json = await res.json().catch(async()=>({ raw: await res.text() }));
  if (!res.ok || json?.error) throw new Error(`Bitrix error: ${json?.error || res.status}`);
}

export async function GET() {
  const now = Date.now();
  const ids = await kv.zrangeByScore("jobs:next", 0, now);
  if (!ids || ids.length === 0) return Response.json({ ok: true, ran: 0, at: new Date().toISOString() });

  let ran = 0;

  for (const id of ids) {
    const job = await kv.getJSON<Job>(`job:${id}`);
    if (!job) { await kv.zrem("jobs:next", id); continue; }

    try {
      await createBitrixTask(job.template, job.tzOffsetMinutes);
      ran++;

      if (typeof job.remainingRuns === "number") {
        job.remainingRuns -= 1;
        if (job.remainingRuns <= 0) {
          await redis.multi().del(`job:${id}`).zrem("jobs:next", id).exec();
          continue;
        }
      }

      const next = job.kind === "daily"
        ? nextDailyUTC(job.timeOfDay || "05:00", job.tzOffsetMinutes, new Date())
        : nextMinutelyUTC(job.stepMinutes || 1, new Date());

      await redis.multi()
        .set(`job:${id}`, JSON.stringify(job))
        .zadd("jobs:next", { score: next, member: id })
        .exec();

    } catch (e) {
      // если Битрикс отвалился — отложим на минуту вперёд, чтобы не застряло
      const next = nextMinutelyUTC(1);
      await kv.zadd("jobs:next", next, id);
    }
  }

  return Response.json({ ok: true, ran, at: new Date().toISOString() });
}
