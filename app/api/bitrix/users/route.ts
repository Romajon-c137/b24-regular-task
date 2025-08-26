// app/api/bitrix/users/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromQuery = searchParams.get("webhook") || "";
    const base = (fromQuery || process.env.BITRIX_WEBHOOK_BASE || "").trim();
    if (!base) {
      return new Response(JSON.stringify({ error: "No webhook provided" }), { status: 400 });
    }
    const root = base.endsWith("/") ? base : base + "/";

    // user.get — вернёт активных пользователей
    const url = root + "user.get.json";

    // Bitrix обычно принимает и GET, и POST — используем POST без тела
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
    const json = await res.json().catch(async () => ({ raw: await res.text() }));

    if (!res.ok || (json && json.error)) {
      return new Response(JSON.stringify({ error: json?.error || "Bitrix error", raw: json }), { status: 500 });
    }

    // Возвращаем как есть; фронт сам преобразует в нужный формат
    return Response.json(json);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "users fetch failed" }), { status: 500 });
  }
}
