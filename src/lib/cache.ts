import { Redis } from "ioredis";

class CacheService {
  private redis: Redis | null = null;
  private useMemoryFallback = false;
  private memoryCache = new Map<string, { data: any; expires: number }>();

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        this.redis.on('error', (err) => {
          console.warn('Redis connection error, falling back to memory cache:', err);
          this.useMemoryFallback = true;
        });
      } else {
        console.warn('REDIS_URL not provided, using memory cache');
        this.useMemoryFallback = true;
      }
    } catch (error) {
      console.warn('Failed to initialize Redis, using memory cache:', error);
      this.useMemoryFallback = true;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useMemoryFallback || !this.redis) {
        const cached = this.memoryCache.get(key);
        if (cached && cached.expires > Date.now()) {
          return cached.data as T;
        }
        this.memoryCache.delete(key);
        return null;
      }

      const result = await this.redis.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    try {
      if (this.useMemoryFallback || !this.redis) {
        this.memoryCache.set(key, {
          data: value,
          expires: Date.now() + (ttlSeconds * 1000),
        });

        // Clean up expired entries occasionally
        if (Math.random() < 0.01) {
          this.cleanupMemoryCache();
        }
        return;
      }

      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  async setMultiple(items: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    try {
      if (this.useMemoryFallback || !this.redis) {
        items.forEach(({ key, value, ttl = 3600 }) => {
          this.memoryCache.set(key, {
            data: value,
            expires: Date.now() + (ttl * 1000),
          });
        });
        return;
      }

      const pipeline = this.redis.pipeline();
      items.forEach(({ key, value, ttl = 3600 }) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
    } catch (error) {
      console.warn('Cache setMultiple error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.useMemoryFallback || !this.redis) {
        this.memoryCache.delete(key);
        return;
      }

      await this.redis.del(key);
    } catch (error) {
      console.warn('Cache delete error:', error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      if (this.useMemoryFallback || !this.redis) {
        // Simple pattern matching for memory cache
        const keys = Array.from(this.memoryCache.keys());
        const regex = new RegExp(pattern.replace('*', '.*'));
        keys.forEach(key => {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        });
        return;
      }

      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.warn('Cache invalidate error:', error);
    }
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Specific cache key generators
  messageBodyKey(userId: number, messageId: number): string {
    return `message:body:${userId}:${messageId}`;
  }

  threadMessagesKey(userId: number, threadId: number): string {
    return `thread:messages:${userId}:${threadId}`;
  }

  userThreadsKey(userId: number, label?: string, search?: string): string {
    const suffix = label || search ? `:${label || 'all'}:${search || 'nosearch'}` : '';
    return `user:threads:${userId}${suffix}`;
  }
}

export const cacheService = new CacheService();