import { Redis } from '@upstash/redis';

const MESSAGE_INDEX_KEY = 'aa:messages:index';

const redis = Redis.fromEnv();

export async function saveClientMessage(message) {
  await redis.lpush(MESSAGE_INDEX_KEY, JSON.stringify(message));
  await redis.ltrim(MESSAGE_INDEX_KEY, 0, 199);
}

export async function loadClientMessages() {
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
