import { FastifyInstance } from 'fastify';
import { ResolvedAppConfig } from '../../interfaces/config.js';
export declare function registerLoginOtpVerifyRoute(app: FastifyInstance, config: ResolvedAppConfig): void;
export declare function registerRegistrationOtpVerifyRoute(app: FastifyInstance, config: ResolvedAppConfig): void;
export declare function registerForgotPasswordOtpVerifyRoute(app: FastifyInstance, config: ResolvedAppConfig): void;
