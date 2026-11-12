import {describe, expect, test} from 'vitest';

import {AsyncMutex} from '@/utils/mutex';

describe('AsyncMutex', () => {
  test('acquires lock immediately when unlocked', async () => {
    const mutex = new AsyncMutex();
    const unlock = await mutex.acquire();
    expect(typeof unlock).toBe('function');
    unlock();
  });

  test('serializes concurrent tasks in FIFO order', async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    const task = async (id: number, delayMs: number) => {
      const unlock = await mutex.acquire();
      order.push(id);
      await new Promise(res => setTimeout(res, delayMs));
      unlock();
    };

    await Promise.all([task(1, 20), task(2, 10), task(3, 5)]);

    expect(order).toEqual([1, 2, 3]);
  });

  test('calling unlock multiple times is idempotent', async () => {
    const mutex = new AsyncMutex();
    const unlock = await mutex.acquire();
    unlock();
    unlock(); // Should not throw or cause multiple releases

    // Subsequent acquire should still work normally
    const unlock2 = await mutex.acquire();
    unlock2();
  });
});
