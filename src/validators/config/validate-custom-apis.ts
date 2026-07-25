import {AppConfig} from '@/interfaces/config';

function validateCustomAPIs(config: AppConfig): string[] {
  const errors: string[] = [];

  const customEndpoints = config.customEndpoints ?? {};

  const names = Object.keys(customEndpoints);

  if (names.length > 0) {
    names.forEach(name => {
      const endpoint = customEndpoints[name];
      const path = `/customEndpoints/${name}`;

      const q = endpoint.handler.sql.trim().toUpperCase();

      // DDL commands usually start with CREATE, ALTER, DROP, TRUNCATE, RENAME
      const ddlPrefixes = [
        'CREATE ',
        'ALTER ',
        'DROP ',
        'TRUNCATE ',
        'RENAME ',
      ];
      if (ddlPrefixes.some(prefix => q.startsWith(prefix))) {
        errors.push(`${path}/handler/sql: DDL queries are not allowed`);
        return;
      }

      const isDql = q.startsWith('SELECT ') || q.startsWith('WITH ');
      const dmlPrefixes = ['INSERT ', 'UPDATE ', 'DELETE '];
      const isDml = dmlPrefixes.some(prefix => q.startsWith(prefix));

      if (endpoint.method === 'GET') {
        if (!isDql) {
          errors.push(
            `${path}/handler/sql: only DQL queries are allowed for GET method`,
          );
        }
      } else {
        if (!isDql && !isDml) {
          errors.push(
            `${path}/handler/sql: only DQL and DML queries are allowed`,
          );
        }
      }

      // Magic variables validation
      const delims = ['@@', '$$', '&&'];
      const foundDelims: {pos: number; type: string}[] = [];

      delims.forEach(d => {
        let pos = endpoint.handler.sql.indexOf(d);
        while (pos !== -1) {
          foundDelims.push({pos, type: d});
          pos = endpoint.handler.sql.indexOf(d, pos + 2);
        }
      });

      foundDelims.sort((a, b) => a.pos - b.pos);

      for (let i = 0; i < foundDelims.length; i += 2) {
        const start = foundDelims[i];
        const end = foundDelims[i + 1];

        if (!end) {
          errors.push(
            `${path}/handler/sql: unclosed magic variable delimiter "${start.type}"`,
          );
          break;
        }

        if (start.type !== end.type) {
          errors.push(
            `${path}/handler/sql: mixed magic variable delimiters "${start.type}" and "${end.type}"`,
          );
          continue;
        }

        const varString = endpoint.handler.sql.substring(
          start.pos + 2,
          end.pos,
        );
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
            `${path}/handler/sql: invalid magic variable name "${varName}" for ${typeName} parameter`,
          );
        }

        // 2. Validate datatype
        if (parts.length > 2) {
          errors.push(
            `${path}/handler/sql: invalid magic variable format "${varString}", multiple types provided`,
          );
        } else if (!varType) {
          errors.push(
            `${path}/handler/sql: missing data type for magic variable "${varName}" in ${typeName} parameter`,
          );
        } else if (
          !['integer', 'string', 'boolean', 'text', 'datetime'].includes(
            varType,
          )
        ) {
          errors.push(
            `${path}/handler/sql: invalid magic variable type "${varType}" for ${typeName} parameter`,
          );
        }

        // 3. GET method should not have body magic variables (@@)
        if (endpoint.method === 'GET' && start.type === '@@') {
          errors.push(
            `${path}/handler/sql: body magic variables (@@) are not allowed for GET method`,
          );
        }
      }
    });
  }

  return errors;
}

export default validateCustomAPIs;
