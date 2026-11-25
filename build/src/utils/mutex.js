export class AsyncMutex {
    queue = Promise.resolve();
    async acquire() {
        let releaseLock;
        const lockAcquired = new Promise(resolve => {
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
//# sourceMappingURL=mutex.js.map