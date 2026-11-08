export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let releaseLock: () => void;
    const lockAcquired = new Promise<void>(resolve => {
      releaseLock = resolve;
    });

    const previousLock = this.queue;
    this.queue = previousLock.then(() => lockAcquired);

    await previousLock;

    let released = false;
    return () => {
      if (!released) {
        released = true;
        releaseLock();
      }
    };
  }
}
