import { Redis } from '@upstash/redis';

const MESSAGE_INDEX_KEY = 'aa:messages:index';

function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Storage is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.');
  }

  return Redis.fromEnv();
}

export async function saveClientMessage(message) {
  const redis = getRedisClient();
  await redis.lpush(MESSAGE_INDEX_KEY, JSON.stringify(message));
  await redis.ltrim(MESSAGE_INDEX_KEY, 0, 199);
}

export async function loadClientMessages() {
  const redis = getRedisClient();
  const rawMessages = await redis.lrange(MESSAGE_INDEX_KEY, 0, 199);

  return rawMessages
    .map(function (rawMessage) {
      try {
        return JSON.parse(rawMessage);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}
