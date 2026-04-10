import { vi } from 'vitest';

export const pgQueryMock = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
export const pgEndMock = vi.fn().mockResolvedValue(undefined);

export const sqliteAllMock = vi.fn().mockReturnValue([]);
export const sqliteRunMock = vi.fn().mockReturnValue({ changes: 0 });
export const sqlitePrepareMock = vi.fn().mockReturnValue({
  all: sqliteAllMock,
  run: sqliteRunMock,
});
export const sqliteCloseMock = vi.fn();
