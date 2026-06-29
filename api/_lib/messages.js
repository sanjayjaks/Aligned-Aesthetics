import { Redis } from '@upstash/redis';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MESSAGE_INDEX_KEY = 'aa:messages:index';

let redisClient = null;
let useLocalFallback = false;

function getRedisClient() {
  if (redisClient) return redisClient;
  if (useLocalFallback) return null;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // If not in Vercel Production/Preview, allow local fallback
    if (!process.env.VERCEL_ENV) {
      console.warn('Redis not configured. Falling back to local file storage.');
      useLocalFallback = true;
      return null;
    }
    throw new Error('Storage is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.');
  }

  redisClient = Redis.fromEnv();
  return redisClient;
}

const MESSAGE_STORE_DIR = path.join(process.cwd(), '.data');
const MESSAGE_STORE_FILE = path.join(MESSAGE_STORE_DIR, 'messages.json');

async function ensureLocalStore() {
  await fs.mkdir(MESSAGE_STORE_DIR, { recursive: true });
  try {
    await fs.access(MESSAGE_STORE_FILE);
  } catch (error) {
    await fs.writeFile(MESSAGE_STORE_FILE, '[]', 'utf8');
  }
}

async function readLocalStore() {
  await ensureLocalStore();
  try {
    const raw = await fs.readFile(MESSAGE_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeLocalStore(messages) {
  await ensureLocalStore();
  await fs.writeFile(MESSAGE_STORE_FILE, JSON.stringify(messages.slice(0, 200), null, 2), 'utf8');
}

export async function saveClientMessage(message) {
  const redis = getRedisClient();
  
  if (!redis) {
    const messages = await readLocalStore();
    messages.unshift(message);
    await writeLocalStore(messages);
    return;
  }

  await redis.lpush(MESSAGE_INDEX_KEY, JSON.stringify(message));
  await redis.ltrim(MESSAGE_INDEX_KEY, 0, 199);
}

export async function loadClientMessages() {
  const redis = getRedisClient();
  
  if (!redis) {
    return await readLocalStore();
  }

  const rawMessages = await redis.lrange(MESSAGE_INDEX_KEY, 0, 199);

  return rawMessages
    .map(function (rawMessage) {
      try {
        return (typeof rawMessage === 'string') ? JSON.parse(rawMessage) : rawMessage;
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}
