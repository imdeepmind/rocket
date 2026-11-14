import {vi} from 'vitest';

import {
  mysqlCreateConnectionMock,
  mysqlEndMock,
  mysqlGetConnectionMock,
  mysqlOnMock,
  mysqlQueryMock,
  pgConnectMock,
  pgEndMock,
  pgQueryMock,
  sqliteCloseMock,
  sqliteExecMock,
  sqlitePrepareMock,
} from '@tests/helpers/db-mocks';

vi.mock('pg', () => {
  return {
    // prettier-ignore
    // eslint-disable-next-line prefer-arrow-callback
    Pool: vi.fn().mockImplementation(function () {
      return {
        query: pgQueryMock,
        end: pgEndMock,
        connect: pgConnectMock,
      };
    }),
  };
});

vi.mock('better-sqlite3', () => {
  return {
    // prettier-ignore
    // eslint-disable-next-line prefer-arrow-callback
    default: vi.fn().mockImplementation(function () {
      return {
        prepare: sqlitePrepareMock,
        close: sqliteCloseMock,
        exec: sqliteExecMock,
      };
    }),
  };
});

vi.mock('mysql2/promise', () => {
  const createPool = vi.fn().mockImplementation(() => ({
    query: mysqlQueryMock,
    end: mysqlEndMock,
    getConnection: mysqlGetConnectionMock,
    on: mysqlOnMock,
  }));
  return {
    default: {
      createPool,
      createConnection: mysqlCreateConnectionMock,
    },
    createPool,
    createConnection: mysqlCreateConnectionMock,
  };
});
