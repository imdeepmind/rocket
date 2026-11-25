import '@fastify/jwt';
import 'fastify';
import { StructuredResponse } from '../interfaces/index.js';
import { ResolvedAppConfig } from '../interfaces/config.js';
import { DatabaseQuery } from '../interfaces/database.js';
declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: {
            id: string;
            email: string | null;
            providerId?: string | null;
            role?: string;
            roles?: string[];
            [key: string]: unknown;
        };
    }
}
declare module 'fastify' {
    interface FastifyContextConfig {
        apiIdentifier?: string;
    }
    interface FastifyRequest {
        authenticate: () => Promise<void>;
    }
    interface FastifyInstance {
        db: DatabaseQuery;
        buildResponse: <T = unknown>(code: number, message: string, data: T) => StructuredResponse<T>;
        cache: import('../interfaces/cache.js').ICache;
        jwt: import('@fastify/jwt').JWT;
        appConfig: ResolvedAppConfig;
        callWebhook: (trigger: 'request' | 'response', request: import('fastify').FastifyRequest, payload: unknown) => Promise<void>;
        enforceSSP: (request: import('fastify').FastifyRequest) => void;
        communicate: {
            sendEmail: import('../interfaces/email.js').EmailSender;
        };
        otp: import('../interfaces/otp.js').IOtpService;
    }
}
export {};
