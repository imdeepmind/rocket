import { FastifyInstance } from 'fastify';
import { RouteInfo } from './lib/server/welcome.js';
import { ResolvedAppConfig } from './interfaces/config.js';
export interface StartServerResult {
    app: FastifyInstance;
    routes: RouteInfo[];
}
export declare function startServer(resolvedConfig: ResolvedAppConfig): Promise<StartServerResult>;
