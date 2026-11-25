import { FastifyInstance } from 'fastify';
import { ResolvedAppConfig } from '../interfaces/config.js';
export declare function registerHealthRoute(app: FastifyInstance, config: ResolvedAppConfig): void;
