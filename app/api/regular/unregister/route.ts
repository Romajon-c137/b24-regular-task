import scheduler from "../../../../lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) return new Response(JSON.stringify({ ok: false, error: "id required" }), { status: 400 });

    await scheduler.unregister(id);
    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "unregister failed" }), { status: 500 });
  }
}
