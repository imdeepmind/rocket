import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {getApiRouteTargets, ResolvedApiPolicy} from '@/lib/config/api';
import {isManagedTimestampField} from '@/lib/schema/fields';
import {getResponseStructureSchema} from '@/lib/schema/response';
import {mapDataTypeToJsonSchema} from '@/lib/schema/types';
import {buildPreValidation} from '@/lib/server/prevalidation';
import {buildUpdatedAtClause} from '@/lib/sql/timestamps';

import {
  ModelBody,
  ModelConfig,
  ResolvedAppConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

import {capitalizeFirstLetter} from '@/utils/string';

export function registerEditMeRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  const {models} = config.data;

  const {authentication} = config;
  if (!authentication.enabled || authentication.provider.type !== 'up-auth') {
    return;
  }

  const authConfig = (authentication.provider.config as UpAuthProviderConfig)
    .userModel;
  const {model, idField, usernameField, passwordField, isVerifiedField} =
    authConfig;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const targets = getApiRouteTargets(
    config,
    'auth',
    model,
    'unknown',
    'editMe',
  );

  for (const {identifier, variant, policy} of targets) {
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
      identifier,
      policy,
    );
  }
}

function registerEditMeEndpoint(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  model: string,
  authModelConfig: ModelConfig,
  idField: string,
  usernameField: string,
  passwordField: string,
  isVerifiedField: string | undefined,
  variant: string,
  apiIdentifier: string,
  policy: ResolvedApiPolicy,
): void {
  const schema: Record<string, unknown> = generateSchema(
    authModelConfig,
    model,
    idField,
    usernameField,
    passwordField,
    isVerifiedField,
    policy,
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
        k => !protectedFields.has(k) && !isManagedTimestampField(k),
      );

      if (editableKeys.length === 0) {
        return reply
          .status(400)
          .send(app.buildResponse(400, 'No editable fields provided', null));
      }

      const updatedAtClause = buildUpdatedAtClause(
        authModelConfig,
        config.infrastructure.database.engine,
      );

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
        if (updatedAtClause) {
          setClauses.push(updatedAtClause);
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
  isVerifiedField: string | undefined,
  policy: ResolvedApiPolicy,
) {
  const protectedFields = new Set(
    [idField, usernameField, passwordField, isVerifiedField].filter(Boolean),
  );

  const bodyProperties: Record<string, object> = {};
  for (const [fieldName, field] of Object.entries(authModelConfig.fields)) {
    if (
      !protectedFields.has(fieldName) &&
      !isManagedTimestampField(fieldName)
    ) {
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
    tags: policy.tags,
    body: bodySchema,
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
