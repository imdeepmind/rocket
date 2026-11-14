import * as path from 'path';
import {pathToFileURL} from 'url';

import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {computeFunctionOutputPath} from '@/lib/functions/builder';

import {CustomEndpointFunctionHandler} from '@/interfaces/config';

export type FunctionModuleLoader = (
  artifactPath: string,
) => Promise<Record<string, unknown>>;

const moduleCache = new Map<string, Record<string, unknown>>();

/**
 * Clears the in-memory function module cache (useful for tests or hot reloads).
 */
export function clearFunctionModuleCache(): void {
  moduleCache.clear();
}

const defaultLoader: FunctionModuleLoader = async (artifactPath: string) => {
  const fileUrl = pathToFileURL(artifactPath).href;
  return import(fileUrl);
};

/**
 * Resolves the destination JavaScript bundle path for a function handler.
 */
export function resolveFunctionArtifactPath(
  file: string,
  configDir: string = process.cwd(),
  outDir?: string,
): string {
  const resolvedSource = path.resolve(configDir, file);
  const targetOutDir =
    outDir ??
    process.env.ROSS_FUNCTIONS_DIR ??
    path.join(configDir, '.ross', 'functions');
  return computeFunctionOutputPath(resolvedSource, configDir, targetOutDir);
}

/**
 * Slices a custom endpoint's JSON validation schema into Fastify's params,
 * querystring, body, and headers schemas based on handler.inputs.
 */
export function buildFunctionEndpointSchema(
  handler: CustomEndpointFunctionHandler,
  validation?: Record<string, unknown>,
): {
  params?: Record<string, unknown>;
  querystring?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, unknown>;
} {
  const result: {
    params?: Record<string, unknown>;
    querystring?: Record<string, unknown>;
    body?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  } = {};

  const inputs = handler.inputs;
  if (!inputs) {
    return result;
  }

  const validationProps =
    (validation?.properties as Record<string, unknown> | undefined) ?? {};
  const requiredList = Array.isArray(validation?.required)
    ? (validation.required as string[])
    : [];

  const pathKeys = inputs.path ?? [];
  const queryKeys = inputs.query ?? [];
  const bodyKeys = inputs.body ?? [];
  const headerKeys = inputs.headers ?? inputs.header ?? [];

  if (pathKeys.length > 0) {
    const paramsProps: Record<string, unknown> = {};
    for (const key of pathKeys) {
      if (key in validationProps) {
        paramsProps[key] = validationProps[key];
      }
    }
    result.params = {
      type: 'object',
      properties: paramsProps,
      required: pathKeys,
      additionalProperties: false,
    };
  }

  if (queryKeys.length > 0) {
    const queryProps: Record<string, unknown> = {};
    for (const key of queryKeys) {
      if (key in validationProps) {
        queryProps[key] = validationProps[key];
      }
    }
    const requiredQuery = queryKeys.filter((k: string) =>
      requiredList.includes(k),
    );
    result.querystring = {
      type: 'object',
      properties: queryProps,
      ...(requiredQuery.length > 0 ? {required: requiredQuery} : {}),
      additionalProperties: false,
    };
  }

  if (bodyKeys.length > 0) {
    const bodyProps: Record<string, unknown> = {};
    for (const key of bodyKeys) {
      if (key in validationProps) {
        bodyProps[key] = validationProps[key];
      }
    }
    const requiredBody = bodyKeys.filter((k: string) =>
      requiredList.includes(k),
    );
    result.body = {
      type: 'object',
      properties: bodyProps,
      ...(requiredBody.length > 0 ? {required: requiredBody} : {}),
      additionalProperties: false,
    };
  }

  if (headerKeys.length > 0) {
    const headerProps: Record<string, unknown> = {};
    for (const key of headerKeys) {
      if (key in validationProps) {
        headerProps[key] = validationProps[key];
      }
    }
    const requiredHeaders = headerKeys.filter((k: string) =>
      requiredList.includes(k),
    );
    result.headers = {
      type: 'object',
      properties: headerProps,
      ...(requiredHeaders.length > 0 ? {required: requiredHeaders} : {}),
    };
  }

  return result;
}

/**
 * Executes a custom function endpoint handler with Fastify parameter slicing
 * and RocketContext framework injection.
 */
export async function handleFunction(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  handlerConfig: CustomEndpointFunctionHandler,
  artifactPath: string,
  loader: FunctionModuleLoader = defaultLoader,
): Promise<void> {
  let mod = moduleCache.get(artifactPath);
  if (!mod) {
    mod = (await loader(artifactPath)) as Record<string, unknown>;
    moduleCache.set(artifactPath, mod);
  }

  const fn = mod[handlerConfig.exportName];
  if (typeof fn !== 'function') {
    throw Object.assign(
      new Error(
        `Function "${handlerConfig.exportName}" is not exported as a function from "${artifactPath}".`,
      ),
      {statusCode: 500},
    );
  }

  const result = await fn(request, app);

  return reply
    .status(200)
    .send(
      app.buildResponse(200, 'Success', result !== undefined ? result : null),
    );
}
