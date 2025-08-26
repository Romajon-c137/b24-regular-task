// lib/kv.ts
import { Redis } from "@upstash/redis";

/**
 * Ленивая инициализация клиента.
 * Нельзя бросать ошибку на уровне импорта — Next подгружает файлы на build.
 */
let _client: Redis | null = null;

function getClient(): Redis {
  if (_client) return _client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Бросаем только при РЕАЛЬНОМ обращении к Redis, а не на импорте
    throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set");
  }

  _client = new Redis({ url, token });
  return _client;
}

// Экспорт "сырого" клиента как прокси, чтобы не инициализировать на импорт
const redis = new Proxy(
  {},
  {
    get(_t, prop) {
      // @ts-expect-error — проксируем любые методы реального клиента
      return getClient()[prop];
    },
  }
) as unknown as Redis;

export default redis;

export const kv = {
  // JSON helpers
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await getClient().get<string>(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async setJSON(key: string, value: unknown) {
    return getClient().set(key, JSON.stringify(value));
  },

  // sorted set helpers
  zadd(key: string, score: number, member: string) {
    return getClient().zadd(key, { score, member });
  },
  zrem(key: string, member: string) {
    return getClient().zrem(key, member);
  },
  // у @upstash/redis нет zrangebyscore → используем zrange с byScore: true
  async zrangeByScore(key: string, min: number, max: number): Promise<string[]> {
    // типы у версии разные — берём any для совместимости
    const res = await (getClient() as any).zrange(key, min, max, { byScore: true });
    return res as string[];
  },
};
