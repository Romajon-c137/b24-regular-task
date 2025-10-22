export const STORAGE_KEY = "userToken";

export type UserInfo = {
  token: string | null;
  role?: string | null;
  webhook?: string | null;
};

type StoredShape = { info: UserInfo };

export function getRawUser(): StoredShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredShape) : null;
  } catch {
    return null;
  }
}

export function setUserInfo(info: UserInfo) {
  if (typeof window === "undefined") return;
  const payload: StoredShape = { info };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function removeUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
