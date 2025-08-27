/**
 * Enhanced caching system with TTL and invalidation strategies
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  defaultTTL?: number;
  maxSize?: number;
  cleanupInterval?: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  keys: string[];
  oldestEntry?: number;
  newestEntry?: number;
}

/**
 * Advanced cache implementation with TTL, LRU eviction, and automatic cleanup
 */
export class AdvancedCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats = { hits: 0, misses: 0 };
  private cleanupTimer?: any; // NodeJS.Timeout

  constructor(private options: CacheOptions = {}) {
    this.options = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      cleanupInterval: 60 * 1000, // 1 minute
      ...options
    };

    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Store data in cache with optional TTL
   */
  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl ?? this.options.defaultTTL!;

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.options.maxSize!) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 0,
      lastAccessed: now
    });
  }

  /**
   * Retrieve data from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    const now = Date.now();
    
    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;

    return entry.data;
  }

  /**
   * Get or compute value with caching
   */
  async getOrCompute<R extends T>(
    key: string,
    computer: () => Promise<R>,
    ttl?: number
  ): Promise<R> {
    const cached = this.get(key);
    
    if (cached !== undefined) {
      return cached as R;
    }

    const computed = await computer();
    this.set(key, computed, ttl);
    return computed;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Invalidate entries based on pattern or predicate
   */
  invalidate(pattern?: string | RegExp | ((key: string, entry: CacheEntry<T>) => boolean)): number {
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      let shouldDelete = false;

      if (pattern === undefined) {
        shouldDelete = true;
      } else if (typeof pattern === 'string') {
        shouldDelete = key.includes(pattern);
      } else if (pattern instanceof RegExp) {
        shouldDelete = pattern.test(key);
      } else if (typeof pattern === 'function') {
        shouldDelete = pattern(key, entry);
      }

      if (shouldDelete) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Refresh TTL for a specific key
   */
  refresh(key: string, ttl?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    entry.timestamp = Date.now();
    if (ttl !== undefined) {
      entry.ttl = ttl;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.entries());
    const timestamps = entries.map(([, entry]) => entry.timestamp);

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      keys: Array.from(this.cache.keys()),
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined
    };
  }

  /**
   * Export cache contents (for debugging/persistence)
   */
  export(): Record<string, { data: T; timestamp: number; ttl: number }> {
    const exported: Record<string, { data: T; timestamp: number; ttl: number }> = {};
    
    for (const [key, entry] of this.cache.entries()) {
      exported[key] = {
        data: entry.data,
        timestamp: entry.timestamp,
        ttl: entry.ttl
      };
    }
    
    return exported;
  }

  /**
   * Import cache contents
   */
  import(data: Record<string, { data: T; timestamp: number; ttl: number }>): void {
    const now = Date.now();
    
    for (const [key, item] of Object.entries(data)) {
      // Only import non-expired entries
      if (now - item.timestamp < item.ttl) {
        this.cache.set(key, {
          data: item.data,
          timestamp: item.timestamp,
          ttl: item.ttl,
          accessCount: 0,
          lastAccessed: now
        });
      }
    }
  }

  /**
   * Dispose cache and cleanup
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }

  // Private methods

  private startCleanup(): void {
    if (this.options.cleanupInterval! > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.options.cleanupInterval);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private evictLRU(): void {
    if (this.cache.size === 0) {return;}

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Cache manager for handling multiple named caches
 */
export class CacheManager {
  private caches = new Map<string, AdvancedCache<any>>();
  private defaultOptions: CacheOptions;

  constructor(defaultOptions: CacheOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a named cache
   */
  getCache<T>(name: string, options?: CacheOptions): AdvancedCache<T> {
    let cache = this.caches.get(name);
    
    if (!cache) {
      cache = new AdvancedCache<T>({ ...this.defaultOptions, ...options });
      this.caches.set(name, cache);
    }
    
    return cache;
  }

  /**
   * Delete a named cache
   */
  deleteCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.dispose();
      return this.caches.delete(name);
    }
    return false;
  }

  /**
   * Get statistics for all caches
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    
    return stats;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Dispose all caches
   */
  disposeAll(): void {
    for (const cache of this.caches.values()) {
      cache.dispose();
    }
    this.caches.clear();
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  cleanupInterval: 60 * 1000 // 1 minute
});