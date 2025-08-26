// app/api/bitrix/tasks/add/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddTaskPayload = {
  task: {
    title: string;
    description?: string;
    creatorId?: string | number;
    assignees: { id: string | number }[];
    observers?: (string | number)[];
    isImportant?: boolean;
    requireResult?: boolean;
    dueDate?: string | null;
    checklist?: { text: string; isComplete?: boolean }[];
  };
  webhookBase?: string;
};

function toBitrixDeadline(localISO?: string | null): string | undefined {
  if (!localISO) return undefined;
  const d = new Date(localISO);
  // формат 26.08.2025 18:00
  const pad = (n: number) => String(n).padStart(2, "0");
  const s =
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return s;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AddTaskPayload;
    const base = (body.webhookBase || process.env.BITRIX_WEBHOOK_BASE || "").trim();
    if (!base) return new Response(JSON.stringify({ error: "No webhook base" }), { status: 400 });
    const root = base.endsWith("/") ? base : base + "/";

    const { task } = body;
    const assignees = (task.assignees || []).map((a) => a.id);

    const results: any[] = [];
    for (const rid of assignees.length ? assignees : [undefined]) {
      const fields: any = {
        TITLE: task.title || "",
        DESCRIPTION: task.description || "",
        RESPONSIBLE_ID: rid ? Number(rid) : undefined,
        CREATED_BY: task.creatorId ? Number(task.creatorId) : undefined,
        AUDITORS: (task.observers || []).map((x) => Number(x)).filter((n) => Number.isFinite(n)),
        PRIORITY: task.isImportant ? 2 : 1,
        TASK_CONTROL: task.requireResult ? "Y" : "N",
      };
      const dl = toBitrixDeadline(task.dueDate || undefined);
      if (dl) fields.DEADLINE = dl;

      const checklist = (task.checklist || []).filter((i) => i.text?.trim());
      if (checklist.length) {
        fields.CHECKLIST = checklist.map((i) => ({ TITLE: i.text, IS_COMPLETE: i.isComplete ? "Y" : "N" }));
      }

      const url = root + "tasks.task.add.json";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const json = await res.json().catch(async () => ({ raw: await res.text() }));
      if (!res.ok || json?.error) {
        results.push({ ok: false, error: json?.error || res.status });
      } else {
        results.push({ ok: true, result: json.result });
      }
    }

    return Response.json({ ok: true, results });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "add failed" }), { status: 500 });
  }
}
