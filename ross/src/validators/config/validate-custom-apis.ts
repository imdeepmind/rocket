import {AppConfig} from '@/interfaces/config';

import {ajv} from './schema';

function validateCustomAPIs(config: AppConfig): string[] {
  const errors: string[] = [];

  const customEndpoints = config.customEndpoints ?? {};
  const names = Object.keys(customEndpoints);

  for (const name of names) {
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
    const ddlPrefixes = ['CREATE ', 'ALTER ', 'DROP ', 'TRUNCATE ', 'RENAME '];
    if (ddlPrefixes.some(prefix => q.startsWith(prefix))) {
      errors.push(`${path}/handler/sql: DDL queries are not allowed`);
      continue;
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

    // Structural check: unclosed [[ delimiters
    const sql = endpoint.handler.sql;
    let pos = 0;
    while (pos < sql.length) {
      const start = sql.indexOf('[[', pos);
      if (start === -1) break;

      const end = sql.indexOf(']]', start + 2);
      const nextStart = sql.indexOf('[[', start + 2);

      if (end === -1 || (nextStart !== -1 && nextStart < end)) {
        errors.push(
          `${path}/handler/sql: unclosed query placeholder delimiter "[["`,
        );
        break;
      }
      pos = end + 2;
    }

    // Check for multiple type declarations in query placeholders
    const multiTypeRegex =
      /\[\[([a-zA-Z0-9_.-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_:-]+)\]\]/g;
    let mtMatch: RegExpExecArray | null;
    while ((mtMatch = multiTypeRegex.exec(endpoint.handler.sql)) !== null) {
      errors.push(
        `${path}/handler/sql: invalid query placeholder format "${mtMatch[1]}", multiple types provided`,
      );
    }

    // Check for legacy placeholders
    const legacyRegex =
      /(@@|\$\$|&&|\^\^)([a-zA-Z0-9_ -]+):([a-zA-Z0-9_ -]+)\1/;
    if (legacyRegex.test(endpoint.handler.sql)) {
      errors.push(
        `${path}/handler/sql: legacy query placeholders (@@, $$, &&, ^^) are not allowed, use [[source.name:type]] instead`,
      );
    }

    // Per-variable validation
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

    const placeholderRegex = /\[\[([^\]]+)\]\]/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = placeholderRegex.exec(endpoint.handler.sql)) !== null) {
      const content = pMatch[1].trim();
      const colonParts = content.split(':');
      if (colonParts.length > 2) {
        continue;
      }
      const target = colonParts[0].trim();
      const varType = colonParts[1]?.trim();

      const dotIndex = target.indexOf('.');
      if (dotIndex !== -1) {
        const source = target.substring(0, dotIndex).trim();
        const varName = target.substring(dotIndex + 1).trim();

        const validSources = ['query', 'body', 'path', 'header'];
        if (!validSources.includes(source)) {
          errors.push(
            `${path}/handler/sql: invalid query placeholder source "${source}"`,
          );
          continue;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(varName)) {
          errors.push(
            `${path}/handler/sql: invalid query placeholder name "${varName}" for ${source} parameter`,
          );
        }

        if (!varType) {
          errors.push(
            `${path}/handler/sql: missing data type for query placeholder "${varName}" in ${source} parameter`,
          );
        } else if (!validTypes.includes(varType)) {
          errors.push(
            `${path}/handler/sql: invalid query placeholder type "${varType}" for ${source} parameter`,
          );
        }

        if (endpoint.method === 'GET' && source === 'body') {
          errors.push(
            `${path}/handler/sql: body query placeholders are not allowed for GET method`,
          );
        }
      } else {
        errors.push(
          `${path}/handler/sql: invalid query placeholder format "${content}", expected [[source.name:type]]`,
        );
      }
    }
  }

  return errors;
}

export default validateCustomAPIs;
