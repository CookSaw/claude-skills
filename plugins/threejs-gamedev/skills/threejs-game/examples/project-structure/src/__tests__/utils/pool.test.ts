/**
 * Object Pool Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { ObjectPool } from '../../utils/pool';

describe('ObjectPool', () => {
  it('should create new objects when pool is empty', () => {
    let createCount = 0;
    const pool = new ObjectPool(
      () => ({ id: ++createCount }),
      (obj) => { obj.id = 0; }
    );

    const obj1 = pool.acquire();
    const obj2 = pool.acquire();

    expect(obj1.id).toBe(1);
    expect(obj2.id).toBe(2);
    expect(createCount).toBe(2);
  });

  it('should reuse released objects', () => {
    const pool = new ObjectPool(
      () => ({ value: Math.random() }),
      (obj) => { obj.value = 0; }
    );

    const obj1 = pool.acquire();
    // Store original value to verify object was created with initial random value
    void obj1.value; // Original random value
    obj1.value = 42;
    pool.release(obj1);

    const obj2 = pool.acquire();
    expect(obj2).toBe(obj1); // Same object reference
    expect(obj2.value).toBe(0); // Reset by resetFn
  });

  it('should track available objects', () => {
    const pool = new ObjectPool(
      () => ({}),
      () => {}
    );

    expect(pool.available).toBe(0);

    const obj1 = pool.acquire();
    expect(pool.available).toBe(0);

    pool.release(obj1);
    expect(pool.available).toBe(1);

    pool.acquire();
    expect(pool.available).toBe(0);
  });

  it('should pre-populate with initial size', () => {
    const createFn = vi.fn(() => ({}));
    const pool = new ObjectPool(createFn, () => {}, 5);

    expect(createFn).toHaveBeenCalledTimes(5);
    expect(pool.available).toBe(5);
  });

  it('should respect max size', () => {
    const pool = new ObjectPool(
      () => ({}),
      () => {},
      0,
      2 // maxSize
    );

    const obj1 = pool.acquire();
    const obj2 = pool.acquire();
    const obj3 = pool.acquire();

    pool.release(obj1);
    pool.release(obj2);
    pool.release(obj3); // Should be ignored (pool full)

    expect(pool.available).toBe(2);
  });

  it('should clear all pooled objects', () => {
    const pool = new ObjectPool(
      () => ({}),
      () => {}
    );

    const obj1 = pool.acquire();
    const obj2 = pool.acquire();
    pool.release(obj1);
    pool.release(obj2);

    expect(pool.available).toBe(2);

    pool.clear();
    expect(pool.available).toBe(0);
  });

  it('should prewarm pool', () => {
    const pool = new ObjectPool(
      () => ({}),
      () => {}
    );

    expect(pool.available).toBe(0);

    pool.prewarm(10);
    expect(pool.available).toBe(10);
  });

  it('should release multiple objects at once', () => {
    const pool = new ObjectPool(
      () => ({}),
      () => {}
    );

    const objects = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(pool.available).toBe(0);

    pool.releaseAll(objects);
    expect(pool.available).toBe(3);
  });
});
