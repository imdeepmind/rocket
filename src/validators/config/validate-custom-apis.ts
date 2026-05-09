import {AppConfig} from '@/interfaces/config';

function validateCustomAPIs(config: AppConfig): string[] {
  const errors: string[] = [];

  const customQueries = config.customAPIs?.customQueries ?? [];

  const existingNames = new Set<string>();

  if (customQueries.length > 0) {
    customQueries.forEach((cq, i) => {
      const path = `/customAPIs/customQueries/${i}`;

      const q = cq.query.trim().toUpperCase();

      // validate the name to make sure it is unique and follow naming convention
      if (!cq.name || existingNames.has(cq.name)) {
        errors.push(`${path}/name: name must be unique and non-empty`);
      }
      existingNames.add(cq.name);

      // DDL commands usually start with CREATE, ALTER, DROP, TRUNCATE, RENAME
      const ddlPrefixes = [
        'CREATE ',
        'ALTER ',
        'DROP ',
        'TRUNCATE ',
        'RENAME ',
      ];
      if (ddlPrefixes.some(prefix => q.startsWith(prefix))) {
        errors.push(`${path}/query: DDL queries are not allowed`);
        return;
      }

      const isDql = q.startsWith('SELECT ') || q.startsWith('WITH ');
      const dmlPrefixes = ['INSERT ', 'UPDATE ', 'DELETE '];
      const isDml = dmlPrefixes.some(prefix => q.startsWith(prefix));

      if (cq.method === 'GET') {
        if (!isDql) {
          errors.push(
            `${path}/query: only DQL queries are allowed for GET method`,
          );
        }
      } else {
        if (!isDql && !isDml) {
          errors.push(`${path}/query: only DQL and DML queries are allowed`);
        }
      }

      // Magic variables validation
      const delims = ['@@', '$$', '&&'];
      const foundDelims: {pos: number; type: string}[] = [];

      delims.forEach(d => {
        let pos = cq.query.indexOf(d);
        while (pos !== -1) {
          foundDelims.push({pos, type: d});
          pos = cq.query.indexOf(d, pos + 2);
        }
      });

      foundDelims.sort((a, b) => a.pos - b.pos);

      for (let i = 0; i < foundDelims.length; i += 2) {
        const start = foundDelims[i];
        const end = foundDelims[i + 1];

        if (!end) {
          errors.push(
            `${path}/query: unclosed magic variable delimiter "${start.type}"`,
          );
          break;
        }

        if (start.type !== end.type) {
          errors.push(
            `${path}/query: mixed magic variable delimiters "${start.type}" and "${end.type}"`,
          );
          continue;
        }

        const varString = cq.query.substring(start.pos + 2, end.pos);
        const parts = varString.split(':');
        const varName = parts[0];
        const varType = parts[1];
        const typeName =
          start.type === '@@'
            ? 'body (@@)'
            : start.type === '$$'
              ? 'path ($$)'
              : 'query (&&)';

        // 1. Validation for variable name patterns (alphanumeric, underscores, hyphens)
        if (!/^[a-zA-Z0-9_-]+$/.test(varName)) {
          errors.push(
            `${path}/query: invalid magic variable name "${varName}" for ${typeName} parameter`,
          );
        }

        // 2. Validate datatype
        if (parts.length > 2) {
          errors.push(
            `${path}/query: invalid magic variable format "${varString}", multiple types provided`,
          );
        } else if (!varType) {
          errors.push(
            `${path}/query: missing data type for magic variable "${varName}" in ${typeName} parameter`,
          );
        } else if (
          !['integer', 'string', 'boolean', 'text', 'datetime'].includes(
            varType,
          )
        ) {
          errors.push(
            `${path}/query: invalid magic variable type "${varType}" for ${typeName} parameter`,
          );
        }

        // 3. GET method should not have body magic variables (@@)
        if (cq.method === 'GET' && start.type === '@@') {
          errors.push(
            `${path}/query: body magic variables (@@) are not allowed for GET method`,
          );
        }
      }
    });
  }

  return errors;
}

export default validateCustomAPIs;
