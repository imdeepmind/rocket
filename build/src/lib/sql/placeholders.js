export function parseQueryPlaceholders(sql) {
    const placeholders = [];
    const regex = /\[\[(query|body|path|header)\.([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\]\]/g;
    let match;
    while ((match = regex.exec(sql)) !== null) {
        placeholders.push({
            source: match[1],
            name: match[2],
            type: match[3],
            raw: match[0],
        });
    }
    return placeholders;
}
//# sourceMappingURL=placeholders.js.map