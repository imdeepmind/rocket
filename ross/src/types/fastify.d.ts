import '@fastify/jwt';
import 'fastify';

import {DatabaseQuery, StructuredResponse} from '@/interfaces';
import {ResolvedAppConfig} from '@/interfaces/config';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
      role?: string;
      roles?: string[];
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
    buildResponse: <T = unknown>(
      code: number,
      message: string,
      data: T,
    ) => StructuredResponse<T>;
    cache: import('@/plugin/cache').ICache;
    jwt: import('@fastify/jwt').JWT;
    appConfig: ResolvedAppConfig;
    callWebhook: (
      trigger: 'request' | 'response',
      request: import('fastify').FastifyRequest,
      payload: unknown,
    ) => Promise<void>;
    enforceSSP: (request: import('fastify').FastifyRequest) => void;
    communicate: {
      sendEmail: (
        email: string,
        htmlBody: string,
        body: string,
      ) => Promise<void>;
    };
    otp: import('@/interfaces/otp').IOtpService;
  }
}
