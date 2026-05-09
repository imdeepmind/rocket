import bcrypt from 'bcrypt';
import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getResponseStructureSchema} from '@/routes/schema-helpers';

import {AppConfig, ModelBody} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

/**
 * Register the POST /auth/login route.
 *
 * This route is ONLY registered when:
 *   - auth.enableAuth === true
 *   - auth.authEngine === 'up-auth'
 *
 * @param app     - The Fastify application instance.
 * @param models  - All model configs from the top-level config.
 * @param auth    - The auth block from the app config.
 */
export function registerLoginRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models, auth} = config;

  // Guard: only register when up-auth is enabled
  if (!auth || !auth.enableAuth || auth.authEngine !== 'up-auth') {
    return;
  }

  const {modelName, usernameColumn, passwordColumn} = auth.authModel;

  // Find the model config that matches the authModel.modelName
  const authModelConfig = models.find(m => m.name === modelName);

  if (!authModelConfig) {
    app.log.warn(
      `[auth/login] Could not find model config for "${modelName}". Skipping route registration.`,
    );
    return;
  }

  // Request body schema for login
  const schema: Record<string, unknown> = generateSchema(
    usernameColumn,
    passwordColumn,
    modelName,
  );

  app.post(
    '/auth/login',
    {
      schema,
      config: {apiIdentifier: `authAPIs->${modelName}->all->login`},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const {[usernameColumn]: username, [passwordColumn]: password} =
        request.body;

      // Find user by username
      const query = `SELECT * FROM "${modelName}" WHERE "${usernameColumn}" = $1 LIMIT 1;`;
      const res = await app.db.query(query, [username]);

      if (res.rows.length === 0) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid username or password', null));
      }

      const user = res.rows[0] as Record<string, unknown>;
      const hashedPassword = user[passwordColumn] as string;

      // Compare passwords
      const isMatch = await bcrypt.compare(String(password), hashedPassword);

      if (!isMatch) {
        return reply
          .status(401)
          .send(app.buildResponse(401, 'Invalid username or password', null));
      }

      // We include the user ID and username in the payload
      const payload = {
        id: user[auth.authModel.idColumn],
        [usernameColumn]: user[usernameColumn],
      };

      const token = app.jwt.sign(payload, {
        expiresIn: '1d',
      });

      return reply.status(200).send(
        app.buildResponse(200, 'Login successful', {
          accessToken: token,
        }),
      );
    },
  );
}

function generateSchema(
  usernameColumn: string,
  passwordColumn: string,
  modelName: string,
) {
  const bodySchema = {
    type: 'object',
    required: [usernameColumn, passwordColumn],
    properties: {
      [usernameColumn]: {type: 'string', description: 'The user identifier'},
      [passwordColumn]: {type: 'string', description: 'The user password'},
    },
    additionalProperties: false,
  };

  // Response schema for successful login
  const dataSchema = {
    type: 'object',
    properties: {
      accessToken: {type: 'string', description: 'JWT access token'},
    },
  };

  const responseSchema = getResponseStructureSchema([200], dataSchema);

  // Swagger declaration for this route
  const schema: Record<string, unknown> = {
    summary: `Login for ${capitalizeFirstLetter(modelName)}`,
    description: `Authenticates a user from the "${modelName}" table and returns a JWT access token.`,
    tags: [capitalizeFirstLetter(modelName), 'Auth', 'Login'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
