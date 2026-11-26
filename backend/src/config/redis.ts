import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: Redis | null = null;
let redisAvailable = false;

export interface CachedRbacProfile {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  branchId: string | null;
  branchName: string | null;
  roleId: string;
  roleCode: string;
  roles: string[];
  permissions: string[];
  permissionVersion: number;
  status: string;
}

const RBAC_CACHE_TTL_SECONDS = 300; // 5 phút, sẽ bị xóa ngay lập tức khi Admin sửa quyền

/**
 * In-memory fallback cache khi Redis chưa bật ở môi trường local,
 * giúp tránh truy vấn join 6 bảng RBAC trên mọi request HTTP.
 */
const memoryRbacCache = new Map<string, { profile: CachedRbacProfile; expiresAt: number }>();

export function getRedisClient(): Redis | null {
  if (redisClient) return redisAvailable ? redisClient : null;

  try {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1000,
      commandTimeout: 1000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Ngừng retry để tránh treo request khi Redis chưa bật ở local
        }
        return Math.min(times * 200, 1000);
      },
    });

    redisClient.on('ready', () => {
      redisAvailable = true;
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      if (redisAvailable) {
        logger.warn('Redis connection error, falling back to in-memory + PostgreSQL', {
          error: err.message,
        });
      }
      redisAvailable = false;
    });

    redisClient.connect().catch(() => {
      redisAvailable = false;
    });
  } catch {
    redisAvailable = false;
  }

  return redisAvailable ? redisClient : null;
}

function rbacKey(userId: bigint | string): string {
  return `rbac:user:${userId.toString()}`;
}

export async function getCachedRbacProfile(
  userId: bigint | string
): Promise<CachedRbacProfile | null> {
  const key = rbacKey(userId);
  const client = getRedisClient();
  if (client) {
    try {
      const raw = await client.get(key);
      if (raw) return JSON.parse(raw) as CachedRbacProfile;
    } catch {
      // Fallback sang memory cache
    }
  }

  const mem = memoryRbacCache.get(key);
  if (mem) {
    if (mem.expiresAt > Date.now()) {
      return mem.profile;
    }
    memoryRbacCache.delete(key);
  }
  return null;
}

export async function setCachedRbacProfile(profile: CachedRbacProfile): Promise<void> {
  const key = rbacKey(profile.userId);
  memoryRbacCache.set(key, {
    profile,
    expiresAt: Date.now() + RBAC_CACHE_TTL_SECONDS * 1000,
  });

  const client = getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(profile), 'EX', RBAC_CACHE_TTL_SECONDS);
  } catch {
    // Bỏ qua lỗi cache Redis, đã có memory cache
  }
}

export async function invalidateUserRbacCache(userId: bigint | string): Promise<void> {
  const key = rbacKey(userId);
  memoryRbacCache.delete(key);

  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // No-op
  }
}

export async function invalidateUsersRbacCache(
  userIds: Array<bigint | string>
): Promise<void> {
  if (userIds.length === 0) return;
  for (const id of userIds) {
    memoryRbacCache.delete(rbacKey(id));
  }

  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(...userIds.map((id) => rbacKey(id)));
  } catch {
    // No-op
  }
}
