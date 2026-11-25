import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CustomEndpointFunctionHandler } from '../../../interfaces/config.js';
export type FunctionModuleLoader = (artifactPath: string) => Promise<Record<string, unknown>>;
/**
 * Clears the in-memory function module cache (useful for tests or hot reloads).
 */
export declare function clearFunctionModuleCache(): void;
/**
 * Resolves the destination JavaScript bundle path for a function handler.
 */
export declare function resolveFunctionArtifactPath(file: string, configDir?: string, outDir?: string): string;
/**
 * Slices a custom endpoint's JSON validation schema into Fastify's params,
 * querystring, body, and headers schemas based on handler.inputs.
 */
export declare function buildFunctionEndpointSchema(handler: CustomEndpointFunctionHandler, validation?: Record<string, unknown>): {
    params?: Record<string, unknown>;
    querystring?: Record<string, unknown>;
    body?: Record<string, unknown>;
    headers?: Record<string, unknown>;
};
/**
 * Executes a custom function endpoint handler with Fastify parameter slicing
 * and RocketContext framework injection.
 */
export declare function handleFunction(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, handlerConfig: CustomEndpointFunctionHandler, artifactPath: string, loader?: FunctionModuleLoader): Promise<void>;
