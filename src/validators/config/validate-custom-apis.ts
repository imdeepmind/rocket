import {parseQueryPlaceholders} from '@/lib/sql/placeholders';

import {AppConfig} from '@/interfaces/config';

import {ajv} from './schema';

function validateCustomAPIs(config: AppConfig): string[] {
  const errors: string[] = [];

  const customEndpoints = config.customEndpoints ?? {};

  const names = Object.keys(customEndpoints);

  if (names.length > 0) {
    names.forEach(name => {
      const endpoint = customEndpoints[name];
      const path = `/customEndpoints/${name}`;

      if (endpoint.validation) {
        const isValidSchema = ajv.validateSchema(endpoint.validation);
        if (!isValidSchema) {
          const schemaErrors = ajv.errors
            ? ajv.errors.map(e =>
                `${path}/validation: ${e.instancePath} ${e.message}`.trim(),
              )
            : [`${path}/validation: invalid JSON schema`];
          errors.push(...schemaErrors);
        }
      }

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

      // Query placeholders validation
      // Structural check: unclosed or mismatched delimiters
      const delimRegex = /(@@|\$\$|&&|\^\^)/g;
      const delims: {pos: number; type: string}[] = [];
      let match: RegExpExecArray | null;
      while ((match = delimRegex.exec(endpoint.handler.sql)) !== null) {
        delims.push({pos: match.index, type: match[1]});
      }

      for (let i = 0; i < delims.length; i += 2) {
        const start = delims[i];
        const end = delims[i + 1];

        if (!end) {
          errors.push(
            `${path}/handler/sql: unclosed query placeholder delimiter "${start.type}"`,
          );
          break;
        }

        if (start.type !== end.type) {
          errors.push(
            `${path}/handler/sql: mixed query placeholder delimiters "${start.type}" and "${end.type}"`,
          );
        }
      }

      // Check for multiple type declarations in query placeholders
      const multiTypeRegex =
        /(@@|\$\$|&&|\^\^)([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\1/g;
      let mtMatch: RegExpExecArray | null;
      while ((mtMatch = multiTypeRegex.exec(endpoint.handler.sql)) !== null) {
        const varString = mtMatch[0].slice(
          mtMatch[1].length,
          -mtMatch[1].length,
        );
        errors.push(
          `${path}/handler/sql: invalid query placeholder format "${varString}", multiple types provided`,
        );
      }

      // Per-variable validation
      const placeholders = parseQueryPlaceholders(endpoint.handler.sql);
      const validTypes = [
        'integer',
        'string',
        'boolean',
        'text',
        'datetime',
        'decimal',
        'date',
        'json',
        'enum',
        'uuid',
        'ulid',
      ];
      for (const {delimiter, name: varName, type: varType} of placeholders) {
        const typeName =
          delimiter === '@@'
            ? 'body (@@)'
            : delimiter === '$$'
              ? 'path ($$)'
              : delimiter === '&&'
                ? 'query (&&)'
                : 'header (^^)';

        if (!/^[a-zA-Z0-9_-]+$/.test(varName)) {
          errors.push(
            `${path}/handler/sql: invalid query placeholder name "${varName}" for ${typeName} parameter`,
          );
        }

        if (!varType) {
          errors.push(
            `${path}/handler/sql: missing data type for query placeholder "${varName}" in ${typeName} parameter`,
          );
        } else if (!validTypes.includes(varType)) {
          errors.push(
            `${path}/handler/sql: invalid query placeholder type "${varType}" for ${typeName} parameter`,
          );
        }

        if (endpoint.method === 'GET' && delimiter === '@@') {
          errors.push(
            `${path}/handler/sql: body query placeholders (@@) are not allowed for GET method`,
          );
        }
      }
    });
  }

  return errors;
}

export default validateCustomAPIs;
