import { FastifyInstance } from 'fastify';
import { ResolvedAppConfig } from '../../interfaces/config.js';
export declare function registerLoginResendOtpRoute(app: FastifyInstance, config: ResolvedAppConfig): void;
export declare function registerRegistrationResendOtpRoute(app: FastifyInstance, config: ResolvedAppConfig): void;
export declare function registerForgotPasswordResendOtpRoute(app: FastifyInstance, config: ResolvedAppConfig): void;
