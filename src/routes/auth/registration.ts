import bcrypt from 'bcrypt';
import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  generateJSONValidationSchema,
  getResponseStructureSchema,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {AppConfig, ModelBody} from '@/schema/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * The number of bcrypt salt rounds used when hashing passwords.
 * 10 is a widely accepted default that balances security and performance.
 */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Register the POST /auth/register route.
 *
 * This route is ONLY registered when:
 *   - auth.enableAuth === true
 *   - auth.authEngine === 'up-auth'
 *
 * It accepts the same fields as the auth model (minus the primary key)
 * and hashes the password column before inserting the record into
 * the authModel.modelName table.
 *
 * @param app     - The Fastify application instance.
 * @param models  - All model configs from the top-level config.
 * @param auth    - The auth block from the app config.
 */
export function registerRegistrationRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models, auth} = config;

  // Guard: only register when up-auth is enabled
  if (!auth || !auth.enableAuth || auth.authEngine !== 'up-auth') {
    return;
  }

  const {modelName, passwordColumn} = auth.authModel;

  // Find the model config that matches the authModel.modelName so we can
  // derive the request body schema from its fields (just like the POST route).
  const authModelConfig = models.find(m => m.name === modelName);

  if (!authModelConfig) {
    // If no matching model is configured, skip silently – config validation
    // should catch this earlier in the start-up flow.
    app.log.warn(
      `[auth/register] Could not find model config for "${modelName}". Skipping route registration.`,
    );
    return;
  }

  // Build a JSON schema for the request body, ignoring the primary key column
  // (the DB generates it) and disallowing additional properties.
  const bodySchema = generateJSONValidationSchema(authModelConfig, {
    ignorePrimaryKey: true,
    additionalProperties: false,
  });

  // Build a JSON schema for require body, ignoring the password field
  const authModelConfigWithoutPassowrd = {...authModelConfig};
  authModelConfigWithoutPassowrd['fields'] = authModelConfigWithoutPassowrd[
    'fields'
  ].filter(f => f.name !== passwordColumn);
  const requiredBodySchema = generateJSONValidationSchema(
    authModelConfigWithoutPassowrd,
    {
      ignorePrimaryKey: true,
      additionalProperties: false,
    },
  );

  // Build the response schema — we mirror the same 201 shape used by the
  // generic POST route so clients get a consistent envelope.
  const responseSchema = getResponseStructureSchema(
    [201],
    requiredBodySchema,
    requiredBodySchema,
  );

  // Swagger / JSON-Schema declaration for this route.
  const schema: Record<string, unknown> = {
    summary: `Register a new ${capitalizeFirstLetter(modelName)} user`,
    description: `Creates a new user record in the "${modelName}" table. The password is hashed with bcrypt before being persisted.`,
    tags: [capitalizeFirstLetter(modelName), 'Auth', 'Register'],
    body: bodySchema,
    response: responseSchema,
  };

  app.post(
    '/auth/register',
    {schema},
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const incomingBody = request.body;

      // Strip any fields not declared in the model config so nothing sneaks
      // past the schema validator (primary key excluded as well).
      const body = stripAdditionalPostFields(authModelConfig, incomingBody, {
        ignorePrimaryKey: true,
      });

      // Hash the password before storing it.
      // We only do this when the password column is actually present in the
      // incoming body; if it's missing AJV validation would have already
      // rejected the request.
      if (body[passwordColumn] !== undefined && body[passwordColumn] !== null) {
        const rawPassword = String(body[passwordColumn]);
        body[passwordColumn] = await bcrypt.hash(
          rawPassword,
          BCRYPT_SALT_ROUNDS,
        );
      }

      // Build the INSERT statement dynamically from the sanitised body keys.
      const keys = Object.keys(body);
      const values = Object.values(body);
      const columns = keys.map(key => `"${key}"`).join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO "${modelName}" (${columns}) VALUES (${placeholders});`;

      // Execute the query against the configured database.
      const res = await app.db.query(query, values);

      // Return the created record without leaking the hashed password.
      // We build a safe copy that omits the password column from the response data.
      const responseData: ModelBody = {};
      for (const [k, v] of Object.entries(body)) {
        if (k !== passwordColumn) {
          responseData[k] = v;
        }
      }

      return reply
        .status(201)
        .send(
          app.buildResponse(
            201,
            `Successfully registered a new user in the ${modelName} table`,
            responseData,
            res,
          ),
        );
    },
  );
}
