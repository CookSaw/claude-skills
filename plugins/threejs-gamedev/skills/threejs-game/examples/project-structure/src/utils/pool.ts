/**
 * Object Pool
 * Reuse objects to avoid garbage collection pressure.
 * Critical for projectiles, particles, and frequently spawned objects.
 */

/**
 * Generic object pool for reusing instances.
 *
 * @example
 * ```typescript
 * // Pool of Vector3
 * const vecPool = new ObjectPool(
 *   () => new THREE.Vector3(),
 *   (v) => v.set(0, 0, 0)
 * );
 *
 * const vec = vecPool.acquire();
 * vec.set(1, 2, 3);
 * // ... use vec ...
 * vecPool.release(vec);
 * ```
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  /**
   * @param createFn - Factory function to create new instances
   * @param resetFn - Function to reset an instance before reuse
   * @param initialSize - Number of instances to pre-create
   * @param maxSize - Maximum pool size (default: unlimited)
   */
  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    initialSize = 0,
    maxSize = Infinity
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  /**
   * Get an object from the pool.
   * Creates a new one if pool is empty.
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  /**
   * Return an object to the pool.
   * The object is reset before being stored.
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
    // If pool is full, just let GC collect it
  }

  /**
   * Release multiple objects at once.
   */
  releaseAll(objects: T[]): void {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  /**
   * Clear all pooled objects.
   * Useful when changing levels or cleaning up.
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Get the current number of available objects in the pool.
   */
  get available(): number {
    return this.pool.length;
  }

  /**
   * Pre-warm the pool with additional instances.
   */
  prewarm(count: number): void {
    const toCreate = Math.min(count, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.createFn());
    }
  }
}

/**
 * Typed pool specifically for Three.js objects that need dispose().
 * Automatically calls dispose on clear.
 */
export class DisposablePool<T extends { dispose?: () => void }> extends ObjectPool<T> {
  private disposeFn?: (obj: T) => void;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    disposeFn?: (obj: T) => void,
    initialSize = 0,
    maxSize = Infinity
  ) {
    super(createFn, resetFn, initialSize, maxSize);
    this.disposeFn = disposeFn;
  }

  /**
   * Clear pool and dispose all objects.
   */
  override clear(): void {
    if (this.disposeFn) {
      // Access internal pool through acquire
      let obj: T | undefined;
      while (this.available > 0) {
        obj = this.acquire();
        this.disposeFn(obj);
      }
    }
    super.clear();
  }
}

/**
 * Factory for common pool types
 */
export const PoolFactory = {
  /**
   * Create a pool for simple objects with properties to reset.
   */
  createSimplePool<T extends object>(
    template: () => T,
    defaults: Partial<T>
  ): ObjectPool<T> {
    return new ObjectPool(
      template,
      (obj) => Object.assign(obj, defaults)
    );
  },
} as const;
