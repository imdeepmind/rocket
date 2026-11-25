export type PlaceholderSource = 'query' | 'body' | 'path' | 'header';
export type PlaceholderToken = {
    source: PlaceholderSource;
    name: string;
    type: string;
    raw: string;
};
export declare function parseQueryPlaceholders(sql: string): PlaceholderToken[];
