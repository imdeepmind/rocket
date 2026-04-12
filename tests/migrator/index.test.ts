import {execSync} from 'child_process';
import * as fs from 'fs';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import migrateDatabase from '@/migrator/index';

import {AppConfig} from '@/schema/config';

vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    mkdtempSync: vi.fn(),
    writeFileSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('migrateDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.mkdtempSync).mockReturnValue('/mock/tmp/dir');
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getBaseConfig = (engine: 'sqlite' | 'pg') =>
    ({
      name: 'test-app',
      database: {
        engine,
        connection: {
          urlOrPath: engine === 'sqlite' ? 'test.db' : 'postgres://db',
        },
      },
      models: [],
      routes: {},
    }) as unknown as AppConfig;

  it('should generate schema file for sqlite full coverage', async () => {
    const config = getBaseConfig('sqlite');
    config.models = [
      {
        name: 'users',
        fields: [
          {name: 'id', type: 'integer', primaryKey: true},
          {name: 'isActive', type: 'boolean'},
          {name: 'username', type: 'string', unique: true, nullable: false},
          {name: 'bio', type: 'text', default: 'hello'},
          {name: 'createdAt', type: 'datetime'},
          // @ts-expect-error testing fallback condition
          {name: 'unknown', type: 'unknown_type'},
        ],
        indexes: [
          {name: 'username_idx', columns: ['username'], unique: true},
          {name: 'bio_idx', columns: ['bio'], unique: false},
        ],
      },
    ];

    await migrateDatabase(config);

    // checking if it is trying to write schema and config
    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(2);

    // Call 1: schema.ts
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;
    expect(schemaContent).toContain(
      "import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'",
    );
    expect(schemaContent).toContain("export const users = sqliteTable('users'");
    expect(schemaContent).toContain(
      "id: integer('id').primaryKey({ autoIncrement: true })",
    );
    expect(schemaContent).toContain("isActive: integer('isActive')");
    expect(schemaContent).toContain(
      "username: text('username').unique().notNull()",
    );
    expect(schemaContent).toContain('bio: text(\'bio\').default("hello")');
    expect(schemaContent).toContain(
      "createdAt: integer('createdAt', { mode: 'timestamp' })",
    );
    expect(schemaContent).toContain("unknown: text('unknown')");
    expect(schemaContent).toContain(
      "uniqueIndex('username_idx').on(t.username)",
    );
    expect(schemaContent).toContain("index('bio_idx').on(t.bio)");

    // Call 2: drizzle.config.ts
    const drizzleConfigContent = writeFileSyncMock.mock.calls[1][1] as string;
    expect(drizzleConfigContent).toContain("dialect: 'sqlite'");
    expect(drizzleConfigContent).toContain("url: 'test.db'");

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('npm run generate:sql -- --config='),
      {stdio: 'inherit'},
    );
  });

  it('should generate schema file for pg full coverage', async () => {
    const config = getBaseConfig('pg');
    config.models = [
      {
        name: 'posts',
        fields: [
          {name: 'id', type: 'integer', primaryKey: true},
          {name: 'count', type: 'integer'},
          {name: 'title', type: 'string', unique: true, nullable: false},
          {name: 'body', type: 'text', default: 'content'},
          {name: 'published', type: 'boolean'},
          {name: 'updatedAt', type: 'datetime'},
          // @ts-expect-error testing fallback condition
          {name: 'unknown', type: 'unknown_type'},
        ],
        indexes: [
          {name: 'title_idx', columns: ['title'], unique: true},
          {name: 'body_idx', columns: ['body'], unique: false},
        ],
      },
    ];

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(2);

    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;
    expect(schemaContent).toContain(
      "import { pgTable, serial, integer, text, boolean, doublePrecision, index, uniqueIndex, timestamp } from 'drizzle-orm/pg-core'",
    );
    expect(schemaContent).toContain("export const posts = pgTable('posts'");
    expect(schemaContent).toContain("id: serial('id').primaryKey()");
    expect(schemaContent).toContain("count: integer('count')");
    expect(schemaContent).toContain("title: text('title').unique().notNull()");
    expect(schemaContent).toContain('body: text(\'body\').default("content")');
    expect(schemaContent).toContain("published: boolean('published')");
    expect(schemaContent).toContain("updatedAt: timestamp('updatedAt')");
    expect(schemaContent).toContain("unknown: text('unknown')");
    expect(schemaContent).toContain("uniqueIndex('title_idx').on(t.title)");
    expect(schemaContent).toContain("index('body_idx').on(t.body)");

    const drizzleConfigContent = writeFileSyncMock.mock.calls[1][1] as string;
    expect(drizzleConfigContent).toContain("dialect: 'postgresql'");
    expect(drizzleConfigContent).toContain("url: 'postgres://db'");

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('npm run generate:sql -- --config='),
      {stdio: 'inherit'},
    );
  });

  it('should generate empty schemas gracefully', async () => {
    const config = getBaseConfig('pg');
    config.models = [
      {
        name: 'empty',
        fields: [],
      },
    ];
    await migrateDatabase(config);
    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;
    expect(schemaContent).toContain("export const empty = pgTable('empty', {");
  });

  it('should create .migrations directory if it does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await migrateDatabase(getBaseConfig('sqlite'));

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.migrations'),
      {
        recursive: true,
      },
    );
  });

  it('should not create .migrations directory if it already exists', async () => {
    vi.mocked(fs.existsSync).mockImplementation(pathToCheck => {
      if (
        typeof pathToCheck === 'string' &&
        pathToCheck.includes('.migrations') &&
        !pathToCheck.includes('drizzle-')
      ) {
        return true;
      }
      return true;
    });

    await migrateDatabase(getBaseConfig('sqlite'));

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('should cleanup temp directory on success', async () => {
    vi.mocked(fs.existsSync).mockImplementation(() => {
      return true;
    });

    await migrateDatabase(getBaseConfig('sqlite'));

    expect(fs.rmSync).toHaveBeenCalledWith('/mock/tmp/dir', {
      recursive: true,
      force: true,
    });
  });

  it('should handle errors thrown by execSync and still cleanup', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('execSync failed');
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw error;
    });

    vi.mocked(fs.existsSync).mockImplementation(() => true);

    await expect(migrateDatabase(getBaseConfig('sqlite'))).rejects.toThrow(
      'execSync failed',
    );

    expect(fs.rmSync).toHaveBeenCalledWith('/mock/tmp/dir', {
      recursive: true,
      force: true,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Migrationed failed to run: ',
      error,
    );

    consoleLogSpy.mockRestore();
  });

  it('should handle errors thrown during cleanup gracefully', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.mocked(fs.existsSync).mockImplementation(() => true);
    vi.mocked(fs.rmSync).mockImplementation(() => {
      throw new Error('cleanup error');
    });

    await migrateDatabase(getBaseConfig('sqlite'));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to cleanup temp directory:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
