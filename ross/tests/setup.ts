import {vi} from 'vitest';

import {
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
