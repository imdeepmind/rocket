/**
 * Hashes plain text data using bcrypt.
 * @param data The plain text data to hash.
 * @param saltRounds The number of salt rounds to use (defaults to BCRYPT_SALT_ROUNDS from constants).
 * @returns A promise that resolves to the hashed string.
 */
export declare function hash(data: string, saltRounds?: number): Promise<string>;
/**
 * Compares plain text data with a bcrypt hash.
 * @param data The plain text data to check.
 * @param encrypted The encrypted hash to compare against.
 * @returns A promise that resolves to true if the data matches the hash, false otherwise.
 */
export declare function compare(data: string, encrypted: string): Promise<boolean>;
