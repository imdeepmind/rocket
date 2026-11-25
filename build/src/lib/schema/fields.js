export const MANAGED_TIMESTAMP_FIELDS = ['created_at', 'updated_at'];
export function isManagedTimestampField(fieldName) {
    return MANAGED_TIMESTAMP_FIELDS.includes(fieldName);
}
export function filterManagedTimestampFields(fields) {
    return fields.filter(([name]) => !isManagedTimestampField(name));
}
//# sourceMappingURL=fields.js.map