import { NextResponse } from 'next/server'

const BASE = process.env.BITRIX_WEBHOOK_BASE

export async function GET() {
  if (!BASE) {
    return NextResponse.json({ error: 'BITRIX_WEBHOOK_BASE is not set' }, { status: 500 })
  }
  const url = BASE + 'user.get.json'
  try {
    const r = await fetch(url, { cache: 'no-store' })
    const data = await r.json()
    return NextResponse.json(data, { status: r.ok ? 200 : 500 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch Bitrix users' }, { status: 500 })
  }
}
