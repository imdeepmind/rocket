/**
 * Derive the Swagger tags for an API identifier.
 *
 * Format: `<module>.<variant>.<model>.<field>.<operation>`
 *
 *   - model:     `[Model, Read|Insert|Update|Delete]`
 *   - aggregate: `[Model, Read]`
 *   - auth:      `[Model, Auth, Login|Register|Password|Profile|OTP]`
 *   - custom:    `['Custom Endpoints']`
 */
export declare function deriveApiTags(identifier: string): string[];
