import fs from "node:fs/promises";
import path from "node:path";

type JobTemplate = {
  title: string;
  description?: string;
  responsibleId?: string | number;
  coAssignees?: (string | number)[];
  observers?: (string | number)[];
  priority?: 1 | 2;
  requireResult?: boolean;
  deadline?: string | null; // "YYYY-MM-DDTHH:mm" (локаль пользователя)
};

export type Job = {
  id: string;
  kind: "daily" | "minutely";
  timeOfDay?: string;
  stepMinutes?: number;
  tzOffsetMinutes: number;       // TZ пользователя
  nextRunISO: string;            // UTC
  startAtISO?: string;
  endAtISO?: string;
  remainingRuns?: number;
  template: JobTemplate;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "schedules.json");
const PORTAL_TZ = Number(process.env.BITRIX_TZ_OFFSET_MINUTES ?? 0); // ← UTC+6 = 360

function ensureDir(p: string) { return fs.mkdir(p, { recursive: true }).catch(() => {}); }

// локал.пользователя → локал.порта (без TZ)
function localToPortalLocalString(yyyyMmDdThhMm?: string | null, userTzMin?: number | null) {
  if (!yyyyMmDdThhMm || userTzMin == null) return undefined;
  const m = String(yyyyMmDdThhMm).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const [_, ys, ms, ds, hs, mins] = m;
  const y = +ys, mo = +ms - 1, d = +ds, h = +hs, mi = +mins;
  const utc = Date.UTC(y, mo, d, h, mi) - userTzMin * 60_000;
  const portal = new Date(utc + PORTAL_TZ * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${portal.getUTCFullYear()}-${pad(portal.getUTCMonth() + 1)}-${pad(portal.getUTCDate())}T${pad(portal.getUTCHours())}:${pad(portal.getUTCMinutes())}:00`;
}

function calcNextRunDaily(timeOfDay: string, tzOffsetMinutes: number, from = new Date()): Date {
  const localNow = new Date(from.getTime() + tzOffsetMinutes * 60_000);
  const [hh, mm] = timeOfDay.split(":").map((x) => parseInt(x, 10));
  const localRun = new Date(localNow); localRun.setHours(hh, mm, 0, 0);
  if (localRun <= localNow) localRun.setDate(localRun.getDate() + 1);
  return new Date(localRun.getTime() - tzOffsetMinutes * 60_000);
}
function calcNextRunMinutely(stepMinutes = 1, from = new Date()): Date {
  const next = new Date(from); next.setSeconds(0, 0); next.setMinutes(next.getMinutes() + stepMinutes); return next;
}
function localDateTimeToUTC(dateYYYYMMDD: string, timeHHmm: string, tzOffsetMinutes: number): Date {
  const [y, m, d] = dateYYYYMMDD.split("-").map((x) => parseInt(x, 10));
  const [hh, mm] = timeHHmm.split(":").map((x) => parseInt(x, 10));
  const localAsUTC = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  return new Date(localAsUTC.getTime() - tzOffsetMinutes * 60_000);
}

class Scheduler {
  private jobs = new Map<string, Job>();
  private timer: NodeJS.Timeout | null = null;
  private saving = false;

  constructor() { this.init().catch((e) => console.error("[scheduler] init error", e)); }

  private async init() {
    await ensureDir(DATA_DIR);
    await this.load();
    if (!this.timer) {
      this.timer = setInterval(() => this.tick().catch((e) => console.error("[scheduler] tick error", e)), 10_000);
      setTimeout(() => this.tick().catch(() => {}), 2_000);
    }
    console.log("[scheduler] started, jobs:", this.jobs.size);
  }

  private async load() {
    try { const buf = await fs.readFile(DATA_FILE, "utf8"); (JSON.parse(buf) as Job[]).forEach((j) => this.jobs.set(j.id, j)); }
    catch { /* файла ещё нет */ }
  }
  private async save() {
    if (this.saving) return; this.saving = true;
    try { await fs.writeFile(DATA_FILE, JSON.stringify([...this.jobs.values()], null, 2), "utf8"); }
    finally { this.saving = false; }
  }

  list(): Job[] { return [...this.jobs.values()]; }

  async register(input: {
    id: string; kind: "daily" | "minutely"; timeOfDay?: string; stepMinutes?: number;
    tzOffsetMinutes: number; remainingRuns?: number;
    startDateYYYYMMDD?: string; endDateYYYYMMDD?: string;
    template: JobTemplate;
  }) {
    const now = new Date();
    let next = input.kind === "daily"
      ? calcNextRunDaily(input.timeOfDay || "05:00", input.tzOffsetMinutes, now)
      : calcNextRunMinutely(input.stepMinutes || 1, now);

    let startAtUTC: Date | undefined;
    if (input.startDateYYYYMMDD) {
      startAtUTC = input.kind === "daily"
        ? localDateTimeToUTC(input.startDateYYYYMMDD, input.timeOfDay || "05:00", input.tzOffsetMinutes)
        : localDateTimeToUTC(input.startDateYYYYMMDD, "00:00", input.tzOffsetMinutes);
      if (next < startAtUTC) next = startAtUTC;
    }

    let endAtUTC: Date | undefined;
    if (input.endDateYYYYMMDD) {
      const [y, m, d] = input.endDateYYYYMMDD.split("-").map((x) => parseInt(x, 10));
      const localEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      endAtUTC = new Date(localEnd.getTime() - input.tzOffsetMinutes * 60_000);
    }

    const job: Job = {
      id: input.id, kind: input.kind, timeOfDay: input.timeOfDay, stepMinutes: input.stepMinutes,
      tzOffsetMinutes: input.tzOffsetMinutes, nextRunISO: next.toISOString(),
      startAtISO: startAtUTC?.toISOString(), endAtISO: endAtUTC?.toISOString(),
      remainingRuns: input.remainingRuns, template: input.template,
    };

    this.jobs.set(job.id, job);
    await this.save();
    return job;
  }

  async unregister(id: string) { this.jobs.delete(id); await this.save(); }

  private async tick() {
    if (this.jobs.size === 0) return;
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (job.endAtISO && now > new Date(job.endAtISO)) { await this.unregister(job.id); continue; }

      const due = new Date(job.nextRunISO);
      if (now < due) continue;

      try {
        await this.createBitrixTask(job); // ← передаём весь job (есть tz)

        if (typeof job.remainingRuns === "number") {
          job.remainingRuns -= 1;
          if (job.remainingRuns <= 0) { await this.unregister(job.id); continue; }
        }

        const next = job.kind === "daily"
          ? calcNextRunDaily(job.timeOfDay || "05:00", job.tzOffsetMinutes, now)
          : calcNextRunMinutely(job.stepMinutes || 1, now);

        if (job.startAtISO && next < new Date(job.startAtISO)) next.setTime(new Date(job.startAtISO).getTime());

        job.nextRunISO = next.toISOString();
        await this.save();
        console.log("[scheduler] run job", job.id, "next:", job.nextRunISO);
      } catch (e) {
        console.error("[scheduler] job error", job.id, e);
        const next = job.kind === "daily"
          ? calcNextRunDaily(job.timeOfDay || "05:00", job.tzOffsetMinutes, now)
          : calcNextRunMinutely(job.stepMinutes || 1, now);
        job.nextRunISO = next.toISOString();
        await this.save();
      }
    }
  }

  private async createBitrixTask(job: Job) {
    const base = process.env.BITRIX_WEBHOOK_BASE;
    if (!base) throw new Error("BITRIX_WEBHOOK_BASE not set");
    const url = base.replace(/\/?$/, "/") + "tasks.task.add.json";

    const t = job.template;
    const fields: any = {
      TITLE: t.title || "",
      DESCRIPTION: t.description || "",
      RESPONSIBLE_ID: t.responsibleId ? Number(t.responsibleId) : undefined,
      ACCOMPLICES: (t.coAssignees || []).map((x) => Number(x)).filter((n) => Number.isFinite(n)),
      AUDITORS: (t.observers || []).map((x) => Number(x)).filter((n) => Number.isFinite(n)),
      PRIORITY: t.priority === 2 ? 2 : 1,
      TASK_CONTROL: t.requireResult ? "Y" : "N",
    };

    const dl = localToPortalLocalString(t.deadline || undefined, job.tzOffsetMinutes);
    if (dl) fields.DEADLINE = dl;

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
    const json = await res.json().catch(async () => ({ raw: await res.text() }));
    if (!res.ok || json?.error) throw new Error(`Bitrix error: ${json?.error || res.status}`);
    return json?.result;
  }
}

// singleton
declare global { var __REGULAR_SCHEDULER__: Scheduler | undefined; }
const scheduler = global.__REGULAR_SCHEDULER__ ?? new Scheduler();
if (!global.__REGULAR_SCHEDULER__) global.__REGULAR_SCHEDULER__ = scheduler;
export default scheduler;
