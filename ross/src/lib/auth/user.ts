import {FastifyInstance} from 'fastify';

export interface IdentityLookup {
  model: string;
  providerField: string;
  providerName: string;
  providerIdField: string;
  providerId: string;
  attributeMapping?: Record<string, string>;
  claims?: Record<string, unknown>;
}

async function selectUserByIdentity(
  app: FastifyInstance,
  lookup: IdentityLookup,
): Promise<Record<string, unknown> | null> {
  const query = `SELECT * FROM "${lookup.model}" WHERE "${lookup.providerField}" = $1 AND "${lookup.providerIdField}" = $2 LIMIT 1;`;
  const result = await app.db.query<Record<string, unknown>>(query, [
    lookup.providerName,
    lookup.providerId,
  ]);

  return result.rows[0] ?? null;
}

/**
 * Find-or-create the local account for an external identity.
 *
 * SSO accounts are keyed strictly by `(providerField, providerIdField)`; no
 * email or username is required or inferred. Optional `attributeMapping`
 * claims are persisted only when the developer asked for them.
 */
export async function resolveUserByIdentity(
  app: FastifyInstance,
  lookup: IdentityLookup,
): Promise<Record<string, unknown>> {
  const existing = await selectUserByIdentity(app, lookup);

  if (existing) {
    return existing;
  }

  const columns: string[] = [];
  const values: unknown[] = [];
  const seen = new Set<string>();

  const push = (column: string, value: unknown): void => {
    if (seen.has(column) || value === undefined || value === null) {
      return;
    }

    seen.add(column);
    columns.push(column);
    values.push(value);
  };

  push(lookup.providerField, lookup.providerName);
  push(lookup.providerIdField, lookup.providerId);

  for (const [claim, column] of Object.entries(lookup.attributeMapping ?? {})) {
    push(column, lookup.claims?.[claim]);
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const columnList = columns.map(column => `"${column}"`).join(', ');
  const insert = `INSERT INTO "${lookup.model}" (${columnList}) VALUES (${placeholders});`;

  try {
    await app.db.query(insert, values);
  } catch (err) {
    // A concurrent first login may have won the unique constraint race.
    const raced = await selectUserByIdentity(app, lookup);

    if (raced) {
      return raced;
    }

    throw err;
  }

  const created = await selectUserByIdentity(app, lookup);

  if (!created) {
    throw new Error('Failed to persist the authenticated identity');
  }

  return created;
}
