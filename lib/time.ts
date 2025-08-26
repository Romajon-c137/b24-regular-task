import { format } from "date-fns";

export function formatRu(date: Date) {
  return format(date, "dd.MM.yyyy HH:mm");
}

export function nextOccurrenceDaily(timeOfDay: string): Date | null {
  if (!timeOfDay) return null;
  const [hh, mm] = timeOfDay.split(":").map((n) => parseInt(n, 10));
  const now = new Date();
  const next = new Date();
  next.setHours(hh, mm, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}
