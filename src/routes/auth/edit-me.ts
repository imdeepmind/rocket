import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {
  AppConfig,
  ModelBody,
  ModelConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerEditMeRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  const authConfig = (
    config.authentication!.provider.config as UpAuthProviderConfig
  ).userModel;
  const {model, idField, usernameField, passwordField, isVerifiedField} =
    authConfig;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const defaultApiIdentifier = `auth${getVariantSegment(config)}.${model}.unknown.editMe`;

  if (config.apis?.[defaultApiIdentifier]?.enabled === false) return;

  registerEditMeEndpoint(
    app,
    config,
    model,
    authModelConfig,
    idField,
    usernameField,
    passwordField,
    isVerifiedField,
    defaultVariant,
    defaultApiIdentifier,
  );

  const baseIdentifier = buildApiIdentifier(
    'auth',
    defaultVariant,
    model,
    'unknown',
    'editMe',
  );
  const additionalVariants = getAdditionalVariants(config, baseIdentifier);

  for (const variant of additionalVariants) {
    const variantApiIdentifier = buildApiIdentifier(
      'auth',
      variant,
      model,
      'unknown',
      'editMe',
    );

    if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

    registerEditMeEndpoint(
      app,
      config,
      model,
      authModelConfig,
      idField,
      usernameField,
      passwordField,
      isVerifiedField,
      variant,
      variantApiIdentifier,
    );
  }
}

function registerEditMeEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  model: string,
  authModelConfig: ModelConfig,
  idField: string,
  usernameField: string,
  passwordField: string,
  isVerifiedField: string | undefined,
  variant: string,
  apiIdentifier: string,
): void {
  const schema: Record<string, unknown> = generateSchema(
    authModelConfig,
    model,
    idField,
    usernameField,
    passwordField,
    isVerifiedField,
  );

  const path = `/${variant}/auth/user/me`;

  app.patch(
    path,
    {
      schema,
      config: {apiIdentifier},
      preValidation: buildPreValidation(app, config, true, ['auth']),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userPayload = request.user as Record<string, unknown>;
      const userId = userPayload.id;

      if (!userId) {
        return reply
          .status(401)
          .send(
            app.buildResponse(401, 'User ID missing in token payload', null),
          );
      }

      const body = request.body as ModelBody;

      const protectedFields = new Set(
        [idField, usernameField, passwordField, isVerifiedField].filter(
          Boolean,
        ),
      );
      const editableKeys = Object.keys(body).filter(
        k => !protectedFields.has(k),
      );

      if (editableKeys.length === 0) {
        return reply
          .status(400)
          .send(app.buildResponse(400, 'No editable fields provided', null));
      }

      const selectQuery = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;

      let tx;
      try {
        tx = await app.db.beginTransaction();

        const res = await tx.query(selectQuery, [userId]);

        if (res.rows.length === 0) {
          throw Object.assign(new Error('User not found'), {
            statusCode: 404,
            body: app.buildResponse(404, 'User not found', null),
          });
        }

        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        for (const key of editableKeys) {
          setClauses.push(`"${key}" = $${paramIndex++}`);
          values.push(body[key]);
        }

        values.push(userId);
        const updateQuery = `UPDATE "${model}" SET ${setClauses.join(', ')} WHERE "${idField}" = $${paramIndex};`;
        await tx.query(updateQuery, values);

        await tx.commit();

        const updatedFields: ModelBody = {};
        for (const key of editableKeys) {
          updatedFields[key] = body[key];
        }

        return reply
          .status(200)
          .send(
            app.buildResponse(
              200,
              'User profile updated successfully',
              updatedFields,
            ),
          );
      } catch (err) {
        if (tx) await tx.rollback().catch(() => {});
        throw err;
      } finally {
        tx?.release();
      }
    },
  );
}

function generateSchema(
  authModelConfig: ModelConfig,
  model: string,
  idField: string,
  usernameField: string,
  passwordField: string,
  isVerifiedField?: string,
) {
  const protectedFields = new Set(
    [idField, usernameField, passwordField, isVerifiedField].filter(Boolean),
  );

  const bodyProperties: Record<string, object> = {};
  for (const [fieldName, field] of Object.entries(authModelConfig.fields)) {
    if (!protectedFields.has(fieldName)) {
      bodyProperties[fieldName] = {
        ...mapDataTypeToJsonSchema(field.type),
        description: `New value for ${fieldName}`,
      };
    }
  }

  const bodySchema = {
    type: 'object',
    properties: bodyProperties,
    additionalProperties: false,
  };

  const responseSchema = getResponseStructureSchema([200], {
    type: 'object',
    properties: bodyProperties,
  });

  const schema: Record<string, unknown> = {
    summary: `Edit authenticated user profile for ${capitalizeFirstLetter(model)}`,
    description: `Updates the profile of the currently authenticated user in the "${model}" table. Cannot update ${idField}, ${usernameField}, ${passwordField}, or ${isVerifiedField}.`,
    tags: [capitalizeFirstLetter(model), 'Auth', 'Profile'],
    body: bodySchema,
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
