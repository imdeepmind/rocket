import {describe, expect, test, vi} from 'vitest';

import {resolveUserByIdentity} from '@/lib/auth/user';

type Step = {rows: unknown[]} | Error;

const buildApp = (steps: Step[]) => {
  const query = vi.fn();

  for (const step of steps) {
    if (step instanceof Error) {
      query.mockRejectedValueOnce(step);
    } else {
      query.mockResolvedValueOnce({changes: 0, rows: step.rows});
    }
  }

  return {app: {db: {query}}, query};
};

const lookup = {
  model: 'users',
  providerField: 'provider',
  providerName: 'google',
  providerIdField: 'provider_id',
  providerId: 'sub-123',
};

describe('resolveUserByIdentity', () => {
  test('returns an existing user without inserting', async () => {
    const {app, query} = buildApp([{rows: [{id: 1, provider: 'google'}]}]);

    const user = await resolveUserByIdentity(app as never, lookup);

    expect(user).toEqual({id: 1, provider: 'google'});
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'SELECT * FROM "users" WHERE "provider" = $1 AND "provider_id" = $2 LIMIT 1;',
      ['google', 'sub-123'],
    );
  });

  test('creates the user on first login', async () => {
    const {app, query} = buildApp([
      {rows: []},
      {rows: []},
      {rows: [{id: 9, provider: 'google', provider_id: 'sub-123'}]},
    ]);

    const user = await resolveUserByIdentity(app as never, lookup);

    expect(user).toEqual({id: 9, provider: 'google', provider_id: 'sub-123'});
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1][0]).toBe(
      'INSERT INTO "users" ("provider", "provider_id") VALUES ($1, $2);',
    );
    expect(query.mock.calls[1][1]).toEqual(['google', 'sub-123']);
  });

  test('persists mapped claims only when present', async () => {
    const {app, query} = buildApp([{rows: []}, {rows: []}, {rows: [{id: 9}]}]);

    await resolveUserByIdentity(app as never, {
      ...lookup,
      attributeMapping: {name: 'display_name', email: 'email'},
      claims: {name: 'Alice', email: null},
    });

    expect(query.mock.calls[1][0]).toBe(
      'INSERT INTO "users" ("provider", "provider_id", "display_name") VALUES ($1, $2, $3);',
    );
    expect(query.mock.calls[1][1]).toEqual(['google', 'sub-123', 'Alice']);
  });

  test('does not let a mapping overwrite the identity columns', async () => {
    const {app, query} = buildApp([{rows: []}, {rows: []}, {rows: [{id: 9}]}]);

    await resolveUserByIdentity(app as never, {
      ...lookup,
      attributeMapping: {provider: 'provider_id'},
      claims: {provider: 'spoofed'},
    });

    expect(query.mock.calls[1][0]).toBe(
      'INSERT INTO "users" ("provider", "provider_id") VALUES ($1, $2);',
    );
  });

  test('recovers when a concurrent login wins the race', async () => {
    const {app} = buildApp([
      {rows: []},
      new Error('duplicate key'),
      {rows: [{id: 5, provider: 'google'}]},
    ]);

    const user = await resolveUserByIdentity(app as never, lookup);

    expect(user).toEqual({id: 5, provider: 'google'});
  });

  test('rethrows the insert error when nothing was created', async () => {
    const failure = new Error('insert failed');
    const {app} = buildApp([{rows: []}, failure, {rows: []}]);

    await expect(resolveUserByIdentity(app as never, lookup)).rejects.toThrow(
      'insert failed',
    );
  });

  test('throws when the row cannot be read back', async () => {
    const {app} = buildApp([{rows: []}, {rows: []}, {rows: []}]);

    await expect(resolveUserByIdentity(app as never, lookup)).rejects.toThrow(
      'Failed to persist the authenticated identity',
    );
  });
});
