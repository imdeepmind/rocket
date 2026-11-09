export type PlaceholderSource = 'query' | 'body' | 'path' | 'header';

export type PlaceholderToken = {
  source: PlaceholderSource;
  name: string;
  type: string;
  raw: string;
};

export function parseQueryPlaceholders(sql: string): PlaceholderToken[] {
  const placeholders: PlaceholderToken[] = [];
  const regex =
    /\[\[(query|body|path|header)\.([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    placeholders.push({
      source: match[1] as PlaceholderSource,
      name: match[2],
      type: match[3],
      raw: match[0],
    });
  }

  return placeholders;
}
