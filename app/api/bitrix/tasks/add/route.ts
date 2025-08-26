import { NextResponse } from 'next/server'

function toYN(v: any) {
  return v ? 'Y' : 'N'
}
function toISOSeconds(s?: string | null) {
  if (!s) return undefined
  const d = new Date(s)
  if (isNaN(d.getTime())) return undefined
  // ISO c секундами
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

type AnyObj = Record<string, any>

export async function POST(req: Request) {
  const incoming = (await req.json()) as AnyObj

  // поддержка двух форматов тела
  const t: AnyObj = incoming.task ?? incoming

  const webhookBase =
    (typeof incoming.webhookBase === 'string' && incoming.webhookBase) ||
    process.env.BITRIX_WEBHOOK_BASE

  if (!webhookBase) {
    return NextResponse.json(
      { error: 'BITRIX_WEBHOOK_BASE is not set' },
      { status: 500 }
    )
  }

  // заголовок
  const title: string = (t.title ?? t.TITLE ?? '').toString().trim()
  if (!title) {
    return NextResponse.json(
      { error: 'VALIDATION', error_description: 'Пустое название задачи' },
      { status: 400 }
    )
  }

  // исполнитель/соисполнители
  let responsibleId: number | undefined = undefined
  let accomplices: number[] | undefined = undefined
  if (Array.isArray(t.assignees) && t.assignees.length > 0) {
    const ids = t.assignees
      .map((x: any) => Number(x?.id ?? x))
      .filter((n: any) => Number.isFinite(n))
    if (ids.length > 0) {
      responsibleId = ids[0]
      if (ids.length > 1) accomplices = ids.slice(1)
    }
  } else if (t.responsibleId != null) {
    const n = Number(t.responsibleId)
    if (Number.isFinite(n)) responsibleId = n
  }

  // наблюдатели → AUDITORS
  const auditors: number[] | undefined = Array.isArray(t.observers)
    ? t.observers
        .map((x: any) => Number(x?.id ?? x))
        .filter((n: any) => Number.isFinite(n))
    : undefined

  // приоритет
  // isImportant: true -> PRIORITY 2 (срочная); иначе t.priority (0|1|2) либо 0
  let priority: 0 | 1 | 2 = 0
  if (typeof t.priority === 'number' && [0, 1, 2].includes(t.priority)) {
    priority = t.priority
  } else if (t.isImportant === true) {
    priority = 2
  }

  // постановщик
  const createdBy =
    t.creatorId != null && Number.isFinite(Number(t.creatorId))
      ? Number(t.creatorId)
      : undefined

  const fields: AnyObj = {
    TITLE: title,
    DESCRIPTION: (t.description ?? '').toString(),
    RESPONSIBLE_ID: responsibleId,
    ACCOMPLICES: accomplices,
    AUDITORS: auditors,
    PRIORITY: priority,
    CREATED_BY: createdBy,
    TASK_CONTROL: toYN(t.requireResult),
  }

  const deadline = toISOSeconds(t.deadline ?? t.dueDate)
  if (deadline) fields.DEADLINE = deadline

  async function call(method: string, payload: AnyObj) {
    const url =
      (webhookBase.endsWith('/') ? webhookBase : webhookBase + '/') +
      method +
      '.json'
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await r.json()
    // Bitrix кладёт ошибку в {error, error_description}
    const ok = r.ok && !data?.error
    return { ok, data }
  }

  try {
    // 1) новый метод
    let { ok, data } = await call('tasks.task.add', { fields })
    if (!ok) {
      // 2) старый метод: требует "data" вместо "fields"
      const resp = await call('task.add', { data: fields })
      if (!resp.ok) {
        return NextResponse.json(resp.data, { status: 502 })
      }
      return NextResponse.json(resp.data, { status: 200 })
    }
    return NextResponse.json(data, { status: 200 })
  } catch (e) {
    return NextResponse.json(
      { error: 'DISPATCH', error_description: 'Failed to create task in Bitrix' },
      { status: 502 }
    )
  }
}
