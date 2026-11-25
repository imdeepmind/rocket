import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../constants.js';
/**
 * Hashes plain text data using bcrypt.
 * @param data The plain text data to hash.
 * @param saltRounds The number of salt rounds to use (defaults to BCRYPT_SALT_ROUNDS from constants).
 * @returns A promise that resolves to the hashed string.
 */
export async function hash(data, saltRounds = BCRYPT_SALT_ROUNDS) {
    return bcrypt.hash(data, saltRounds);
}
/**
 * Compares plain text data with a bcrypt hash.
 * @param data The plain text data to check.
 * @param encrypted The encrypted hash to compare against.
 * @returns A promise that resolves to true if the data matches the hash, false otherwise.
 */
export async function compare(data, encrypted) {
    return bcrypt.compare(data, encrypted);
}
//# sourceMappingURL=hash.js.map