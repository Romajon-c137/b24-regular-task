// lib/kv.ts
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set");
}

const redis = new Redis({ url, token });
export default redis;

// Небольшие хелперы, чтобы код был читабельнее
export const kv = {
  // хранение json
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await redis.get<string>(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async setJSON(key: string, value: unknown) {
    return redis.set(key, JSON.stringify(value));
  },
  // для очереди расписаний
  zadd: (key: string, score: number, member: string) => redis.zadd(key, { score, member }),
  zrem: (key: string, member: string) => redis.zrem(key, member),
  zrangeByScore: (key: string, min: number, max: number) => redis.zrangebyscore<string[]>(key, min, max),
};
