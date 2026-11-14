import {vi} from 'vitest';

export const pgQueryMock = vi.fn().mockResolvedValue({rows: [], rowCount: 0});
export const pgEndMock = vi.fn().mockResolvedValue(undefined);
export const pgClientQueryMock = vi
  .fn()
  .mockResolvedValue({rows: [], rowCount: 0});
export const pgClientReleaseMock = vi.fn();
export const pgConnectMock = vi.fn().mockResolvedValue({
  query: pgClientQueryMock,
  release: pgClientReleaseMock,
});

export const sqliteAllMock = vi.fn().mockReturnValue([]);
export const sqliteRunMock = vi.fn().mockReturnValue({changes: 0});
export const sqlitePrepareMock = vi.fn().mockReturnValue({
  all: sqliteAllMock,
  run: sqliteRunMock,
});
export const sqliteCloseMock = vi.fn();
export const sqliteExecMock = vi.fn();

export const mysqlQueryMock = vi.fn().mockResolvedValue([[], []]);
export const mysqlEndMock = vi.fn().mockResolvedValue(undefined);
export const mysqlConnQueryMock = vi.fn().mockResolvedValue([[], []]);
export const mysqlConnReleaseMock = vi.fn();
export const mysqlConnBeginTxMock = vi.fn().mockResolvedValue(undefined);
export const mysqlConnCommitMock = vi.fn().mockResolvedValue(undefined);
export const mysqlConnRollbackMock = vi.fn().mockResolvedValue(undefined);
export const mysqlGetConnectionMock = vi.fn().mockResolvedValue({
  query: mysqlConnQueryMock,
  beginTransaction: mysqlConnBeginTxMock,
  commit: mysqlConnCommitMock,
  rollback: mysqlConnRollbackMock,
  release: mysqlConnReleaseMock,
});
export const mysqlCreateConnectionMock = vi.fn().mockResolvedValue({
  query: mysqlConnQueryMock,
  beginTransaction: mysqlConnBeginTxMock,
  commit: mysqlConnCommitMock,
  rollback: mysqlConnRollbackMock,
  end: mysqlEndMock,
});
export const mysqlOnMock = vi.fn();
