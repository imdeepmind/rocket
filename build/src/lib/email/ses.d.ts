import { AwsSesEmailOptions } from '../../interfaces/config.js';
import { EmailSender } from '../../interfaces/email.js';
/**
 * Create an AWS SES email sender.
 *
 * When `accessKeyId`/`secretAccessKey` are omitted, the AWS SDK default
 * credential chain is used (environment variables, shared credentials file,
 * ECS task role, Lambda role, EC2 instance profile, ...).
 */
export declare function createSesEmailSender(options: AwsSesEmailOptions): EmailSender;
