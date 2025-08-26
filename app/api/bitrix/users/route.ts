export const dynamic = "force-dynamic";

/** Нормализуем пользователя Bitrix в минимальный вид для формы */
function mapUser(u: any) {
  const name = [u?.NAME, u?.LAST_NAME].filter(Boolean).join(" ").trim();
  // иногда e-mail лежит в WORK_EMAIL
  const email = (u?.EMAIL || u?.WORK_EMAIL || "").trim();
  return {
    id: String(u?.ID ?? ""),
    name: name || email || "Без имени",
    email,
    active: String(u?.ACTIVE ?? "Y") === "Y",
  };
}

/** Тянем все страницы user.get (Bitrix пагинирует через ?start=) */
async function fetchAllUsers(base: string) {
  const urlBase = base.endsWith("/") ? base : base + "/";
  const method = "user.get.json";
  let start: number | undefined = undefined;
  const out: any[] = [];

  while (true) {
    const url = new URL(urlBase + method);
    // фильтр: только активные
    url.searchParams.set("FILTER[ACTIVE]", "Y");
    if (start !== undefined) url.searchParams.set("start", String(start));

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Bitrix error ${res.status}`);
    const data = await res.json();

    const result: any[] = data?.result || [];
    out.push(...result);

    if (data?.next !== undefined) {
      start = data.next;
    } else break;
  }
  return out;
}

export async function GET() {
  const base = process.env.BITRIX_WEBHOOK_BASE;
  if (!base) {
    return new Response(JSON.stringify({ error: "BITRIX_WEBHOOK_BASE not set" }), { status: 500 });
  }
  try {
    const raw = await fetchAllUsers(base);
    const users = raw.map(mapUser)
      // иногда в портале бывают «пустые» пользователи — отфильтруем
      .filter((u) => u.id && (u.name || u.email))
      // сортировка: сначала активные по имени
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return Response.json({ users });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Fetch failed" }), { status: 500 });
  }
}
