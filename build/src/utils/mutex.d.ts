export declare class AsyncMutex {
    private queue;
    acquire(): Promise<() => void>;
}
