import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  buildPreValidation,
  getResponseStructureSchema,
} from '@/routes/schema-helpers';

import {AppConfig, UpAuthProviderConfig} from '@/interfaces/config';

import {
  buildApiIdentifier,
  getAdditionalVariants,
  getVariantSegment,
} from '@/utils/config';
import {capitalizeFirstLetter} from '@/utils/string';

export function registerEmailChangeRoute(
  app: FastifyInstance,
  config: AppConfig,
): void {
  const {models} = config.data;
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  const upConfig = config.authentication!.provider
    .config as UpAuthProviderConfig;
  const {model, idField, usernameField, isVerifiedField} = upConfig.userModel;

  const authModelConfig = models[model];

  if (!authModelConfig) return;

  const defaultApiIdentifier = `auth${getVariantSegment(config)}.${model}.unknown.emailChange`;

  if (config.apis?.[defaultApiIdentifier]?.enabled === false) return;

  const defaultTags = config.apis?.[defaultApiIdentifier]?.tags;

  registerEmailChangeEndpoint(
    app,
    config,
    model,
    idField,
    usernameField,
    isVerifiedField,
    defaultVariant,
    defaultApiIdentifier,
    defaultTags,
  );

  const baseIdentifier = buildApiIdentifier(
    'auth',
    defaultVariant,
    model,
    'unknown',
    'emailChange',
  );
  const additionalVariants = getAdditionalVariants(config, baseIdentifier);

  for (const variant of additionalVariants) {
    const variantApiIdentifier = buildApiIdentifier(
      'auth',
      variant,
      model,
      'unknown',
      'emailChange',
    );

    if (config.apis?.[variantApiIdentifier]?.enabled === false) continue;

    const variantTags = config.apis?.[variantApiIdentifier]?.tags;

    registerEmailChangeEndpoint(
      app,
      config,
      model,
      idField,
      usernameField,
      isVerifiedField,
      variant,
      variantApiIdentifier,
      variantTags,
    );
  }
}

function registerEmailChangeEndpoint(
  app: FastifyInstance,
  config: AppConfig,
  model: string,
  idField: string,
  usernameField: string,
  isVerifiedField: string | undefined,
  variant: string,
  apiIdentifier: string,
  routeTags?: string[],
): void {
  const schema: Record<string, unknown> = generateSchema(
    usernameField,
    model,
    routeTags,
  );

  const path = `/${variant}/auth/user/email`;

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

      const body = request.body as Record<string, string>;
      const newEmail = body[usernameField];

      /* c8 ignore start */
      if (!newEmail) {
        return reply
          .status(400)
          .send(app.buildResponse(400, `${usernameField} is required`, null));
      }
      /* c8 ignore stop */

      let tx;
      try {
        tx = await app.db.beginTransaction();

        const selectQuery = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;
        const res = await tx.query(selectQuery, [userId]);

        if (res.rows.length === 0) {
          throw Object.assign(new Error('User not found'), {
            statusCode: 404,
            body: app.buildResponse(404, 'User not found', null),
          });
        }

        const setClauses = [`"${usernameField}" = $1`];
        const values: unknown[] = [newEmail];

        if (isVerifiedField) {
          setClauses.push(`"${isVerifiedField}" = $2`);
          values.push(false);
        }

        values.push(userId);
        const paramIndex = setClauses.length + 1;
        const updateQuery = `UPDATE "${model}" SET ${setClauses.join(', ')} WHERE "${idField}" = $${paramIndex};`;
        await tx.query(updateQuery, values);

        await tx.commit();

        const ulid = await app.otp.sendOTPForVerification(newEmail);

        return reply.status(200).send(
          app.buildResponse(200, 'Email updated. OTP sent to your new email.', {
            requiresMfa: true,
            ulid,
          }),
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
  usernameField: string,
  model: string,
  routeTags?: string[],
) {
  const bodySchema = {
    type: 'object',
    required: [usernameField],
    properties: {
      [usernameField]: {type: 'string', description: 'The new email address'},
    },
    additionalProperties: false,
  };

  const dataSchema = {
    type: 'object',
    properties: {
      requiresMfa: {
        type: 'boolean',
        description: 'Indicates MFA is required',
      },
      ulid: {type: 'string', description: 'OTP verification ULID'},
    },
  };

  const responseSchema = getResponseStructureSchema([200], dataSchema);

  const schema: Record<string, unknown> = {
    summary: `Change email for ${capitalizeFirstLetter(model)}`,
    description: `Updates the email address for the authenticated user in the "${model}" table and sends an OTP to the new email.`,
    tags: routeTags ?? [capitalizeFirstLetter(model), 'Auth', 'Profile'],
    body: bodySchema,
    response: responseSchema,
    security: [{bearerAuth: []}],
  };
  return schema;
}
