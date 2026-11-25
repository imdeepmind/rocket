import { EmailConfig } from '../../interfaces/config.js';
import { EmailSender } from '../../interfaces/email.js';
export type { EmailSender };
/**
 * Create the email sender for the configured provider.
 */
export declare function createEmailSender(config: EmailConfig): EmailSender;
