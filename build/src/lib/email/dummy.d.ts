import { EmailSender } from '../../interfaces/email.js';
/**
 * Create an email sender that logs the message instead of delivering it.
 *
 * Useful for local development and tests.
 */
export declare function createDummyEmailSender(): EmailSender;
