import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  generateJSONValidationSchema,
  getResponseStructureSchema,
  stripAdditionalPostFields,
} from '@/routes/schema-helpers';

import {AppConfig, ModelBody, ModelConfig} from '@/interfaces/config';

import {hash} from '@/utils/hash';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerRegistrationRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models, authentication} = config;

  if (!authentication?.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const {model, passwordField} = authentication.provider.config.userModel;

  const authModelConfig = models.find(m => m.name === model);

  if (!authModelConfig) {
    app.log.warn(
      `[auth/register] Could not find model config for "${model}". Skipping route registration.`,
    );
    return;
  }

  const schema: Record<string, unknown> = generateSchema(
    authModelConfig,
    passwordField,
    model,
  );

  app.post(
    '/auth/register',
    {
      schema,
      config: {apiIdentifier: `authAPIs->${model}->all->registration`},
    },
    async (request: FastifyRequest<{Body: ModelBody}>, reply: FastifyReply) => {
      const incomingBody = request.body;

      const body = stripAdditionalPostFields(authModelConfig, incomingBody, {
        ignorePrimaryKey: true,
      });

      if (body[passwordField] !== undefined && body[passwordField] !== null) {
        const rawPassword = String(body[passwordField]);
        body[passwordField] = await hash(rawPassword);
      }

      const keys = Object.keys(body);
      const values = Object.values(body);
      const columns = keys.map(key => `"${key}"`).join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO "${model}" (${columns}) VALUES (${placeholders});`;

      const res = await app.db.query(query, values);

      const responseData: ModelBody = {};
      for (const [k, v] of Object.entries(body)) {
        if (k !== passwordField) {
          responseData[k] = v;
        }
      }

      return reply
        .status(201)
        .send(
          app.buildResponse(
            201,
            `Successfully registered a new user in the ${model} table`,
            responseData,
            res,
          ),
        );
    },
  );
}

function generateSchema(
  authModelConfig: ModelConfig,
  passwordField: string,
  model: string,
) {
  const bodySchema = generateJSONValidationSchema(authModelConfig, {
    ignorePrimaryKey: true,
    additionalProperties: false,
  });

  const authModelConfigWithoutPassword = {...authModelConfig};
  authModelConfigWithoutPassword['fields'] = authModelConfigWithoutPassword[
    'fields'
  ].filter(f => f.name !== passwordField);
  const requiredBodySchema = generateJSONValidationSchema(
    authModelConfigWithoutPassword,
    {
      ignorePrimaryKey: true,
      additionalProperties: false,
    },
  );

  const responseSchema = getResponseStructureSchema(
    [201],
    requiredBodySchema,
    requiredBodySchema,
  );

  const schema: Record<string, unknown> = {
    summary: `Register a new ${capitalizeFirstLetter(model)} user`,
    description: `Creates a new user record in the "${model}" table. The password is hashed with bcrypt before being persisted.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'Register'],
    body: bodySchema,
    response: responseSchema,
  };
  return schema;
}
