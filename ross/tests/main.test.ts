import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@/cli', () => ({
  runCli: vi.fn().mockResolvedValue(undefined),
}));

describe('main.ts entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('invokes runCli upon module execution', async () => {
    const {runCli} = await import('@/cli');
    await import('@/main');
    expect(runCli).toHaveBeenCalledTimes(1);
  });
});
