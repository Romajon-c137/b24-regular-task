export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// конвертируем "локальную" дату пользователя в "локальную" дату портала (без TZ)
function localToPortalLocalString(yyyyMmDdThhMm: string, userTzMin: number, portalTzMin: number) {
  const m = yyyyMmDdThhMm.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const [_, ys, ms, ds, hs, mins] = m;
  const y = parseInt(ys, 10), mo = parseInt(ms, 10) - 1, d = parseInt(ds, 10), h = parseInt(hs, 10), mi = parseInt(mins, 10);
  // timestamp UTC из локального времени пользователя:
  const utc = Date.UTC(y, mo, d, h, mi) - userTzMin * 60_000;
  // "локальное" портала:
  const portal = new Date(utc + portalTzMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${portal.getUTCFullYear()}-${pad(portal.getUTCMonth() + 1)}-${pad(portal.getUTCDate())}T${pad(portal.getUTCHours())}:${pad(portal.getUTCMinutes())}:00`;
}

async function call(base: string, method: string, payload: any) {
  const url = base.replace(/\/?$/, "/") + `${method}.json`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await res.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || data?.error) return { ok: false, status: res.status, error: data?.error || text, data };
  return { ok: true, status: res.status, data };
}

export async function POST(req: Request) {
  const base = process.env.BITRIX_WEBHOOK_BASE;
  if (!base) return new Response(JSON.stringify({ ok: false, error: "BITRIX_WEBHOOK_BASE not set" }), { status: 500 });

  const BODY = await req.json();
  const task = BODY?.task;
  const userTz = Number(BODY?.tzOffsetMinutes);
  const portalTz = Number(process.env.BITRIX_TZ_OFFSET_MINUTES ?? 0); // <-- поставь 360 в .env.local

  // список исполнителей (мульти)
  const assignees: Array<{ id: string | number }> =
    Array.isArray(task?.assignees) && task.assignees.length ? task.assignees :
    task?.assignee ? [task.assignee] : [];

  const baseFields: any = {
    TITLE: task?.title || "",
    DESCRIPTION: task?.description || "",
    ACCOMPLICES: (task?.coAssignees || []).map((u: any) => Number(u.id)).filter((x: any) => Number.isFinite(x)),
    AUDITORS: (task?.observers || []).map((u: any) => Number(u.id)).filter((x: any) => Number.isFinite(x)),
    PRIORITY: task?.isImportant ? 2 : 1,
    TASK_CONTROL: task?.requireResult ? "Y" : "N",
  };

  // дедлайн с учётом TZ портала:
  if (task?.dueDate && Number.isFinite(userTz)) {
    const s = localToPortalLocalString(task.dueDate, userTz, Number.isFinite(portalTz) ? portalTz : userTz);
    if (s) baseFields.DEADLINE = s;
  }

  const checklist = Array.isArray(task?.checklist) ? task.checklist : [];

  const results: any[] = [];
  const targets = assignees.length ? assignees : ([{ id: undefined }] as any[]);

  for (const a of targets) {
    const fields = { ...baseFields, RESPONSIBLE_ID: a?.id ? Number(a.id) : undefined };

    // создаём задачу
    const rAdd = await call(base, "tasks.task.add", { fields });
    if (!rAdd.ok) { results.push(rAdd); continue; }

    // вытащим ID новой задачи
    const d = rAdd.data;
    const taskId =
      d?.result?.task?.id ?? d?.result?.taskId ??
      (typeof d?.result === "number" || typeof d?.result === "string" ? d.result : undefined);

    // добавим чек-лист (если есть)
    if (taskId && checklist.length) {
      let sort = 10;
      for (const item of checklist) {
        const payload = {
          // порядок параметров важен — сначала TASKID, потом FIELDS:
          TASKID: Number(taskId),
          FIELDS: {
            TITLE: String(item.text || "").trim() || "---",
            IS_COMPLETE: item.done ? "Y" : "N",
            SORT_INDEX: sort,
          },
        };
        sort += 10;
        await call(base, "task.checklistitem.add", payload);
      }
    }

    results.push({ ok: true, taskId });
  }

  const ok = results.every((r) => r.ok);
  return new Response(JSON.stringify({ ok, results }), { status: 200 });
}
