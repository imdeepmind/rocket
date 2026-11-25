import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
export declare function buildSqlEndpoint(sql: string, method: string, configValidation?: Record<string, unknown>): {
    params?: Record<string, unknown>;
    querystring?: Record<string, unknown>;
    body?: Record<string, unknown>;
};
export declare function handleSql(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, sql: string): Promise<void>;
