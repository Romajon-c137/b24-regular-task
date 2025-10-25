/* eslint-disable @typescript-eslint/no-namespace */

// src/lib/api.ts
import { getToken, getWebhook } from "./auth";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_LOGIN_URL: string;
      NEXT_PUBLIC_TASKS_URL: string;
    }
  }
}
const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL 

export type LoginBody = { phone: string; password: string };
export type LoginResp = { token?: string; webhook?: string; [k: string]: unknown };

export async function postLogin(
  body: LoginBody
): Promise<{ ok: boolean; status: number; data: LoginResp | null }> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { accept: "application/json", "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });

  let data: LoginResp | null = null;
  try {
    data = (await res.json()) as LoginResp;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/** ---------- TASKS API ---------- */
const TASKS_URL = process.env.NEXT_PUBLIC_TASKS_URL

/** Bitrix users (через webhook) */
export type BitrixUser = {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  ACTIVE?: "Y" | "N";
  PERSONAL_PHOTO?: number | string | null;
  PHOTO_URL?: string | null; // итоговый URL, если удалось получить
};

type BitrixListResponse<T> = { result?: T };

/** безопасное получение массива из ответа */
function pickArray<T>(res: BitrixListResponse<unknown>): T[] {
  return Array.isArray(res.result) ? (res.result as T[]) : [];
}

async function enrichPhoto(users: BitrixUser[]): Promise<BitrixUser[]> {
  const webhook = getWebhook();
  if (!webhook) return users;

  return Promise.all(
    users.map(async (u) => {
      const ph = u.PERSONAL_PHOTO;
      if (typeof ph === "string" && /^https?:\/\//.test(ph)) {
        u.PHOTO_URL = ph;
        return u;
      }
      if (typeof ph === "number") {
        try {
          const r = await fetch(`${webhook}disk.file.get.json?id=${ph}`);
          if (r.ok) {
            const j = (await r.json()) as BitrixListResponse<{ DOWNLOAD_URL?: string }>;
            const url = (j as unknown as { result?: { DOWNLOAD_URL?: string } })?.result?.DOWNLOAD_URL;
            if (url) u.PHOTO_URL = String(url);
          }
        } catch {
          /* ignore */
        }
      }
      return u;
    })
  );
}

export async function fetchActiveUsers(): Promise<BitrixUser[]> {
  const webhook = getWebhook();
  if (!webhook) return [];

  const url =
    `${webhook}user.get.json?` +
    `FILTER[ACTIVE]=Y&SELECT[]=ID&SELECT[]=NAME&SELECT[]=LAST_NAME&SELECT[]=SECOND_NAME&SELECT[]=PERSONAL_PHOTO`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return [];
  const data = (await res.json()) as BitrixListResponse<unknown>;
  const list = pickArray<BitrixUser>(data);
  return enrichPhoto(list);
}

export async function fetchUsersByIds(ids: number[]): Promise<BitrixUser[]> {
  const webhook = getWebhook();
  if (!webhook || !ids?.length) return [];

  const params = new URLSearchParams();
  ids.forEach((id) => params.append("FILTER[ID]", String(id)));
  params.append("SELECT[]", "ID");
  params.append("SELECT[]", "NAME");
  params.append("SELECT[]", "LAST_NAME");
  params.append("SELECT[]", "SECOND_NAME");
  params.append("SELECT[]", "PERSONAL_PHOTO");

  const url = `${webhook}user.get.json?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return [];
  const data = (await res.json()) as BitrixListResponse<unknown>;
  const list = pickArray<BitrixUser>(data);
  return enrichPhoto(list);
}

/** --------- Tasks --------- */
export type ChecklistItem = { id?: number; task?: number; text: string; is_complete?: boolean };

export type TaskItem = {
  id: number;
  title: string;
  description?: string;
  creator_by?: number | null;
  responsible_ids: number[];
  auditors: number[];
  priority: 0 | 1 | 2;
  task_control: boolean;
  start_now?: boolean;
  start_task?: string | null;   // ISO
  deadline?: string | null;     // "HH:MM"
  check_list?: ChecklistItem[];
  repeat_type?: "none" | "days" | "month";
  repeat_interval?: number | null;
  the_last_run: string | null;
  next_run?: string | null;
};

export async function fetchTasks(): Promise<TaskItem[]> {
  const headers: Record<string, string> = { accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(TASKS_URL, { method: "GET", headers });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as TaskItem[]) : [];
}

export async function fetchTask(id: number): Promise<TaskItem | null> {
  const headers: Record<string, string> = { accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(`${TASKS_URL}${id}/`, { method: "GET", headers });
  if (!res.ok) return null;
  return (await res.json()) as TaskItem;
}

export type CreateTaskPayload = {
  title: string;
  description: string;
  creator_by: number;
  responsible_ids: number[];
  auditors_input: number[];
  priority: 0 | 1 | 2;
  task_control: boolean;
  start_now?: boolean;
  start_task?: string;          // ISO
  deadline?: string;            // "HH:MM"
  check_list?: { text: string; is_complete?: boolean }[];
  repeat_type: "none" | "days" | "month";
  repeat_interval: number;
};

export async function createTask(body: CreateTaskPayload) {
  const headers: Record<string, string> = {
    accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(TASKS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let data: unknown = null;
  try {
    data = (await res.json()) as unknown;
  } catch {}
  return { ok: res.ok, status: res.status, data };
}

export type UpdateTaskPayload = Omit<CreateTaskPayload, "start_now">;

export async function updateTask(id: number, body: UpdateTaskPayload) {
  const headers: Record<string, string> = {
    accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(`${TASKS_URL}${id}/`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  let data: unknown = null;
  try {
    data = (await res.json()) as unknown;
  } catch {}
  return { ok: res.ok, status: res.status, data };
}

export async function deleteTask(id: number) {
  const headers: Record<string, string> = { accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(`${TASKS_URL}${id}/`, { method: "DELETE", headers });
  return { ok: res.ok, status: res.status };
}
