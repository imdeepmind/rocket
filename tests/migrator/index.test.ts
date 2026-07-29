import {execSync} from 'child_process';
import * as fs from 'fs';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import migrateDatabase from '@/migrator/index';

import {AppConfig} from '@/interfaces/config';

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

  const getBaseConfig = (engine: 'sqlite' | 'postgres') =>
    ({
      name: 'test-app',
      infrastructure: {
        database: {
          engine,
          connection: {
            url: engine === 'sqlite' ? 'test.db' : 'postgres://db',
          },
        },
      },
      data: {models: {}},
      routes: {},
    }) as unknown as AppConfig;

  it('should generate schema file for sqlite full coverage', async () => {
    const config = getBaseConfig('sqlite');
    config.data.models = {
      users: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          isActive: {type: 'boolean'},
          username: {type: 'string', unique: true, nullable: false},
          bio: {type: 'text', default: 'hello'},
          createdAt: {type: 'datetime'},
          price: {type: 'decimal'},
          birthDate: {type: 'date'},
          metadata: {type: 'json'},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unknown: {type: 'unknown_type' as any},
        },
        indexes: {
          username_idx: {fields: ['username'], unique: true},
          bio_idx: {fields: ['bio'], unique: false},
        },
      },
    };
    await migrateDatabase(config);

    // checking if it is trying to write schema and config
    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(2);

    // Call 1: schema.ts
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;
    expect(schemaContent).toContain(
      "import { sqliteTable, integer, text, real, index, uniqueIndex, foreignKey } from 'drizzle-orm/sqlite-core'",
    );
    expect(schemaContent).toContain("export const users = sqliteTable('users'");
    expect(schemaContent).toContain("id: integer('id').primaryKey()");
    expect(schemaContent).toContain("isActive: integer('isActive')");
    expect(schemaContent).toContain(
      "username: text('username').unique().notNull()",
    );
    expect(schemaContent).toContain('bio: text(\'bio\').default("hello")');
    expect(schemaContent).toContain(
      "createdAt: integer('createdAt', { mode: 'timestamp' })",
    );
    expect(schemaContent).toContain("price: real('price')");
    expect(schemaContent).toContain("birthDate: text('birthDate')");
    expect(schemaContent).toContain(
      "metadata: text('metadata', { mode: 'json' })",
    );
    expect(schemaContent).toContain("unknown: text('unknown')");
    expect(schemaContent).toContain(
      "uniqueIndex('username_idx').on(t.username)",
    );
    expect(schemaContent).toContain("index('bio_idx').on(t.bio)");

    // Call 2: drizzle.config.ts
    const drizzleConfigContent = writeFileSyncMock.mock.calls[1][1] as string;
    expect(drizzleConfigContent).toContain("dialect: 'sqlite'");
    expect(drizzleConfigContent).toContain(
      'url: process.env.DRIZZLE_DATABASE_URL!',
    );

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('npm run generate:sql -- --config='),
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({DRIZZLE_DATABASE_URL: 'test.db'}),
      }),
    );
  });

  it('should generate schema file for pg full coverage', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          count: {type: 'integer'},
          title: {type: 'string', unique: true, nullable: false},
          body: {type: 'text', default: 'content'},
          published: {type: 'boolean'},
          updatedAt: {type: 'datetime'},
          price: {type: 'decimal'},
          birthDate: {type: 'date'},
          config: {type: 'json'},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unknown: {type: 'unknown_type' as any},
        },
        indexes: {
          title_idx: {fields: ['title'], unique: true},
          body_idx: {fields: ['body'], unique: false},
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(2);

    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;
    expect(schemaContent).toContain(
      "import { pgTable, serial, integer, text, boolean, doublePrecision, index, uniqueIndex, timestamp, date, foreignKey, jsonb } from 'drizzle-orm/pg-core'",
    );
    expect(schemaContent).toContain("export const posts = pgTable('posts'");
    expect(schemaContent).toContain("id: serial('id').primaryKey()");
    expect(schemaContent).toContain("count: integer('count')");
    expect(schemaContent).toContain("title: text('title').unique().notNull()");
    expect(schemaContent).toContain('body: text(\'body\').default("content")');
    expect(schemaContent).toContain("published: boolean('published')");
    expect(schemaContent).toContain("updatedAt: timestamp('updatedAt')");
    expect(schemaContent).toContain("price: doublePrecision('price')");
    expect(schemaContent).toContain("birthDate: date('birthDate')");
    expect(schemaContent).toContain("config: jsonb('config')");
    expect(schemaContent).toContain("unknown: text('unknown')");
    expect(schemaContent).toContain("uniqueIndex('title_idx').on(t.title)");
    expect(schemaContent).toContain("index('body_idx').on(t.body)");

    const drizzleConfigContent = writeFileSyncMock.mock.calls[1][1] as string;
    expect(drizzleConfigContent).toContain("dialect: 'postgresql'");
    expect(drizzleConfigContent).toContain(
      'url: process.env.DRIZZLE_DATABASE_URL!',
    );

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('npm run generate:sql -- --config='),
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({DRIZZLE_DATABASE_URL: 'postgres://db'}),
      }),
    );
  });

  it('should generate empty schemas gracefully', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      empty: {
        fields: {},
      },
    };
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
      'Migration failed to run: ',
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

  it('should generate foreign keys for sqlite with onDelete and onUpdate', async () => {
    const config = getBaseConfig('sqlite');
    config.data.models = {
      users: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          user_id: {type: 'integer'},
        },
        relations: {
          fk_posts_user_id: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
            onDelete: 'cascade',
            onUpdate: 'cascade',
          },
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain(
      "foreignKey({ name: 'fk_posts_user_id', columns: [t.user_id], foreignColumns: [users.id] })",
    );
    expect(schemaContent).toContain(".onDelete('cascade')");
    expect(schemaContent).toContain(".onUpdate('cascade')");
  });

  it('should generate foreign keys for pg with onDelete and onUpdate', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      users: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          user_id: {type: 'integer'},
        },
        relations: {
          fk_posts_user_id: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
            onDelete: 'cascade',
            onUpdate: 'set null',
          },
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain(
      "foreignKey({ name: 'fk_posts_user_id', columns: [t.user_id], foreignColumns: [users.id] })",
    );
    expect(schemaContent).toContain(".onDelete('cascade')");
    expect(schemaContent).toContain(".onUpdate('set null')");
  });

  it('should generate foreign key with only onDelete action', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      categories: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      products: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          category_id: {type: 'integer'},
        },
        relations: {
          fk_products_category: {
            type: 'belongsTo',
            model: 'categories',
            localField: 'category_id',
            foreignField: 'id',
            onDelete: 'restrict',
          },
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain(".onDelete('restrict')");
    expect(schemaContent).not.toContain('.onUpdate');
  });

  it('should generate foreign key without onDelete or onUpdate actions', async () => {
    const config = getBaseConfig('sqlite');
    config.data.models = {
      authors: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      books: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          author_id: {type: 'integer'},
        },
        relations: {
          fk_books_author: {
            type: 'belongsTo',
            model: 'authors',
            localField: 'author_id',
            foreignField: 'id',
          },
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain(
      "foreignKey({ name: 'fk_books_author', columns: [t.author_id], foreignColumns: [authors.id] })",
    );
    expect(schemaContent).not.toContain('.onDelete');
    expect(schemaContent).not.toContain('.onUpdate');
  });

  it('should generate multiple foreign keys on a single table', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      users: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      categories: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          user_id: {type: 'integer'},
          category_id: {type: 'integer'},
        },
        relations: {
          fk_posts_user: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
            onDelete: 'cascade',
          },
          fk_posts_category: {
            type: 'belongsTo',
            model: 'categories',
            localField: 'category_id',
            foreignField: 'id',
            onDelete: 'set null',
          },
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain(
      "foreignKey({ name: 'fk_posts_user', columns: [t.user_id], foreignColumns: [users.id] })",
    );
    expect(schemaContent).toContain(
      "foreignKey({ name: 'fk_posts_category', columns: [t.category_id], foreignColumns: [categories.id] })",
    );
  });

  it('should generate foreign keys alongside indexes', async () => {
    const config = getBaseConfig('sqlite');
    config.data.models = {
      users: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      posts: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          title: {type: 'string'},
          user_id: {type: 'integer'},
        },
        indexes: {title_idx: {fields: ['title'], unique: false}},
        relations: {
          fk_posts_user: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
            onDelete: 'cascade',
          },
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    // Both index and foreign key should be present
    expect(schemaContent).toContain("index('title_idx').on(t.title)");
    expect(schemaContent).toContain(
      "foreignKey({ name: 'fk_posts_user', columns: [t.user_id], foreignColumns: [users.id] })",
    );
  });

  it('should generate foreign keys without indexes', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      users: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
      comments: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          user_id: {type: 'integer'},
        },
        relations: {
          fk_comments_user: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
            onDelete: 'no action',
            onUpdate: 'set default',
          },
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain(
      "foreignKey({ name: 'fk_comments_user', columns: [t.user_id], foreignColumns: [users.id] })",
    );
    expect(schemaContent).toContain(".onDelete('no action')");
    expect(schemaContent).toContain(".onUpdate('set default')");
  });

  it('should not write dbUrl with special chars to drizzle config (env var only)', async () => {
    const urlWithQuotes = "postgres://user:p'ass'word@localhost/db";
    const config = getBaseConfig('postgres');
    config.infrastructure.database.connection.url = urlWithQuotes;
    config.data.models = {
      test: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const drizzleConfigContent = writeFileSyncMock.mock.calls[1][1] as string;
    // URL must NOT appear in the config file
    expect(drizzleConfigContent).not.toContain(urlWithQuotes);
    // Config uses env var instead
    expect(drizzleConfigContent).toContain(
      'url: process.env.DRIZZLE_DATABASE_URL!',
    );
    // URL is passed securely via env
    expect(execSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        env: expect.objectContaining({DRIZZLE_DATABASE_URL: urlWithQuotes}),
      }),
    );
  });

  it('should not write dbUrl with double quotes to drizzle config (env var only)', async () => {
    const urlWithDoubleQuotes = 'sqlite://path/to/"my db".db';
    const config = getBaseConfig('sqlite');
    config.infrastructure.database.connection.url = urlWithDoubleQuotes;
    config.data.models = {
      test: {
        fields: {id: {type: 'integer', primaryKey: true}},
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const drizzleConfigContent = writeFileSyncMock.mock.calls[1][1] as string;
    // URL must NOT appear in the config file
    expect(drizzleConfigContent).not.toContain(urlWithDoubleQuotes);
    // Config uses env var instead
    expect(drizzleConfigContent).toContain(
      'url: process.env.DRIZZLE_DATABASE_URL!',
    );
    // URL is passed securely via env
    expect(execSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        env: expect.objectContaining({
          DRIZZLE_DATABASE_URL: urlWithDoubleQuotes,
        }),
      }),
    );
  });

  it('should generate schema without foreign keys when none are defined', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      simple: {
        fields: {
          id: {type: 'integer', primaryKey: true},
          name: {type: 'string'},
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).not.toContain('foreignKey(');
  });

  it('should generate schema with autoIncrement and timestamps for sqlite', async () => {
    const config = getBaseConfig('sqlite');
    config.data.models = {
      records: {
        timestamps: true,
        fields: {
          id: {type: 'integer', primaryKey: true, autoIncrement: true},
          label: {type: 'string', nullable: false},
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain('.primaryKey({ autoIncrement: true })');
    expect(schemaContent).toContain(".default(sql`(datetime('now'))`)");
  });

  it('should generate schema with autoIncrement and timestamps for postgres', async () => {
    const config = getBaseConfig('postgres');
    config.data.models = {
      records: {
        timestamps: true,
        fields: {
          id: {type: 'integer', primaryKey: true, autoIncrement: true},
          label: {type: 'string', nullable: false},
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    expect(schemaContent).toContain('.primaryKey()');
    expect(schemaContent).toContain('.default(sql`now()`)');
  });

  it('should not overwrite created_at when timestamps is true and field already exists', async () => {
    const config = getBaseConfig('sqlite');
    config.data.models = {
      records: {
        timestamps: true,
        fields: {
          id: {type: 'integer', primaryKey: true},
          created_at: {type: 'datetime'}, // already defined by user
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    // created_at from user definition is preserved (branch: already exists, skip)
    expect(schemaContent).toContain("created_at: integer('created_at'");
    // updated_at is injected by timestamps
    expect(schemaContent).toContain("updated_at: integer('updated_at'");
  });

  it('should not overwrite updated_at when timestamps is true and field already exists', async () => {
    const config = getBaseConfig('sqlite');
    config.data.models = {
      records: {
        timestamps: true,
        fields: {
          id: {type: 'integer', primaryKey: true},
          updated_at: {type: 'datetime'}, // already defined by user
        },
      },
    };

    await migrateDatabase(config);

    const writeFileSyncMock = vi.mocked(fs.writeFileSync);
    const schemaContent = writeFileSyncMock.mock.calls[0][1] as string;

    // created_at is injected by timestamps
    expect(schemaContent).toContain("created_at: integer('created_at'");
    // updated_at from user definition is preserved
    expect(schemaContent).toContain("updated_at: integer('updated_at'");
  });
});
