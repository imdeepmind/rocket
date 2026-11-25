async function selectUserByUsername(db, model, usernameField, username) {
    const query = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;
    const result = await db.query(query, [username]);
    return result.rows[0] ?? null;
}
async function selectUserByIdentity(db, lookup) {
    const query = `SELECT * FROM "${lookup.model}" WHERE "${lookup.providerField}" = $1 AND "${lookup.providerIdField}" = $2 LIMIT 1;`;
    const result = await db.query(query, [
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
export async function resolveUserByIdentity(db, lookup) {
    const existing = await selectUserByIdentity(db, lookup);
    if (existing) {
        return existing;
    }
    const columns = [];
    const values = [];
    const seen = new Set();
    const push = (column, value) => {
        if (seen.has(column) || value === undefined || value === null) {
            return;
        }
        seen.add(column);
        columns.push(column);
        values.push(value);
    };
    push(lookup.providerField, lookup.providerName);
    push(lookup.providerIdField, lookup.providerId);
    if (lookup.usernameField && lookup.username) {
        const existingByUsername = await selectUserByUsername(db, lookup.model, lookup.usernameField, lookup.username);
        if (existingByUsername) {
            const collisionError = new Error('An account with this email/username already exists');
            collisionError.code = 'ACCOUNT_COLLISION';
            throw collisionError;
        }
        push(lookup.usernameField, lookup.username);
    }
    for (const [claim, column] of Object.entries(lookup.attributeMapping ?? {})) {
        push(column, lookup.claims?.[claim]);
    }
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const columnList = columns.map(column => `"${column}"`).join(', ');
    const insert = `INSERT INTO "${lookup.model}" (${columnList}) VALUES (${placeholders});`;
    try {
        await db.query(insert, values);
    }
    catch (err) {
        // A concurrent first login may have won the unique constraint race.
        const raced = await selectUserByIdentity(db, lookup);
        if (raced) {
            return raced;
        }
        if (lookup.usernameField && lookup.username) {
            const existingByUsername = await selectUserByUsername(db, lookup.model, lookup.usernameField, lookup.username);
            if (existingByUsername) {
                const collisionError = new Error('An account with this email/username already exists');
                collisionError.code = 'ACCOUNT_COLLISION';
                throw collisionError;
            }
        }
        throw err;
    }
    const created = await selectUserByIdentity(db, lookup);
    if (!created) {
        throw new Error('Failed to persist the authenticated identity');
    }
    return created;
}
//# sourceMappingURL=user.js.map