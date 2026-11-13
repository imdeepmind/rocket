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

    // Extract path parameters from endpoint.path (e.g., :id)
    const pathParams: string[] = [];
    const pathParamRegex = /:([a-zA-Z0-9_-]+)/g;
    let ppMatch: RegExpExecArray | null;
    while ((ppMatch = pathParamRegex.exec(endpoint.path)) !== null) {
      pathParams.push(ppMatch[1]);
    }

    if (endpoint.handler.type === 'sql') {
      const sqlHandler = endpoint.handler;
      const q = sqlHandler.sql.trim().toUpperCase();

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
      const sql = sqlHandler.sql;
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
      while ((mtMatch = multiTypeRegex.exec(sqlHandler.sql)) !== null) {
        errors.push(
          `${path}/handler/sql: invalid query placeholder format "${mtMatch[1]}", multiple types provided`,
        );
      }

      // Check for legacy placeholders
      const legacyRegex =
        /(@@|\$\$|&&|\^\^)([a-zA-Z0-9_ -]+):([a-zA-Z0-9_ -]+)\1/;
      if (legacyRegex.test(sqlHandler.sql)) {
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

      const sqlPathPlaceholders: string[] = [];
      const placeholderRegex = /\[\[([^\]]+)\]\]/g;
      let pMatch: RegExpExecArray | null;
      while ((pMatch = placeholderRegex.exec(sqlHandler.sql)) !== null) {
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

          if (source === 'path') {
            sqlPathPlaceholders.push(varName);
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

      // Bidirectional check between SQL path placeholders and endpoint.path parameters
      for (const sqlParam of sqlPathPlaceholders) {
        if (!pathParams.includes(sqlParam)) {
          errors.push(
            `${path}/handler/sql: path placeholder "${sqlParam}" does not exist in path "${endpoint.path}"`,
          );
        }
      }

      for (const pathParam of pathParams) {
        if (!sqlPathPlaceholders.includes(pathParam)) {
          errors.push(
            `${path}/handler/sql: path parameter "${pathParam}" from path "${endpoint.path}" is missing placeholder in SQL query`,
          );
        }
      }
    } else if (endpoint.handler.type === 'function') {
      const fnHandler = endpoint.handler;
      const inputs = fnHandler.inputs;
      const inputsPath = inputs?.path ?? [];
      const inputsQuery = inputs?.query ?? [];
      const inputsBody = inputs?.body ?? [];

      const hasInputs =
        inputsPath.length > 0 ||
        inputsQuery.length > 0 ||
        inputsBody.length > 0;

      const validationProps =
        (endpoint.validation?.properties as
          | Record<string, unknown>
          | undefined) ?? {};

      if (
        hasInputs &&
        (!endpoint.validation || !endpoint.validation.properties)
      ) {
        errors.push(
          `${path}/handler/inputs: validation schema properties must be defined when inputs are specified`,
        );
      }

      for (const param of inputsPath) {
        if (!(param in validationProps)) {
          errors.push(
            `${path}/handler/inputs/path: parameter "${param}" not declared in validation schema properties`,
          );
        }
      }

      for (const param of inputsQuery) {
        if (!(param in validationProps)) {
          errors.push(
            `${path}/handler/inputs/query: parameter "${param}" not declared in validation schema properties`,
          );
        }
      }

      for (const param of inputsBody) {
        if (!(param in validationProps)) {
          errors.push(
            `${path}/handler/inputs/body: parameter "${param}" not declared in validation schema properties`,
          );
        }
      }

      if (
        (endpoint.method === 'GET' || endpoint.method === 'DELETE') &&
        inputsBody.length > 0
      ) {
        errors.push(
          `${path}/handler/inputs: body inputs are not allowed for ${endpoint.method} method`,
        );
      }

      // Bidirectional check between inputs.path and endpoint.path parameters
      for (const param of pathParams) {
        if (!inputsPath.includes(param)) {
          errors.push(
            `${path}/handler/inputs/path: path parameter "${param}" must be declared in handler.inputs.path`,
          );
        }
      }

      for (const param of inputsPath) {
        if (!pathParams.includes(param)) {
          errors.push(
            `${path}/handler/inputs/path: parameter "${param}" does not exist in path "${endpoint.path}"`,
          );
        }
      }

      // Check for parameter duplication across sources
      const seenParams = new Set<string>();
      for (const source of ['path', 'query', 'body'] as const) {
        const list = inputs?.[source] ?? [];
        for (const param of list) {
          if (seenParams.has(param)) {
            errors.push(
              `${path}/handler/inputs: parameter "${param}" cannot be declared in multiple input sources`,
            );
          } else {
            seenParams.add(param);
          }
        }
      }
    }
  }

  return errors;
}

export default validateCustomAPIs;
