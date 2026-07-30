export type PlaceholderDelimiter = '@@' | '$$' | '&&' | '^^';

export type PlaceholderToken = {
  delimiter: PlaceholderDelimiter;
  name: string;
  type: string;
};

export function parseQueryPlaceholders(sql: string): PlaceholderToken[] {
  const delims = ['@@', '$$', '&&', '^^'];
  const positions: {pos: number; type: string}[] = [];

  delims.forEach(d => {
    let pos = sql.indexOf(d);
    while (pos !== -1) {
      positions.push({pos, type: d});
      pos = sql.indexOf(d, pos + 2);
    }
  });

  positions.sort((a, b) => a.pos - b.pos);

  const result: PlaceholderToken[] = [];
  for (let i = 0; i < positions.length; i += 2) {
    const start = positions[i];
    const end = positions[i + 1];

    if (!end || start.type !== end.type) continue;

    const varString = sql.substring(start.pos + 2, end.pos);
    const parts = varString.split(':');
    result.push({
      delimiter: start.type as PlaceholderDelimiter,
      name: parts[0],
      type: parts[1] ?? '',
    });
  }
  return result;
}
