export function getUpdatedAtExpression(engine) {
    if (engine === 'sqlite') {
        return "(datetime('now'))";
    }
    if (engine === 'mysql') {
        return 'CURRENT_TIMESTAMP';
    }
    return 'now()';
}
export function hasUpdatedAtField(model) {
    return 'updated_at' in model.fields;
}
export function buildUpdatedAtClause(model, engine) {
    if (!hasUpdatedAtField(model))
        return null;
    return `"updated_at" = ${getUpdatedAtExpression(engine)}`;
}
//# sourceMappingURL=timestamps.js.map