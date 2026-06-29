import { Redis } from '@upstash/redis';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MESSAGE_INDEX_KEY = 'aa:messages:index';

let redisClient = null;
let useFallback = false;
let memoryStore = [];
let useMemoryFallback = false;

function getRedisClient() {
  if (redisClient) return redisClient;
  if (useFallback) return null;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Redis not configured. Falling back to temporary storage.');
    useFallback = true;
    return null;
  }

  redisClient = Redis.fromEnv();
  return redisClient;
}

const MESSAGE_STORE_DIR = path.join(process.cwd(), '.data');
const MESSAGE_STORE_FILE = path.join(MESSAGE_STORE_DIR, 'messages.json');

async function ensureLocalStore() {
  if (useMemoryFallback) return false;
  
  try {
    await fs.mkdir(MESSAGE_STORE_DIR, { recursive: true });
    try {
      await fs.access(MESSAGE_STORE_FILE);
    } catch (error) {
      await fs.writeFile(MESSAGE_STORE_FILE, '[]', 'utf8');
    }
    return true;
  } catch (error) {
    // Vercel serverless has a read-only filesystem
    useMemoryFallback = true;
    return false;
  }
}

async function readLocalStore() {
  const canUseFs = await ensureLocalStore();
  if (!canUseFs) return memoryStore;

  try {
    const raw = await fs.readFile(MESSAGE_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return memoryStore;
  }
}

async function writeLocalStore(messages) {
  const canUseFs = await ensureLocalStore();
  if (!canUseFs) {
    memoryStore = messages.slice(0, 200);
    return;
  }

  try {
    await fs.writeFile(MESSAGE_STORE_FILE, JSON.stringify(messages.slice(0, 200), null, 2), 'utf8');
  } catch (error) {
    memoryStore = messages.slice(0, 200);
    useMemoryFallback = true;
  }
}

export async function saveClientMessage(message) {
  const redis = getRedisClient();
  
  if (!redis) {
    const messages = await readLocalStore();
    messages.unshift(message);
    await writeLocalStore(messages);
    return;
  }

  try {
    await redis.lpush(MESSAGE_INDEX_KEY, JSON.stringify(message));
    await redis.ltrim(MESSAGE_INDEX_KEY, 0, 199);
  } catch (error) {
    console.error('Redis save error:', error);
  }
}

export async function loadClientMessages() {
  const redis = getRedisClient();
  
  if (!redis) {
    return await readLocalStore();
  }

  try {
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
  } catch (error) {
    console.error('Redis load error:', error);
    return [];
  }
}
