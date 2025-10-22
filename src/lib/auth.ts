import { getRawUser } from "./storage";

export function getToken(): string | null {
  const u = getRawUser();
  return (u?.info?.token as string) ?? null;
}

export function getRole(): string | null {
  const u = getRawUser();
  return (u?.info?.role as string) ?? null;
}

export function getWebhook(): string | null {
  const u = getRawUser();
  return (u?.info?.webhook as string) ?? null;
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}
