import { FastifyInstance } from 'fastify';
import { ResolvedAppConfig } from '../../interfaces/config.js';
export declare function registerCustomEndpointRoutes(app: FastifyInstance, config: ResolvedAppConfig, options?: {
    configDir?: string;
    outDir?: string;
}): void;
